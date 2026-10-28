use std::cmp::Reverse;
use std::io::{self, ErrorKind, Write};
use std::path::{Path, PathBuf};

use cap_std::ambient_authority;
use cap_std::fs::{Dir, DirBuilder, DirBuilderExt, File, OpenOptions, OpenOptionsExt};
use serde::Serialize;

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
            refuse_link(&workspace.dir, OWN_DIR)?;
            workspace.dir.create_dir_all(&history)?;
            refuse_link(&workspace.dir, &history)?;
            workspace.dir.open_dir(&history)
        }
        HistoryMode::State => {
            // A folder that cannot be made private stops the snapshot, and
            // so the save.
            config::private_folder(state_dir)?;
            let history = state_history(workspace, state_dir);
            std::fs::create_dir_all(&history)?;
            Dir::open_ambient_dir(&history, ambient_authority())
        }
    }
}

/// As `root`, but creates nothing: `None` until a save makes the folder.
pub fn open_root(
    mode: HistoryMode,
    workspace: &Workspace,
    state_dir: &Path,
) -> io::Result<Option<Dir>> {
    let opened = match mode {
        HistoryMode::Workspace => {
            let history = format!("{OWN_DIR}/history");
            refuse_link(&workspace.dir, OWN_DIR)
                .and_then(|()| refuse_link(&workspace.dir, &history))
                .and_then(|()| workspace.dir.open_dir(&history))
        }
        HistoryMode::State => {
            Dir::open_ambient_dir(state_history(workspace, state_dir), ambient_authority())
        }
    };
    match opened {
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        opened => opened.map(Some),
    }
}

/// A crafted repository may hold a link there to a folder of notes, which
/// pruning would then delete.
fn refuse_link(dir: &Dir, path: &str) -> io::Result<()> {
    if dir.symlink_metadata(path)?.is_symlink() {
        return Err(io::Error::other(format!("{path} is a link")));
    }
    Ok(())
}

