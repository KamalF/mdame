use std::collections::BTreeMap;
use std::os::unix::fs::MetadataExt;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, PoisonError};

use cap_std::fs::Dir;
use ignore::{DirEntry, WalkBuilder, WalkState};
use serde::Serialize;

use crate::document::modified_secs;
use crate::render::Family;
use crate::workspace::{Workspace, is_git_or_mdame, is_hidden};

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Dir,
    File,
}

#[derive(Debug, PartialEq, Serialize)]
pub struct Node {
    pub name: String,
    /// Relative to the workspace root, with `/` between parts.
    pub path: String,
    pub kind: Kind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub family: Option<Family>,
    /// Unix seconds. For a folder, its newest file.
    pub modified: u64,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<Node>,
}

/// The viewable files of the workspace, by folder. Folders with no viewable
/// file are left out.
pub fn build(workspace: &Workspace) -> Node {
    let root = &workspace.root;
    let hidden_root = is_hidden(root);
    let found = walk(root, |entry| {
        // Paths that are not UTF-8 could not be asked for again by the page.
        let relative = entry.path().strip_prefix(root).ok()?.to_str()?;
        Some((
            relative.to_owned(),
            viewable_file(&workspace.dir, hidden_root, relative)?,
        ))
    });
    let mut top = Folder::default();
    for (relative, file) in found {
        let parts: Vec<&str> = relative.split('/').collect();
        top.insert(&parts, file);
    }
    top.into_node(String::new(), String::new())
}

/// Each folder that a walk opens is an event on the watcher's own watches.
/// On 15,000 folders, 16 threads overflowed the inotify queue; 4 did not,
/// and walked 5 times faster than one.
const WALK_THREADS: usize = 4;

/// One walk at a time: four tabs that load the tree at once also ran 16
/// threads.
static WALKING: Mutex<()> = Mutex::new(());

/// The files that the walker reads in each folder, for its ignore rules.
const IGNORE_FILES: [&str; 3] = [".gitignore", ".ignore", ".git/info/exclude"];

/// The walker builds globs from an ignore file: they take tens of times its
/// size in memory.
const MAX_IGNORE_FILE: u64 = 1024 * 1024;

/// The ignore file of `folder` that the walker must not read, if any.
/// Through links, it must be a regular file of 1 MiB at most, on the device
/// of its folder. Otherwise the walker could read without end: a FIFO
/// blocks, `/dev/zero` never ends, and `/proc/self/pagemap` says 0 bytes
/// but holds gigabytes. A cloned repository can hold a link to any of them.
fn bad_ignore_file(folder: &Path) -> Option<PathBuf> {
    IGNORE_FILES
        .iter()
        .map(|name| folder.join(name))
        .find(|path| {
            let Ok(file) = path.metadata() else {
                return false;
            };
            let same_device = folder
                .metadata()
                .is_ok_and(|folder| folder.dev() == file.dev());
            !file.is_file() || file.len() > MAX_IGNORE_FILE || !same_device
        })
}

/// What `keep` gives for each entry of the workspace that the tree may
/// show, folders included: gitignored entries, `.git` and `.mdame` stay
/// out, and so does a folder with a bad ignore file. A folder comes before
/// its entries: the walker visits it first, since a visit can skip a
/// folder's entries (`WalkState::Skip`). The rest of the order changes from
/// walk to walk.
pub fn walk<T: Send>(root: &Path, keep: impl Fn(&DirEntry) -> Option<T> + Sync) -> Vec<T> {
    let _walking = WALKING.lock().unwrap_or_else(PoisonError::into_inner);
    let kept = Mutex::new(Vec::new());
    // A notes folder can have a .gitignore without being a git repository.
    // Ignore files above the root count only inside a repository, as in
    // git: a `.gitignore` in a home folder without `.git` must not hide
    // the notes below it.
    let in_repo = root.ancestors().any(|dir| dir.join(".git").exists());
    // The walker reads the ignore files of the root and of each folder above
    // it before any filter, even those whose rules it does not apply.
    if let Some(file) = root.ancestors().find_map(bad_ignore_file) {
        tracing::warn!(
            "the tree is empty: {} is not a regular file",
            file.display()
        );
        return Vec::new();
    }
    WalkBuilder::new(root)
        // In a repository, true stops the parent scan at its root.
        .require_git(in_repo)
        // Git reads core.excludesFile only in a repository, too.
        .git_global(in_repo)
        .parents(in_repo)
        .hidden(false)
        .filter_entry(|entry| {
            if is_git_or_mdame(entry.file_name()) {
                return false;
            }
            let is_folder = entry.file_type().is_some_and(|kind| kind.is_dir());
            // Before the walker reads them.
            let bad = is_folder.then(|| bad_ignore_file(entry.path())).flatten();
            if let Some(file) = &bad {
                tracing::warn!("skipped: {} is not a regular file", file.display());
            }
            bad.is_none()
        })
        .threads(WALK_THREADS)
        .build_parallel()
        .run(|| {
            Box::new(|entry| {
                if let Some(item) = entry.ok().and_then(|entry| keep(&entry)) {
                    kept.lock()
                        .unwrap_or_else(PoisonError::into_inner)
                        .push(item);
                }
                WalkState::Continue
            })
        });
    kept.into_inner().unwrap_or_else(PoisonError::into_inner)
}

