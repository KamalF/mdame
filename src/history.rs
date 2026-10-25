use std::io::{self, ErrorKind, Write};
use std::path::Path;

use cap_std::ambient_authority;
use cap_std::fs::{Dir, DirBuilder, DirBuilderExt, OpenOptions, OpenOptionsExt};

use crate::config::{self, HistoryMode};
use crate::workspace::{OWN_DIR, Workspace};

/// Creates the folder if it is missing.
pub fn root(mode: HistoryMode, workspace: &Workspace, state_dir: &Path) -> io::Result<Dir> {
    match mode {
        HistoryMode::Workspace => {
            // Any other error than an existing folder comes back from
            // create_dir_all below.
            // Only the owner may list it: its folders follow the workspace's
            // file names, also those in a private folder.
            let mut private = DirBuilder::new();
            private.mode(0o700);
            if workspace.dir.create_dir_with(OWN_DIR, &private).is_ok() {
                // create_new follows no link that another program may have
                // put there since the folder appeared.
                let mut options = OpenOptions::new();
                options.write(true).create_new(true);
                match workspace
                    .dir
                    .open_with(format!("{OWN_DIR}/.gitignore"), &options)
                {
                    Ok(mut file) => file.write_all(b"*\n")?,
                    Err(error) if error.kind() == ErrorKind::AlreadyExists => {}
                    Err(error) => return Err(error),
                }
            }
            let history = format!("{OWN_DIR}/history");
            workspace.dir.create_dir_all(&history)?;
            workspace.dir.open_dir(&history)
        }
        HistoryMode::State => {
            // A folder that cannot be made private stops the snapshot, and
            // so the save.
            config::private_folder(state_dir)?;
            let history = state_dir.join(encode_path(&workspace.root)).join("history");
            std::fs::create_dir_all(&history)?;
            Dir::open_ambient_dir(&history, ambient_authority())
        }
    }
}

pub fn encode_path(path: &Path) -> String {
    path.to_string_lossy()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect()
}

