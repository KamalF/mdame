use std::collections::BTreeMap;
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;

use cap_std::fs::Dir;
use ignore::WalkBuilder;
use serde::Serialize;

use crate::workspace::{Workspace, expand_home};

const MAX_SUGGESTIONS: usize = 50;

#[derive(Debug, PartialEq, Serialize)]
pub struct Suggestion {
    /// The prefix as typed, completed with the entry's name.
    pub path: String,
    pub dir: bool,
}

/// Entries of the folder that `prefix` names, whose name starts with the
/// text after its last `/`. Hidden entries show once that text starts with
/// a dot.
pub fn complete(prefix: &str, home: Option<&Path>) -> Vec<Suggestion> {
    let Some(slash) = prefix.rfind('/') else {
        return Vec::new();
    };
    let (typed_dir, partial) = prefix.split_at(slash + 1);
    let dir = expand_home(typed_dir, home);
    if dir.is_relative() {
        return Vec::new();
    }
    let Ok(entries) = fs::read_dir(&dir) else {
        return Vec::new();
    };

    let partial_lower = partial.to_lowercase();
    let mut suggestions: Vec<Suggestion> = entries
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let name = entry.file_name().into_string().ok()?;
            let shown = !name.starts_with('.') || partial.starts_with('.');
            if !shown || !name.to_lowercase().starts_with(&partial_lower) {
                return None;
            }
            // file_type needs no extra syscall, but does not follow links:
            // a link to a folder must still complete as a folder.
            let file_type = entry.file_type().ok()?;
            let dir = file_type.is_dir() || (file_type.is_symlink() && entry.path().is_dir());
            let slash = if dir { "/" } else { "" };
            Some(Suggestion {
                path: format!("{typed_dir}{name}{slash}"),
                dir,
            })
        })
        .collect();
    suggestions.sort_by(|a, b| b.dir.cmp(&a.dir).then_with(|| a.path.cmp(&b.path)));
    suggestions.truncate(MAX_SUGGESTIONS);
    suggestions
}

/// The extensions that `render.rs` can show; other files stay out of the tree.
const VIEWABLE: &[&str] = &[
    "md", "markdown", "csv", "json", "yaml", "yml", "toml", "graphql", "gql", "txt", "mmd", "png",
    "jpg", "jpeg", "gif", "svg", "webp",
];

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
    /// Unix seconds. For a folder, its newest file.
    pub modified: u64,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<Node>,
}

/// The viewable files of the workspace, by folder. Folders with no viewable
/// file are left out.
pub fn build(workspace: &Workspace) -> Node {
    let root = &workspace.root;
    // A notes folder can have a .gitignore without being a git repository.
    // Ignore files above the root count only inside a repository, as in
    // git: a `.gitignore` in a home folder without `.git` must not hide
    // the notes below it.
    let in_repo = root.ancestors().any(|dir| dir.join(".git").exists());
    let walker = WalkBuilder::new(root)
        // In a repository, true stops the parent scan at its root.
        .require_git(in_repo)
        // Git reads core.excludesFile only in a repository, too.
        .git_global(in_repo)
        .parents(in_repo)
        .filter_entry(|entry| !(entry.depth() == 1 && entry.file_name() == ".mdame"))
        .build();
    let mut top = Folder::default();
    for entry in walker.filter_map(Result::ok) {
        // Paths that are not UTF-8 could not be asked for again by the page.
        let Some(relative) = entry.path().strip_prefix(root).ok().and_then(Path::to_str) else {
            continue;
        };
        let Some(modified) = viewable_file(&workspace.dir, relative) else {
            continue;
        };
        let parts: Vec<&str> = relative.split('/').collect();
        top.insert(&parts, modified);
    }
    top.into_node(String::new(), String::new())
}

/// The modified time of a viewable file, or `None` for anything else.
/// The `Dir` follows a symlink only while it stays in the workspace, so a
/// link to a file inside counts as a file and a link out is left out; the
/// walker does not descend into a link to a folder.
fn viewable_file(dir: &Dir, relative: &str) -> Option<u64> {
    let extension = Path::new(relative).extension()?.to_str()?.to_lowercase();
    if !VIEWABLE.contains(&extension.as_str()) {
        return None;
    }
    let metadata = dir
        .metadata(relative)
        .ok()
        .filter(|metadata| metadata.is_file())?;
    let modified = metadata
        .modified()
        .ok()?
        .into_std()
        .duration_since(UNIX_EPOCH)
        .ok()?;
    Some(modified.as_secs())
}

#[derive(Default)]
struct Folder {
    folders: BTreeMap<String, Folder>,
    files: BTreeMap<String, u64>,
}