/// The family and modified time of a viewable file, or `None` for
/// anything else. In hidden folders, only markdown is viewable, also when
/// the root itself is hidden or in one.
/// The `Dir` follows a symlink only while it stays in the workspace, so a
/// link to a file inside counts as a file and a link out is left out; the
/// walker does not descend into a link to a folder.
fn viewable_file(dir: &Dir, hidden_root: bool, relative: &str) -> Option<File> {
    let family = Family::of(relative)?;
    if family != Family::Markdown && (hidden_root || is_hidden(Path::new(relative))) {
        return None;
    }
    let metadata = dir
        .metadata(relative)
        .ok()
        .filter(|metadata| metadata.is_file())?;
    Some(File {
        family,
        modified: modified_secs(&metadata)?,
    })
}

struct File {
    family: Family,
    modified: u64,
}

#[derive(Default)]
struct Folder {
    folders: BTreeMap<String, Folder>,
    files: BTreeMap<String, File>,
}

impl Folder {
    fn insert(&mut self, parts: &[&str], file: File) {
        match parts {
            [name] => {
                self.files.insert(name.to_string(), file);
            }
            [folder, rest @ ..] => self
                .folders
                .entry(folder.to_string())
                .or_default()
                .insert(rest, file),
            [] => {}
        }
    }

