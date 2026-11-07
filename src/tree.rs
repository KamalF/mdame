use std::collections::BTreeMap;
use std::path::Path;

use cap_std::fs::Dir;
use ignore::{Walk, WalkBuilder};
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
    let mut top = Folder::default();
    for entry in walker(root).filter_map(Result::ok) {
        // Paths that are not UTF-8 could not be asked for again by the page.
        let Some(relative) = entry.path().strip_prefix(root).ok().and_then(Path::to_str) else {
            continue;
        };
        let Some(file) = viewable_file(&workspace.dir, relative) else {
            continue;
        };
        let parts: Vec<&str> = relative.split('/').collect();
        top.insert(&parts, file);
    }
    top.into_node(String::new(), String::new())
}

/// The entries of the workspace that the tree may show, folders included:
/// gitignored entries, `.git` and `.mdame` stay out.
pub fn walker(root: &Path) -> Walk {
    // A notes folder can have a .gitignore without being a git repository.
    // Ignore files above the root count only inside a repository, as in
    // git: a `.gitignore` in a home folder without `.git` must not hide
    // the notes below it.
    let in_repo = root.ancestors().any(|dir| dir.join(".git").exists());
    WalkBuilder::new(root)
        // In a repository, true stops the parent scan at its root.
        .require_git(in_repo)
        // Git reads core.excludesFile only in a repository, too.
        .git_global(in_repo)
        .parents(in_repo)
        .hidden(false)
        .filter_entry(|entry| !is_git_or_mdame(entry.file_name()))
        .build()
}

/// The family and modified time of a viewable file, or `None` for
/// anything else. In hidden folders, only markdown is viewable.
/// The `Dir` follows a symlink only while it stays in the workspace, so a
/// link to a file inside counts as a file and a link out is left out; the
/// walker does not descend into a link to a folder.
fn viewable_file(dir: &Dir, relative: &str) -> Option<File> {
    let family = Family::of(relative)?;
    if family != Family::Markdown && is_hidden(Path::new(relative)) {
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
    fn markdown_in_a_hidden_folder_is_listed() {
        let root = tempfile::tempdir().unwrap();
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
        let root = tempfile::tempdir().unwrap();
        write(root.path(), ".notes.md", 1);

        assert_eq!(tree_paths(&walk(root.path())), ["", ".notes.md"]);
    }

    #[test]
    fn other_types_in_a_hidden_folder_stay_out() {
        let root = tempfile::tempdir().unwrap();
        write(root.path(), ".claude/settings.json", 1);
        write(root.path(), ".github/logo.png", 1);
        write(root.path(), ".notes.txt", 1);
        write(root.path(), "a.json", 1);

        assert_eq!(tree_paths(&walk(root.path())), ["", "a.json"]);
    }

    #[test]
    fn git_and_mdame_are_never_listed() {
        let root = tempfile::tempdir().unwrap();
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
        let root = tempfile::tempdir().unwrap();
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