fn state_history(workspace: &Workspace, state_dir: &Path) -> PathBuf {
    state_dir.join(encode_path(&workspace.root)).join("history")
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
pub fn snapshot(history: &Dir, path: &Path, content: &[u8], now_ms: u64) -> io::Result<String> {
    history.create_dir_all(path)?;
    let extension = path.extension().and_then(|ext| ext.to_str());
    let mut ms = now_ms;
    loop {
        let name = match extension {
            Some(extension) => format!("{ms}.{extension}"),
            None => ms.to_string(),
        };
        let snapshot = path.join(&name);
        let mut options = OpenOptions::new();
        // A snapshot of a private file must not be readable by others.
        options.write(true).create_new(true).mode(0o600);
        match history.open_with(&snapshot, &options) {
            Ok(mut file) => {
                // On disk before the save truncates the file: a power cut
                // must not lose both texts.
                let written = file.write_all(content).and_then(|()| file.sync_all());
                if let Err(error) = written {
                    // A partial snapshot would show as a revision.
                    let _ = history.remove_file(&snapshot);
                    return Err(error);
                }
                return Ok(name);
            }
            Err(error) if error.kind() == ErrorKind::AlreadyExists => ms += 1,
            Err(error) => return Err(error),
        }
    }
}

/// Keeps the newest `keep` snapshots of the file at `path`, and `made`,
/// the snapshot that a save just made, unless `keep` is 0. Names dated
/// later, from a clock that was ahead, must not prune it at once.
pub fn prune(history: &Dir, path: &Path, keep: usize, made: &str) -> io::Result<()> {
    for Revision { id, .. } in list(history, path)?.into_iter().skip(keep) {
        if keep > 0 && id == made {
            continue;
        }
        match history.remove_file(path.join(id)) {
            // Another mdame on this workspace pruned it first.
            Err(error) if error.kind() == ErrorKind::NotFound => {}
            removed => removed?,
        }
    }
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct Revision {
    pub id: String,
    /// Unix milliseconds, from the name.
    pub time: u64,
    pub size: u64,
}

/// The revisions of the file at `path`, newest first. A name that mdame
/// does not give a snapshot is left out: mdame did not make that file.
pub fn list(history: &Dir, path: &Path) -> io::Result<Vec<Revision>> {
    let entries = match history.read_dir(path) {
        // No save has made a snapshot of this file yet.
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(Vec::new()),
        entries => entries?,
    };
    let mut revisions = Vec::new();
    for entry in entries {
        let entry = entry?;
        let Ok(id) = entry.file_name().into_string() else {
            continue;
        };
        let Some(time) = snapshot_ms(&id) else {
            continue;
        };
        let metadata = match entry.metadata() {
            // Another mdame on this workspace pruned it since the listing.
            Err(error) if error.kind() == ErrorKind::NotFound => continue,
            metadata => metadata?,
        };
        // mdame makes snapshots as files: a folder may hold the revisions
        // of a file that `path` was a folder of. A stat, since some file
        // systems give no type in the listing.
        if metadata.is_file() {
            revisions.push(Revision {
                id,
                time,
                size: metadata.len(),
            });
        }
    }
    revisions.sort_unstable_by_key(|revision| Reverse(revision.time));
    Ok(revisions)
}

/// Opens the revision `id` of the file at `path`. Only the name of a
/// snapshot is an `id`: `../b.md/1.md` would lead to another file's.
pub fn open(history: &Dir, path: &Path, id: &str) -> io::Result<File> {
    if snapshot_ms(id).is_none() {
        return Err(no_revision());
    }
    let snapshot = path.join(id);
    // The type is checked before the open: opening a FIFO blocks until a
    // writer comes. mdame makes no link either.
    match history.symlink_metadata(&snapshot) {
        Ok(metadata) if metadata.is_file() => history.open(&snapshot),
        Err(error) if error.kind() != ErrorKind::NotFound => Err(error),
        _ => Err(no_revision()),
    }
}

pub fn no_revision() -> io::Error {
    io::Error::new(ErrorKind::NotFound, "no such revision")
}

/// The time in a snapshot's name: digits, then an optional extension,
/// with no `/` and no NUL.
fn snapshot_ms(name: &str) -> Option<u64> {
    if name.contains(['/', '\0']) {
        return None;
    }
    let digits = name.split_once('.').map_or(name, |(digits, _)| digits);
    // parse alone would also take a leading `+`.
    if !digits.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    digits.parse().ok()
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
            let name = snapshot(&history, Path::new(path), b"old", 1771271566123).unwrap();
            assert_eq!(name, expected);
            let saved = fs::read(tmp.path().join(path).join(expected)).unwrap();
            assert_eq!(saved, b"old");
        }
    }

    #[test]
    fn a_snapshot_is_readable_by_the_owner_only() {
        let tmp = tempfile::tempdir().unwrap();
        let history = Dir::open_ambient_dir(tmp.path(), ambient_authority()).unwrap();
        let name = snapshot(&history, Path::new("a.md"), b"old", 1000).unwrap();

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

        let first = snapshot(&history, Path::new("a.md"), b"one", 1000).unwrap();
        let second = snapshot(&history, Path::new("a.md"), b"two", 1000).unwrap();
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

        let error = snapshot(&history, Path::new("a.md"), b"old", 1000).unwrap_err();
        assert_eq!(error.kind(), ErrorKind::PermissionDenied);
    }

    fn names(tmp: &Path) -> Vec<String> {
        let mut names: Vec<String> = fs::read_dir(tmp.join("a.md"))
            .unwrap()
            .map(|entry| entry.unwrap().file_name().into_string().unwrap())
            .collect();
        names.sort();
        names
    }

    #[test]
    fn prune_keeps_the_newest_snapshots() {
        let tmp = tempfile::tempdir().unwrap();
        fs::create_dir(tmp.path().join("a.md")).unwrap();
        // In the order of the names, 999 would be the newest.
        for name in ["999.md", "1000.md", "1001.md"] {
            fs::write(tmp.path().join("a.md").join(name), "").unwrap();
        }
        let history = Dir::open_ambient_dir(tmp.path(), ambient_authority()).unwrap();
        prune(&history, Path::new("a.md"), 2, "").unwrap();

        assert_eq!(names(tmp.path()), ["1000.md", "1001.md"]);
    }

    #[test]
    fn prune_deletes_no_other_file() {
        let tmp = tempfile::tempdir().unwrap();
        fs::create_dir(tmp.path().join("a.md")).unwrap();
        let others = ["+5.md", ".1000.md", "12a.md", "notes.txt"];
        for name in others.iter().chain(&["1000.md", "1001"]) {
            fs::write(tmp.path().join("a.md").join(name), "").unwrap();
        }
        let history = Dir::open_ambient_dir(tmp.path(), ambient_authority()).unwrap();
        prune(&history, Path::new("a.md"), 0, "").unwrap();

        assert_eq!(names(tmp.path()), others);
    }

    #[test]
    fn prune_keeps_the_snapshot_just_made_unless_keep_is_0() {
        let tmp = tempfile::tempdir().unwrap();
        fs::create_dir(tmp.path().join("a.md")).unwrap();
        for name in ["1000.md", "5000.md", "6000.md"] {
            fs::write(tmp.path().join("a.md").join(name), "").unwrap();
        }
        let history = Dir::open_ambient_dir(tmp.path(), ambient_authority()).unwrap();
        prune(&history, Path::new("a.md"), 1, "1000.md").unwrap();
        assert_eq!(names(tmp.path()), ["1000.md", "6000.md"]);

        prune(&history, Path::new("a.md"), 0, "1000.md").unwrap();
        assert!(names(tmp.path()).is_empty());
    }

    #[test]
    fn prune_reports_a_snapshot_that_it_cannot_delete() {
        let tmp = tempfile::tempdir().unwrap();
        let folder = tmp.path().join("a.md");
        fs::create_dir(&folder).unwrap();
        fs::write(folder.join("1000.md"), "").unwrap();
        fs::set_permissions(&folder, fs::Permissions::from_mode(0o500)).unwrap();
        let history = Dir::open_ambient_dir(tmp.path(), ambient_authority()).unwrap();
        let pruned = prune(&history, Path::new("a.md"), 0, "");
        fs::set_permissions(&folder, fs::Permissions::from_mode(0o700)).unwrap();

        assert_eq!(pruned.unwrap_err().kind(), ErrorKind::PermissionDenied);
    }

    #[test]
    fn a_history_folder_that_cannot_be_searched_is_an_error() {
        let tmp = tempfile::tempdir().unwrap();
        let folder = tmp.path().join("a.md");
        fs::create_dir(&folder).unwrap();
        fs::write(folder.join("1000.md"), "").unwrap();
        // Readable, but not searchable.
        fs::set_permissions(&folder, fs::Permissions::from_mode(0o400)).unwrap();
        let history = Dir::open_ambient_dir(tmp.path(), ambient_authority()).unwrap();
        let listed = list(&history, Path::new("a.md"));
        let opened = open(&history, Path::new("a.md"), "1000.md");
        fs::set_permissions(&folder, fs::Permissions::from_mode(0o700)).unwrap();

        assert_eq!(listed.unwrap_err().kind(), ErrorKind::PermissionDenied);
        assert_eq!(opened.unwrap_err().kind(), ErrorKind::PermissionDenied);
    }

    #[test]
    fn a_folder_or_a_link_is_no_snapshot() {
        let tmp = tempfile::tempdir().unwrap();
        let folder = tmp.path().join("a.md");
        fs::create_dir_all(folder.join("1.md")).unwrap();
        fs::write(folder.join("1000.md"), "").unwrap();
        std::os::unix::fs::symlink("1000.md", folder.join("1001.md")).unwrap();
        let history = Dir::open_ambient_dir(tmp.path(), ambient_authority()).unwrap();

        let ids: Vec<String> = list(&history, Path::new("a.md"))
            .unwrap()
            .into_iter()
            .map(|revision| revision.id)
            .collect();
        assert_eq!(ids, ["1000.md"]);
        prune(&history, Path::new("a.md"), 0, "").unwrap();
        assert_eq!(names(tmp.path()), ["1.md", "1001.md"]);
    }

    #[test]
    fn a_history_that_cannot_be_read_is_an_error_not_an_empty_list() {
        let (tmp, workspace) = workspace();
        fs::create_dir(tmp.path().join(".mdame")).unwrap();
        fs::write(tmp.path().join(".mdame/history"), "").unwrap();
        let opened = open_root(HistoryMode::Workspace, &workspace, Path::new("/unused"));
        assert_eq!(opened.unwrap_err().kind(), ErrorKind::NotADirectory);

        let history = Dir::open_ambient_dir(tmp.path(), ambient_authority()).unwrap();
        fs::write(tmp.path().join("a.md"), "").unwrap();
        let listed = list(&history, Path::new("a.md"));
        assert_eq!(listed.unwrap_err().kind(), ErrorKind::NotADirectory);
    }
}
