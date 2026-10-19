use std::io::{self, ErrorKind};
use std::path::{Path, PathBuf};

use cap_std::ambient_authority;
use cap_std::fs::Dir;

use crate::watch::Watcher;

pub struct Workspace {
    pub root: PathBuf,
    /// Every file access goes through it, so no path can leave `root`.
    pub dir: Dir,
    /// The file to show first, when mdame was given a file.
    pub start: Option<String>,
    /// Watches `root` as long as the workspace lives.
    pub watcher: Option<Watcher>,
}

impl Workspace {
    /// A folder opens as itself; a file opens its folder, with the file first.
    pub fn open(path: &Path) -> io::Result<Workspace> {
        let path = path.canonicalize()?;
        let (root, start) = if path.is_dir() {
            (path, None)
        } else if path.is_file() {
            let name = path.file_name().and_then(|name| name.to_str());
            let name = name
                .map(str::to_owned)
                .ok_or_else(|| io::Error::new(ErrorKind::InvalidInput, "file name is not UTF-8"))?;
            let root = path.parent().expect("a file has a parent").to_owned();
            (root, Some(name))
        } else {
            return Err(io::Error::new(
                ErrorKind::InvalidInput,
                "not a file or a folder",
            ));
        };
        let dir = Dir::open_ambient_dir(&root, ambient_authority())?;
        Ok(Workspace {
            root,
            dir,
            start,
            watcher: None,
        })
    }

    /// The canonical path that was opened: the folder, or the file.
    pub fn path(&self) -> PathBuf {
        match &self.start {
            Some(name) => self.root.join(name),
            None => self.root.clone(),
        }
    }
}

/// `~` and `~/…` name the home folder, as in a shell; `~user` is not expanded.
pub fn expand_home(input: &str, home: Option<&Path>) -> PathBuf {
    let Some(home) = home else {
        return PathBuf::from(input);
    };
    if input == "~" {
        return home.to_owned();
    }
    match input.strip_prefix("~/") {
        Some(rest) => home.join(rest),
        None => PathBuf::from(input),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn folder_opens_as_itself() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("a.md"), "# A").unwrap();

        let workspace = Workspace::open(dir.path()).unwrap();
        assert_eq!(workspace.root, dir.path().canonicalize().unwrap());
        assert_eq!(workspace.start, None);
        assert_eq!(workspace.dir.read_to_string("a.md").unwrap(), "# A");
    }

    #[test]
    fn file_opens_its_folder_with_the_file_first() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("a.md"), "").unwrap();

        let workspace = Workspace::open(&dir.path().join("a.md")).unwrap();
        assert_eq!(workspace.root, dir.path().canonicalize().unwrap());
        assert_eq!(workspace.start.as_deref(), Some("a.md"));
    }

    #[test]
    fn dotted_path_gives_the_canonical_root() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir(dir.path().join("sub")).unwrap();

        let dotted = Workspace::open(&dir.path().join("sub/../sub/.")).unwrap();
        assert_eq!(dotted.root, dir.path().join("sub").canonicalize().unwrap());
    }

    #[test]
    fn tilde_names_the_home_folder() {
        let home = Some(Path::new("/home/me"));
        let cases = [
            ("~", "/home/me"),
            ("~/notes", "/home/me/notes"),
            ("~user/notes", "~user/notes"),
            ("/srv/~/a", "/srv/~/a"),
        ];
        for (input, expected) in cases {
            assert_eq!(expand_home(input, home), PathBuf::from(expected), "{input}");
        }
        assert_eq!(expand_home("~/notes", None), PathBuf::from("~/notes"));
    }

    #[test]
    fn missing_path_is_not_found() {
        let dir = tempfile::tempdir().unwrap();
        let error = Workspace::open(&dir.path().join("missing")).err().unwrap();
        assert_eq!(error.kind(), ErrorKind::NotFound);
    }

    #[test]
    fn dir_refuses_paths_out_of_the_root() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir(dir.path().join("root")).unwrap();
        fs::write(dir.path().join("secret.md"), "").unwrap();

        let workspace = Workspace::open(&dir.path().join("root")).unwrap();
        assert!(workspace.dir.open("../secret.md").is_err());
        let absolute = dir.path().join("secret.md");
        assert!(workspace.dir.open(&absolute).is_err());
    }
}