    fn into_node(self, name: String, path: String) -> Node {
        let join = |child: &str| {
            if path.is_empty() {
                child.to_owned()
            } else {
                format!("{path}/{child}")
            }
        };
        let folders = self.folders.into_iter().map(|(child, folder)| {
            let child_path = join(&child);
            folder.into_node(child, child_path)
        });
        let files = self.files.into_iter().map(|(child, file)| Node {
            path: join(&child),
            name: child,
            kind: Kind::File,
            family: Some(file.family),
            modified: file.modified,
            children: Vec::new(),
        });
        let children: Vec<Node> = folders.chain(files).collect();
        let modified = children
            .iter()
            .map(|child| child.modified)
            .max()
            .unwrap_or(0);
        Node {
            name,
            path,
            kind: Kind::Dir,
            family: None,
            modified,
            children,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn write(root: &Path, path: &str, seconds: u64) {
        let path = root.join(path);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        let file = fs::File::create(&path).unwrap();
        file.set_modified(std::time::UNIX_EPOCH + std::time::Duration::from_secs(seconds))
            .unwrap();
    }

    fn walk(root: &Path) -> Node {
        build(&Workspace::open(root).unwrap())
    }

    fn tree_paths(node: &Node) -> Vec<String> {
        let mut all = vec![node.path.clone()];
        for child in &node.children {
            all.extend(tree_paths(child));
        }
        all
    }

    #[test]
    fn nests_viewable_files_by_folder() {
        let root = crate::workspace::tempdir();
        write(root.path(), "README.md", 10);
        write(root.path(), "docs/SPEC.md", 30);
        write(root.path(), "docs/img/logo.PNG", 20);
        write(root.path(), "src/main.rs", 40);

        let tree = walk(root.path());
        assert_eq!(
            tree_paths(&tree),
            [
                "",
                "docs",
                "docs/img",
                "docs/img/logo.PNG",
                "docs/SPEC.md",
                "README.md"
            ]
        );
        assert_eq!(tree.children[0].kind, Kind::Dir);
        assert_eq!(tree.children[1].kind, Kind::File);
    }

    #[test]
    fn folder_date_is_its_newest_file() {
        let root = crate::workspace::tempdir();
        write(root.path(), "notes/old.md", 10);
        write(root.path(), "notes/sub/new.md", 50);

        let tree = walk(root.path());
        assert_eq!(tree.modified, 50);
        assert_eq!(tree.children[0].modified, 50);
    }

    #[test]
    fn gitignore_applies_without_git() {
        let root = crate::workspace::tempdir();
        fs::write(root.path().join(".gitignore"), "drafts/\n").unwrap();
        write(root.path(), "drafts/wip.md", 1);
        write(root.path(), "notes.md", 1);

        assert_eq!(tree_paths(&walk(root.path())), ["", "notes.md"]);
    }

    #[test]
    fn markdown_in_a_hidden_folder_is_listed() {
        let root = crate::workspace::tempdir();
        write(root.path(), ".claude/plans/a.md", 1);
        write(root.path(), "docs/.drafts/b.markdown", 1);

        assert_eq!(
            tree_paths(&walk(root.path())),
            [
                "",
                ".claude",
                ".claude/plans",
                ".claude/plans/a.md",
                "docs",
                "docs/.drafts",
                "docs/.drafts/b.markdown"
            ]
        );
    }

    #[test]
    fn a_hidden_markdown_file_is_listed() {
        let root = crate::workspace::tempdir();
        write(root.path(), ".notes.md", 1);

        assert_eq!(tree_paths(&walk(root.path())), ["", ".notes.md"]);
    }

    #[test]
    fn other_types_in_a_hidden_folder_stay_out() {
        let root = crate::workspace::tempdir();
        write(root.path(), ".claude/settings.json", 1);
        write(root.path(), ".github/logo.png", 1);
        write(root.path(), ".notes.txt", 1);
        write(root.path(), "a.json", 1);

        assert_eq!(tree_paths(&walk(root.path())), ["", "a.json"]);
    }

    #[test]
    fn a_hidden_root_lists_only_markdown() {
        let parent = crate::workspace::tempdir();
        let root = parent.path().join(".claude");
        write(&root, "settings.json", 1);
        write(&root, "plans/a.md", 1);

        assert_eq!(tree_paths(&walk(&root)), ["", "plans", "plans/a.md"]);
    }

    /// `walk`, which fails rather than block: a FIFO would hold it forever.
    fn walk_within_seconds(root: &Path) -> Node {
        let (sender, receiver) = std::sync::mpsc::channel();
        let root = root.to_owned();
        std::thread::spawn(move || sender.send(walk(&root)));
        let wait = std::time::Duration::from_secs(5);
        receiver.recv_timeout(wait).expect("the walk ends")
    }

    fn mkfifo(path: &Path) {
        let made = std::process::Command::new("mkfifo").arg(path).status();
        assert!(made.unwrap().success());
    }

    #[test]
    fn a_folder_with_a_bad_ignore_file_is_skipped() {
        use std::os::unix::fs::symlink;
        let root = crate::workspace::tempdir();
        for folder in ["fifo", "device", "repo", "large", "fine"] {
            write(root.path(), &format!("{folder}/a.md"), 1);
        }
        mkfifo(&root.path().join("fifo/.gitignore"));
        symlink("/dev/null", root.path().join("device/.ignore")).unwrap();
        fs::create_dir_all(root.path().join("repo/.git/info")).unwrap();
        symlink("/dev/null", root.path().join("repo/.git/info/exclude")).unwrap();
        let large = fs::File::create(root.path().join("large/.gitignore")).unwrap();
        large.set_len(MAX_IGNORE_FILE + 1).unwrap();
        // A regular file on another device, small should the check break.
        if cfg!(target_os = "linux") {
            write(root.path(), "procfs/a.md", 1);
            symlink("/proc/self/status", root.path().join("procfs/.gitignore")).unwrap();
        }
        fs::write(root.path().join("fine/.gitignore"), "").unwrap();

        let paths = tree_paths(&walk_within_seconds(root.path()));
        assert_eq!(paths, ["", "fine", "fine/a.md"]);
    }

    #[test]
    fn a_bad_ignore_file_at_or_above_the_root_gives_an_empty_tree() {
        let root = crate::workspace::tempdir();
        write(root.path(), "a.md", 1);
        mkfifo(&root.path().join(".gitignore"));
        assert_eq!(tree_paths(&walk_within_seconds(root.path())), [""]);

        let parent = crate::workspace::tempdir();
        mkfifo(&parent.path().join(".ignore"));
        write(parent.path(), "notes/a.md", 1);
        let notes = parent.path().join("notes");
        assert_eq!(tree_paths(&walk_within_seconds(&notes)), [""]);

        let outer = crate::workspace::tempdir();
        mkfifo(&outer.path().join(".gitignore"));
        fs::create_dir_all(outer.path().join("repo/.git")).unwrap();
        write(outer.path(), "repo/notes/a.md", 1);
        let notes = outer.path().join("repo/notes");
        assert_eq!(tree_paths(&walk_within_seconds(&notes)), [""]);
    }

    #[test]
    fn git_and_mdame_are_never_listed() {
        let root = crate::workspace::tempdir();
        write(root.path(), ".git/a.md", 1);
        write(root.path(), ".mdame/history/a.md/1.md", 1);
        write(root.path(), "sub/.git/b.md", 1);
        write(root.path(), "sub/.mdame/c.md", 1);
        write(root.path(), "sub/.GIT/e.md", 1);
        write(root.path(), "sub/d.md", 1);

        assert_eq!(tree_paths(&walk(root.path())), ["", "sub", "sub/d.md"]);
    }

    #[test]
    fn gitignore_applies_in_hidden_folders() {
        let root = crate::workspace::tempdir();
        fs::write(root.path().join(".gitignore"), ".claude/local/\n").unwrap();
        write(root.path(), ".claude/local/a.md", 1);
        write(root.path(), ".claude/plans/b.md", 1);

        assert_eq!(
            tree_paths(&walk(root.path())),
            ["", ".claude", ".claude/plans", ".claude/plans/b.md"]
        );
    }

    #[test]
    fn gitignore_above_the_root_applies_only_in_a_repository() {
        let parent = crate::workspace::tempdir();
        fs::write(parent.path().join(".gitignore"), "*.md\n").unwrap();
        write(parent.path(), "ws/a.md", 1);
        let root = parent.path().join("ws");
        assert_eq!(tree_paths(&walk(&root)), ["", "a.md"]);

        fs::create_dir(parent.path().join(".git")).unwrap();
        assert_eq!(tree_paths(&walk(&root)), [""]);
    }

    #[test]
    fn gitignore_above_the_repository_does_not_apply() {
        let parent = crate::workspace::tempdir();
        fs::write(parent.path().join(".gitignore"), "*.md\n").unwrap();
        write(parent.path(), "repo/a.md", 1);
        let root = parent.path().join("repo");
        fs::create_dir(root.join(".git")).unwrap();
        assert_eq!(tree_paths(&walk(&root)), ["", "a.md"]);
    }

    #[test]
    fn links_inside_are_listed_but_links_out_and_linked_folders_are_not() {
        let outside = crate::workspace::tempdir();
        write(outside.path(), "secret.md", 1);
        write(outside.path(), "folder/inner.md", 1);
        let root = crate::workspace::tempdir();
        write(root.path(), "a.md", 1);
        let link = |target: &Path, name: &str| {
            std::os::unix::fs::symlink(target, root.path().join(name)).unwrap();
        };
        link(Path::new("a.md"), "b.md");
        link(&outside.path().join("secret.md"), "absolute.md");
        link(
            &Path::new("..")
                .join(outside.path().file_name().unwrap())
                .join("secret.md"),
            "up.md",
        );
        link(&outside.path().join("folder"), "linked");

        assert_eq!(tree_paths(&walk(root.path())), ["", "a.md", "b.md"]);
    }

    #[test]
    fn the_walk_gives_a_folder_before_its_entries() {
        let root = crate::workspace::tempdir();
        for a in 0..4 {
            for b in 0..4 {
                write(root.path(), &format!("{a}/{b}/c.md"), 1);
            }
        }
        // The order changes from walk to walk.
        for _ in 0..20 {
            let walked = super::walk(root.path(), |entry| Some(entry.path().to_owned()));
            assert_eq!(walked.len(), 1 + 4 + 16 + 16);
            for (i, path) in walked.iter().enumerate().skip(1) {
                let parent = path.parent().unwrap();
                assert!(walked[..i].iter().any(|seen| seen == parent), "{walked:?}");
            }
        }
    }

    #[test]
    fn empty_workspace_is_an_empty_root() {
        let root = crate::workspace::tempdir();
        write(root.path(), "main.rs", 1);
        let tree = walk(root.path());
        assert!(tree.children.is_empty());
        assert_eq!(tree.modified, 0);
    }
}