/// Returns the snapshot's name. Two mdame on one workspace can save the
/// same file in the same millisecond: the later snapshot takes the next
/// free millisecond.
pub fn snapshot(history: &Dir, path: &str, content: &[u8], now_ms: u64) -> io::Result<String> {
    history.create_dir_all(path)?;
    let extension = Path::new(path).extension().and_then(|ext| ext.to_str());
    let mut ms = now_ms;
    loop {
        let name = match extension {
            Some(extension) => format!("{ms}.{extension}"),
            None => ms.to_string(),
        };
        let mut options = OpenOptions::new();
        // A snapshot of a private file must not be readable by others.
        options.write(true).create_new(true).mode(0o600);
        match history.open_with(format!("{path}/{name}"), &options) {
            Ok(mut file) => {
                // On disk before the save truncates the file: a power cut
                // must not lose both texts.
                let written = file.write_all(content).and_then(|()| file.sync_all());
                if let Err(error) = written {
                    // A partial snapshot would show as a revision.
                    let _ = history.remove_file(format!("{path}/{name}"));
                    return Err(error);
                }
                return Ok(name);
            }
            Err(error) if error.kind() == ErrorKind::AlreadyExists => ms += 1,
            Err(error) => return Err(error),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::os::unix::fs::PermissionsExt;

    fn workspace() -> (tempfile::TempDir, Workspace) {
        let tmp = tempfile::tempdir().unwrap();
        let workspace = Workspace::open(tmp.path()).unwrap();
        (tmp, workspace)
    }

    #[test]
    fn workspace_mode_keeps_history_in_dot_mdame() {
        let (tmp, workspace) = workspace();
        let history = root(HistoryMode::Workspace, &workspace, Path::new("/unused")).unwrap();

        history.write("probe", "").unwrap();
        assert!(tmp.path().join(".mdame/history/probe").exists());
    }

    #[test]
    fn creating_dot_mdame_writes_its_gitignore() {
        let (tmp, workspace) = workspace();
        root(HistoryMode::Workspace, &workspace, Path::new("/unused")).unwrap();

        let gitignore = fs::read_to_string(tmp.path().join(".mdame/.gitignore")).unwrap();
        assert_eq!(gitignore, "*\n");
        let mode = fs::metadata(tmp.path().join(".mdame"))
            .unwrap()
            .permissions()
            .mode();
        assert_eq!(mode & 0o777, 0o700);
    }

    #[test]
    fn an_existing_dot_mdame_is_left_as_it_is() {
        let (tmp, workspace) = workspace();
        fs::create_dir(tmp.path().join(".mdame")).unwrap();
        root(HistoryMode::Workspace, &workspace, Path::new("/unused")).unwrap();

        assert!(!tmp.path().join(".mdame/.gitignore").exists());
    }

    #[test]
    fn state_mode_keeps_history_under_the_encoded_workspace_path() {
        let (tmp, workspace) = workspace();
        let state = tempfile::tempdir().unwrap();
        let history = root(HistoryMode::State, &workspace, state.path()).unwrap();

        history.write("probe", "").unwrap();
        let expected = state
            .path()
            .join(encode_path(&workspace.root))
            .join("history/probe");
        assert!(expected.exists());
        assert!(!tmp.path().join(".mdame").exists());
    }

    #[test]
    fn encode_path_replaces_every_non_alphanumeric_with_a_dash() {
        let cases = [
            (
                "/home/kamal/dev/github/mdame",
                "-home-kamal-dev-github-mdame",
            ),
            ("/a/b-c", "-a-b-c"),
            ("/a-b/c", "-a-b-c"),
            ("/notes/été 2026", "-notes--t--2026"),
        ];
        for (path, expected) in cases {
            assert_eq!(encode_path(Path::new(path)), expected, "{path}");
        }
    }

    #[test]
    fn snapshot_goes_under_the_file_path_named_by_the_time() {
        let tmp = tempfile::tempdir().unwrap();
        let history = Dir::open_ambient_dir(tmp.path(), ambient_authority()).unwrap();
        let cases = [
            ("api/rate-limiting.md", "1771271566123.md"),
            ("Makefile", "1771271566123"),
        ];
        for (path, expected) in cases {
            let name = snapshot(&history, path, b"old", 1771271566123).unwrap();
            assert_eq!(name, expected);
            let saved = fs::read(tmp.path().join(path).join(expected)).unwrap();
            assert_eq!(saved, b"old");
        }
    }

    #[test]
    fn a_snapshot_is_readable_by_the_owner_only() {
        let tmp = tempfile::tempdir().unwrap();
        let history = Dir::open_ambient_dir(tmp.path(), ambient_authority()).unwrap();
        let name = snapshot(&history, "a.md", b"old", 1000).unwrap();

        let mode = fs::metadata(tmp.path().join("a.md").join(name))
            .unwrap()
            .permissions()
            .mode();
        assert_eq!(mode & 0o777, 0o600);
    }

    #[test]
    fn two_snapshots_in_the_same_millisecond_are_both_kept() {
        let tmp = tempfile::tempdir().unwrap();
        let history = Dir::open_ambient_dir(tmp.path(), ambient_authority()).unwrap();

        let first = snapshot(&history, "a.md", b"one", 1000).unwrap();
        let second = snapshot(&history, "a.md", b"two", 1000).unwrap();
        assert_eq!((first.as_str(), second.as_str()), ("1000.md", "1001.md"));
        assert_eq!(fs::read(tmp.path().join("a.md/1000.md")).unwrap(), b"one");
        assert_eq!(fs::read(tmp.path().join("a.md/1001.md")).unwrap(), b"two");
    }

    #[test]
    fn a_snapshot_that_cannot_be_written_gives_the_error() {
        let tmp = tempfile::tempdir().unwrap();
        fs::create_dir(tmp.path().join("a.md")).unwrap();
        fs::set_permissions(tmp.path().join("a.md"), fs::Permissions::from_mode(0o555)).unwrap();
        let history = Dir::open_ambient_dir(tmp.path(), ambient_authority()).unwrap();

        let error = snapshot(&history, "a.md", b"old", 1000).unwrap_err();
        assert_eq!(error.kind(), ErrorKind::PermissionDenied);
    }
}
