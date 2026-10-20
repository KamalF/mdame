use std::io::{self, ErrorKind, Write};
use std::path::Path;

use cap_std::ambient_authority;
use cap_std::fs::{Dir, OpenOptions};

use crate::config::HistoryMode;
use crate::workspace::{OWN_DIR, Workspace};

/// Creates the folder if it is missing.
pub fn root(mode: HistoryMode, workspace: &Workspace, state_dir: &Path) -> io::Result<Dir> {
    match mode {
        HistoryMode::Workspace => {
            match workspace.dir.create_dir(OWN_DIR) {
                Ok(()) => workspace
                    .dir
                    .write(format!("{OWN_DIR}/.gitignore"), "*\n")?,
                Err(error) if error.kind() == ErrorKind::AlreadyExists => {}
                Err(error) => return Err(error),
            }
            let history = format!("{OWN_DIR}/history");
            workspace.dir.create_dir_all(&history)?;
            workspace.dir.open_dir(&history)
        }
        HistoryMode::State => {
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
        options.write(true).create_new(true);
        match history.open_with(format!("{path}/{name}"), &options) {
            Ok(mut file) => {
                file.write_all(content)?;
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
    fn two_snapshots_in_the_same_millisecond_are_both_kept() {
        let tmp = tempfile::tempdir().unwrap();
        let history = Dir::open_ambient_dir(tmp.path(), ambient_authority()).unwrap();

        let first = snapshot(&history, "a.md", b"one", 1000).unwrap();
        let second = snapshot(&history, "a.md", b"two", 1000).unwrap();
        assert_eq!((first.as_str(), second.as_str()), ("1000.md", "1001.md"));
        assert_eq!(fs::read(tmp.path().join("a.md/1000.md")).unwrap(), b"one");
        assert_eq!(fs::read(tmp.path().join("a.md/1001.md")).unwrap(), b"two");
    }
}
