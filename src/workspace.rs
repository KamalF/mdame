use std::ffi::OsStr;
use std::io::{self, ErrorKind};
use std::os::fd::{AsFd, BorrowedFd};
use std::path::{Component, Path, PathBuf};

use cap_std::ambient_authority;
use cap_std::fs::Dir;

use crate::watch::Watcher;

/// mdame's own folder in the workspace: never shown, and its events are
/// ignored.
pub const OWN_DIR: &str = ".mdame";

/// Where the file or folder of `handle` is, as the kernel knows it. A link
/// or a swapped entry in the path that opened it does not count. A file
/// deleted or renamed over since then gives `NotFound`.
pub fn fd_path(handle: &impl AsFd) -> io::Result<PathBuf> {
    let handle = handle.as_fd();
    let path = path_of(handle)?;
    // After the path: a file deleted between the two reads still counts
    // as deleted.
    if rustix::fs::fstat(handle)?.st_nlink == 0 {
        return Err(io::Error::new(ErrorKind::NotFound, "deleted"));
    }
    Ok(path)
}

fn path_of(handle: BorrowedFd) -> io::Result<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        use std::ffi::OsString;
        use std::os::unix::ffi::OsStringExt;

        Ok(OsString::from_vec(rustix::fs::getpath(handle)?.into_bytes()).into())
    }
    #[cfg(not(target_os = "macos"))]
    {
        use std::os::fd::AsRawFd;

        std::fs::read_link(format!("/proc/self/fd/{}", handle.as_raw_fd()))
    }
}

/// Whether a folder is `.git` or `.mdame`, at any depth: the tree never
/// enters them, and the editor never opens a file in them.
pub fn is_git_or_mdame(name: &OsStr) -> bool {
    // Some file systems ignore case: there, `.GIT` is the `.git` folder.
    name.eq_ignore_ascii_case(".git") || name.eq_ignore_ascii_case(OWN_DIR)
}

/// Whether a part of `path` is hidden: there, the tree and the editor take
/// markdown only.
pub fn is_hidden(path: &Path) -> bool {
    path.components().any(
        |part| matches!(part, Component::Normal(name) if name.as_encoded_bytes().starts_with(b".")),
    )
}

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
        // The folder that the Dir holds: a link swapped after the
        // canonicalize must not leave `root` naming another one. If the
        // kernel cannot tell, as without /proc, the resolved path stands.
        let root = fd_path(&dir).unwrap_or(root);
        Ok(Workspace {
            root,
            dir,
            start,
            watcher: None,
        })
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
    fn missing_path_is_not_found() {
        let dir = tempfile::tempdir().unwrap();
        let error = Workspace::open(&dir.path().join("missing")).err().unwrap();
        assert_eq!(error.kind(), ErrorKind::NotFound);
    }

    #[test]
    fn fd_path_names_the_open_file() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();
        fs::write(root.join("a.md"), "").unwrap();
        std::os::unix::fs::symlink("a.md", root.join("link.md")).unwrap();

        let file = fs::File::open(root.join("link.md")).unwrap();
        fs::rename(root.join("a.md"), root.join("b.md")).unwrap();
        assert_eq!(fd_path(&file).unwrap(), root.join("b.md"));
    }

    #[test]
    fn a_deleted_file_is_reported_deleted() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("a.md"), "").unwrap();

        let file = fs::File::open(dir.path().join("a.md")).unwrap();
        fs::remove_file(dir.path().join("a.md")).unwrap();
        assert_eq!(fd_path(&file).unwrap_err().kind(), ErrorKind::NotFound);
    }
}