impl Folder {
    fn insert(&mut self, parts: &[&str], modified: u64) {
        match parts {
            [name] => {
                self.files.insert(name.to_string(), modified);
            }
            [folder, rest @ ..] => self
                .folders
                .entry(folder.to_string())
                .or_default()
                .insert(rest, modified),
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
        let files = self.files.into_iter().map(|(child, modified)| Node {
            path: join(&child),
            name: child,
            kind: Kind::File,
            modified,
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
            modified,
            children,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn home() -> tempfile::TempDir {
        let home = tempfile::tempdir().unwrap();
        for dir in ["notes", "Archive", ".config"] {
            fs::create_dir(home.path().join(dir)).unwrap();
        }
        for file in ["notes.md", "todo.md", ".hidden.md"] {
            fs::write(home.path().join(file), "").unwrap();
        }
        home
    }

    fn paths(prefix: &str, home: &Path) -> Vec<String> {
        complete(prefix, Some(home))
            .into_iter()
            .map(|suggestion| suggestion.path)
            .collect()
    }

    #[test]
    fn folders_first_with_a_slash() {
        let home = home();
        assert_eq!(
            paths("~/", home.path()),
            ["~/Archive/", "~/notes/", "~/notes.md", "~/todo.md"]
        );
    }

    #[test]
    fn matches_the_last_part_in_any_case() {
        let home = home();
        assert_eq!(paths("~/NO", home.path()), ["~/notes/", "~/notes.md"]);
        assert_eq!(paths("~/a", home.path()), ["~/Archive/"]);
    }

    #[test]
    fn hidden_entries_need_a_dot() {
        let home = home();
        assert_eq!(paths("~/.", home.path()), ["~/.config/", "~/.hidden.md"]);
    }

    #[test]
    fn keeps_an_absolute_prefix_as_typed() {
        let home = home();
        let prefix = format!("{}/t", home.path().display());
        let expected = format!("{}/todo.md", home.path().display());
        assert_eq!(paths(&prefix, home.path()), [expected]);
    }

    #[test]
    fn link_to_a_folder_completes_as_a_folder() {
        let home = home();
        std::os::unix::fs::symlink(home.path().join("notes"), home.path().join("link")).unwrap();
        assert_eq!(paths("~/li", home.path()), ["~/link/"]);
    }

    #[test]
    fn nothing_for_relative_empty_or_missing() {
        let home = home();
        for prefix in ["", "~", "notes/", "~/missing/", "~/todo.md/"] {
            assert_eq!(paths(prefix, home.path()), Vec::<String>::new(), "{prefix}");
        }
    }

    fn write(root: &Path, path: &str, seconds: u64) {
        let path = root.join(path);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        let file = fs::File::create(&path).unwrap();
        file.set_modified(UNIX_EPOCH + std::time::Duration::from_secs(seconds))
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
        let root = tempfile::tempdir().unwrap();
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
        let root = tempfile::tempdir().unwrap();
        write(root.path(), "notes/old.md", 10);
        write(root.path(), "notes/sub/new.md", 50);

        let tree = walk(root.path());
        assert_eq!(tree.modified, 50);
        assert_eq!(tree.children[0].modified, 50);
    }

    #[test]
    fn gitignore_applies_without_git() {
        let root = tempfile::tempdir().unwrap();
        fs::write(root.path().join(".gitignore"), "drafts/\n").unwrap();
        write(root.path(), "drafts/wip.md", 1);
        write(root.path(), "notes.md", 1);

        assert_eq!(tree_paths(&walk(root.path())), ["", "notes.md"]);
    }

    #[test]
    fn hidden_and_mdame_entries_are_left_out() {
        let root = tempfile::tempdir().unwrap();
        write(root.path(), ".hidden/a.md", 1);
        write(root.path(), ".mdame/history/a.md/1.md", 1);
        write(root.path(), "a.md", 1);

        assert_eq!(tree_paths(&walk(root.path())), ["", "a.md"]);
    }

    #[test]
    fn gitignore_above_the_root_applies_only_in_a_repository() {
        let parent = tempfile::tempdir().unwrap();
        fs::write(parent.path().join(".gitignore"), "*.md\n").unwrap();
        write(parent.path(), "ws/a.md", 1);
        let root = parent.path().join("ws");
        assert_eq!(tree_paths(&walk(&root)), ["", "a.md"]);

        fs::create_dir(parent.path().join(".git")).unwrap();
        assert_eq!(tree_paths(&walk(&root)), [""]);
    }

    #[test]
    fn gitignore_above_the_repository_does_not_apply() {
        let parent = tempfile::tempdir().unwrap();
        fs::write(parent.path().join(".gitignore"), "*.md\n").unwrap();
        write(parent.path(), "repo/a.md", 1);
        let root = parent.path().join("repo");
        fs::create_dir(root.join(".git")).unwrap();
        assert_eq!(tree_paths(&walk(&root)), ["", "a.md"]);
    }

    #[test]
    fn links_inside_are_listed_but_links_out_and_linked_folders_are_not() {
        let outside = tempfile::tempdir().unwrap();
        write(outside.path(), "secret.md", 1);
        write(outside.path(), "folder/inner.md", 1);
        let root = tempfile::tempdir().unwrap();
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
    fn empty_workspace_is_an_empty_root() {
        let root = tempfile::tempdir().unwrap();
        write(root.path(), "main.rs", 1);
        let tree = walk(root.path());
        assert!(tree.children.is_empty());
        assert_eq!(tree.modified, 0);
    }
}
