use std::hash::{DefaultHasher, Hash, Hasher};
use std::io::{self, ErrorKind, Read, Seek, Write};
use std::os::fd::AsFd;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, PoisonError};
use std::time::{SystemTime, UNIX_EPOCH};

use cap_std::fs::{Dir, File, Metadata, MetadataExt, OpenOptions};
use serde::Serialize;

use crate::error::io_message;
use crate::history::{self, Revision};
use crate::render::{self, Family};
use crate::workspace::{fd_path, is_hidden};

/// Bigger files are not rendered: the page would freeze. The editor can
/// still open them.
pub const RENDER_LIMIT: u64 = 1024 * 1024;

/// `/raw` reads a file whole, into memory.
pub const RAW_LIMIT: u64 = 64 * 1024 * 1024;

pub const EDIT_LIMIT: u64 = 8 * 1024 * 1024;

#[derive(Debug, Serialize)]
pub struct View {
    pub html: String,
    pub family: Family,
    pub modified: u64,
    pub size: u64,
    pub too_large: bool,
    /// Whether the page offers the editor. The editor's routes check again,
    /// on the open file.
    pub editable: bool,
}

/// The rendered file at `path`, relative to the workspace root. A file
/// that exists with no family gives `Unsupported`.
pub fn view(dir: &Dir, path: &str) -> io::Result<View> {
    let (file, metadata) = open_file(dir, path, OpenOptions::new().read(true))?;
    let family = Family::of(path).ok_or_else(not_viewable)?;
    let size = metadata.len();
    let html = match family {
        Family::Image => Some(render::file(family, path, "")),
        _ if size > RENDER_LIMIT => None,
        _ => match read_at_most(&file, RENDER_LIMIT) {
            Ok(bytes) => Some(render::file(family, path, &String::from_utf8_lossy(&bytes))),
            Err(error) if error.kind() == ErrorKind::FileTooLarge => None,
            Err(error) => return Err(error),
        },
    };
    let too_large = html.is_none();
    let html = html.unwrap_or_else(|| {
        let notice = if size > EDIT_LIMIT {
            "This file is over 8 MB, too large to show or to edit."
        } else {
            "This file is over 1 MB, too large to show. Open it in the editor."
        };
        format!("<p class=\"mdame-notice\">{notice}</p>")
    });
    Ok(View {
        html,
        family,
        modified: modified_secs(&metadata).unwrap_or(0),
        size,
        too_large,
        editable: editable_name(Path::new(path)).is_ok() && size <= EDIT_LIMIT,
    })
}

/// The editor's preview: `text` as the view would show it at `path`.
pub fn preview(path: &str, text: &str) -> io::Result<String> {
    let family = Family::of(path).ok_or_else(not_viewable)?;
    if text.len() as u64 > RENDER_LIMIT {
        return Ok(
            "<p class=\"mdame-notice\">This file is over 1 MB, too large to preview.</p>"
                .to_owned(),
        );
    }
    Ok(render::file(family, path, text))
}

fn not_viewable() -> io::Error {
    io::Error::new(ErrorKind::Unsupported, "not a viewable file")
}

/// The bytes of the file at `path` and the type to serve them with. Over
/// `RAW_LIMIT` gives `FileTooLarge`.
pub fn raw(dir: &Dir, path: &str) -> io::Result<(Vec<u8>, &'static str)> {
    let (file, metadata) = open_file(dir, path, OpenOptions::new().read(true))?;
    if metadata.len() > RAW_LIMIT {
        return Err(too_large());
    }
    Ok((read_at_most(&file, RAW_LIMIT)?, render::raw_type(path)))
}

#[derive(Debug, Serialize)]
pub struct Source {
    pub content: String,
    /// Sent in the `ETag` header.
    #[serde(skip)]
    pub version: String,
    pub modified: u64,
}

/// The text of the file at `path`, for the editor. A file that the editor
/// may not open, or that is not UTF-8, gives `Unsupported`: a lossy load
/// would corrupt the file on the next save.
pub fn source(dir: &Dir, path: &str) -> io::Result<Source> {
    let (file, metadata, _) = open_editable(dir, path, OpenOptions::new().read(true))?;
    if metadata.len() > EDIT_LIMIT {
        return Err(too_large());
    }
    let bytes = read_at_most(&file, EDIT_LIMIT)?;
    let version = version(&bytes);
    let content = String::from_utf8(bytes).map_err(|_| not_text())?;
    Ok(Source {
        content,
        version,
        modified: modified_secs(&metadata).unwrap_or(0),
    })
}

/// The revisions of the file at `path`, newest first. `history` is `None`
/// while no save has made the history folder.
pub fn revisions(dir: &Dir, history: Option<&Dir>, path: &str) -> io::Result<Vec<Revision>> {
    let (_, _, real) = open_editable(dir, path, OpenOptions::new().read(true))?;
    match history {
        Some(history) => history::list(history, &real),
        None => Ok(Vec::new()),
    }
}

/// The text of the revision `id` of the file at `path`.
pub fn revision(dir: &Dir, history: Option<&Dir>, path: &str, id: &str) -> io::Result<String> {
    let (_, _, real) = open_editable(dir, path, OpenOptions::new().read(true))?;
    let history = history.ok_or_else(history::no_revision)?;
    String::from_utf8(history::read(history, &real, id)?).map_err(|_| not_text())
}

pub fn version(bytes: &[u8]) -> String {
    let mut hasher = DefaultHasher::new();
    bytes.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

#[derive(Debug, thiserror::Error)]
pub enum SaveError {
    #[error("the file changed on disk")]
    Changed,
    /// Nothing was written: the file keeps its content.
    #[error("cannot keep the old version in the history folder: {}", io_message(.0))]
    Snapshot(io::Error),
    #[error(transparent)]
    Io(#[from] io::Error),
}

#[derive(Debug, Serialize)]
pub struct Saved {
    /// Sent in the `ETag` header.
    #[serde(skip)]
    pub version: String,
    pub modified: u64,
}

/// Two saves of one file from the same version would both pass the check,
/// and their writes could mix: saves run one at a time.
static SAVES: Mutex<()> = Mutex::new(());

/// Writes `content` to `path` if the file on disk still has `base_version`,
/// after a snapshot of the old content in the folder that `history` opens.
/// That folder then keeps the newest `keep` snapshots of the file. A
/// deleted file has changed too.
///
/// The file is written in place, not renamed over: its permissions and
/// hard links stay.
pub fn save(
    dir: &Dir,
    // Opening it can create it: a save that makes no snapshot must not.
    history: impl FnOnce() -> io::Result<Dir>,
    keep: usize,
    path: &str,
    content: &str,
    base_version: &str,
) -> Result<Saved, SaveError> {
    if content.len() as u64 > EDIT_LIMIT {
        return Err(too_large().into());
    }
    let _one_at_a_time = SAVES.lock().unwrap_or_else(PoisonError::into_inner);
    // One handle for the check and the write: a file that mdame may not
    // write fails before the snapshot, and the write goes to the file whose
    // version was checked.
    let (mut file, _, real) =
        match open_editable(dir, path, OpenOptions::new().read(true).write(true)) {
            // A folder of the path that is now a file gives NotADirectory.
            Err(error)
                if matches!(error.kind(), ErrorKind::NotFound | ErrorKind::NotADirectory) =>
            {
                return Err(SaveError::Changed);
            }
            opened => opened?,
        };
    let old = read_at_most(&file, EDIT_LIMIT)?;
    if version(&old) != base_version {
        return Err(SaveError::Changed);
    }
    // Ctrl+S pressed out of habit would fill the history with copies of the
    // file and push the real revisions out.
    if old == content.as_bytes() {
        return Ok(saved(base_version.to_owned(), &file)?);
    }
    // Writing over an empty file loses nothing.
    let history = if old.is_empty() {
        None
    } else {
        let history = history().map_err(SaveError::Snapshot)?;
        history::snapshot(&history, &real, &old, now_ms()).map_err(SaveError::Snapshot)?;
        Some(history)
    };
    // A program that saves by renaming a new file over the path may have
    // done so during the snapshot: the text written to the old file would
    // then be in no file.
    if !is_at(dir, path, &file) {
        return Err(SaveError::Changed);
    }
    file.set_len(0)?;
    file.rewind()?;
    file.write_all(content.as_bytes())?;
    // After the write: with `keep` at 0, the snapshot must still cover a
    // crash during the write.
    if let Some(history) = history
        && let Err(error) = history::prune(&history, &real, keep)
    {
        // The file is saved: only old revisions are left over.
        let real = real.display();
        tracing::warn!("old revisions not deleted: {real}: {}", io_message(&error));
    }
    Ok(saved(version(content.as_bytes()), &file)?)
}

/// Saves the revision `id` over the file at `path`. The save keeps the
/// current content as a revision, so the restore can be undone.
pub fn restore(
    dir: &Dir,
    history: Option<&Dir>,
    keep: usize,
    path: &str,
    id: &str,
) -> Result<Saved, SaveError> {
    let history = history.ok_or_else(history::no_revision)?;
    let text = revision(dir, Some(history), path, id)?;
    // A write by another program after this read makes the save refuse.
    let current = source(dir, path)?.version;
    save(dir, || history.try_clone(), keep, path, &text, &current)
}

/// Creates an empty file at `path`. An existing file gives `AlreadyExists`.
/// A type that the editor cannot open, or that the tree hides, gives
/// `Unsupported`.
pub fn create(dir: &Dir, path: &str) -> io::Result<Saved> {
    if Path::new(path).is_absolute() {
        return Err(outside());
    }
    editable_name(Path::new(path))?;
    // Created through a handle on its folder: a folder swapped after the
    // check cannot move the new file.
    let (folder, name) = match path.rsplit_once('/') {
        Some((folder, name)) => (dir.open_dir(folder)?, name),
        None => (dir.try_clone()?, path),
    };
    editable_name(&real_path(dir, &folder)?.join(name))?;
    let file = folder.open_with(name, OpenOptions::new().write(true).create_new(true))?;
    saved(version(b""), &file)
}

fn saved(version: String, file: &File) -> io::Result<Saved> {
    let modified = modified_secs(&file.metadata()?).unwrap_or(0);
    Ok(Saved { version, modified })
}

fn now_ms() -> u64 {
    let now = SystemTime::now().duration_since(UNIX_EPOCH);
    now.expect("the clock is after 1970").as_millis() as u64
}

/// The editor opens, saves and creates the text types that the view shows,
/// outside the hidden folders that the tree leaves out, such as `.git`,
/// `.mdame` or `.claude`: a leaked token then cannot rewrite `.git/config`,
/// an agent's settings or a snapshot. The name asked counts, and so does
/// where the open file is: a link, or an entry swapped during the request,
/// may lead from `notes.md` to `.git/config`.
///
/// Also gives where the file is: its revisions go under that path, so that
/// a link or a `..` does not split them.
fn open_editable(
    dir: &Dir,
    path: &str,
    options: &OpenOptions,
) -> io::Result<(File, Metadata, PathBuf)> {
    let (file, metadata) = open_file(dir, path, options)?;
    editable_name(Path::new(path))?;
    let real = real_path(dir, &file)?;
    match editable_name(&real) {
        // A program that saves by renaming a new file over the path did so
        // after the open. The kernel now names the open file "… (deleted)".
        Err(_) if !is_at(dir, path, &file) => open_editable(dir, path, options),
        checked => checked.map(|()| (file, metadata, real)),
    }
}

/// Whether `path` still leads to the open `file`.
fn is_at(dir: &Dir, path: &str, file: &File) -> bool {
    let (Ok(opened), Ok(on_path)) = (file.metadata(), dir.metadata(path)) else {
        return false;
    };
    (opened.dev(), opened.ino()) == (on_path.dev(), on_path.ino())
}

/// Where `handle` is, relative to the workspace root, as the kernel knows it.
/// The path asked may lead elsewhere, through a link or a swapped entry.
fn real_path(dir: &Dir, handle: &impl AsFd) -> io::Result<PathBuf> {
    let root = fd_path(dir)?;
    let path = fd_path(handle)?;
    match path.strip_prefix(&root) {
        Ok(relative) => Ok(relative.to_path_buf()),
        Err(_) => Err(outside()),
    }
}

/// As cap-std refuses a path out: no OS error code, so the API says
/// "path outside the workspace".
fn outside() -> io::Error {
    io::Error::new(ErrorKind::PermissionDenied, "outside the workspace")
}

fn editable_name(path: &Path) -> io::Result<()> {
    if is_hidden(path) {
        return Err(io::Error::new(
            ErrorKind::Unsupported,
            "mdame does not edit hidden files or files in hidden folders",
        ));
    }
    let family = path.to_str().and_then(Family::of);
    if matches!(family, None | Some(Family::Image)) {
        return Err(io::Error::new(
            ErrorKind::Unsupported,
            "not a type of text file that mdame edits",
        ));
    }
    Ok(())
}

fn not_text() -> io::Error {
    io::Error::new(ErrorKind::Unsupported, "not a UTF-8 text file")
}

/// The type is checked before the open: opening a FIFO blocks until a
/// writer comes, maybe never.
fn open_file(dir: &Dir, path: &str, options: &OpenOptions) -> io::Result<(File, Metadata)> {
    let metadata = dir.metadata(path)?;
    if !metadata.is_file() {
        return Err(io::Error::new(ErrorKind::NotFound, "not a file"));
    }
    Ok((dir.open_with(path, options)?, metadata))
}

/// The file can grow after its size was checked: read one byte more than
/// `limit` at most, and refuse it then.
fn read_at_most(file: &File, limit: u64) -> io::Result<Vec<u8>> {
    let mut bytes = Vec::new();
    file.take(limit + 1).read_to_end(&mut bytes)?;
    if bytes.len() as u64 > limit {
        return Err(too_large());
    }
    Ok(bytes)
}

fn too_large() -> io::Error {
    io::Error::new(ErrorKind::FileTooLarge, "file too large")
}

/// Unix seconds, or `None` where the OS gives no modified time.
pub fn modified_secs(metadata: &Metadata) -> Option<u64> {
    let modified = metadata.modified().ok()?.into_std();
    Some(modified.duration_since(UNIX_EPOCH).ok()?.as_secs())
}

#[cfg(test)]
mod tests {
    use super::*;
    use cap_std::ambient_authority;
    use std::sync::atomic::{AtomicBool, Ordering};

    #[test]
    fn read_at_most_refuses_a_file_over_the_limit() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(tmp.path().join("a.txt"), "abcd").unwrap();
        let dir = Dir::open_ambient_dir(tmp.path(), ambient_authority()).unwrap();

        let bytes = read_at_most(&dir.open("a.txt").unwrap(), 4).unwrap();
        assert_eq!(bytes, b"abcd");
        let error = read_at_most(&dir.open("a.txt").unwrap(), 3).unwrap_err();
        assert_eq!(error.kind(), ErrorKind::FileTooLarge);
    }

    #[test]
    fn two_saves_from_one_version_let_one_through() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::create_dir(tmp.path().join("history")).unwrap();
        let dir = Dir::open_ambient_dir(tmp.path(), ambient_authority()).unwrap();
        let history = dir.open_dir("history").unwrap();
        let contents = ["a".repeat(1 << 20), "b".repeat(1 << 20)];
        // Without the lock, both saves pass the check in most rounds.
        for _ in 0..20 {
            dir.write("a.md", "old\n").unwrap();
            let barrier = std::sync::Barrier::new(2);
            let saved = std::thread::scope(|scope| {
                let saves = contents.clone().map(|content| {
                    let (dir, history, barrier) = (&dir, &history, &barrier);
                    scope.spawn(move || {
                        barrier.wait();
                        save(
                            dir,
                            || history.try_clone(),
                            20,
                            "a.md",
                            &content,
                            &version(b"old\n"),
                        )
                    })
                });
                saves.map(|save| save.join().unwrap().is_ok())
            });

            assert_eq!(saved.iter().filter(|ok| **ok).count(), 1);
            assert!(contents.contains(&dir.read_to_string("a.md").unwrap()));
        }
    }

    #[test]
    fn a_file_renamed_over_during_the_save_is_left_alone() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::create_dir(tmp.path().join("history")).unwrap();
        let dir = Dir::open_ambient_dir(tmp.path(), ambient_authority()).unwrap();
        dir.write("a.md", "old\n").unwrap();
        // Another editor saves by rename while mdame opens the history.
        let history = || {
            dir.write("new.md", "theirs\n")?;
            dir.rename("new.md", &dir, "a.md")?;
            dir.open_dir("history")
        };
        let saved = save(&dir, history, 20, "a.md", "ours\n", &version(b"old\n"));

        assert!(matches!(saved, Err(SaveError::Changed)));
        assert_eq!(dir.read_to_string("a.md").unwrap(), "theirs\n");
    }

    #[test]
    fn a_file_renamed_over_after_the_open_is_opened_again() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = Dir::open_ambient_dir(tmp.path(), ambient_authority()).unwrap();
        dir.write("a.md", "old\n").unwrap();
        let stop = AtomicBool::new(false);
        let failed = std::thread::scope(|scope| {
            // Another editor saves by rename, again and again.
            scope.spawn(|| {
                while !stop.load(Ordering::Relaxed) {
                    dir.write("new.md", "theirs\n").unwrap();
                    dir.rename("new.md", &dir, "a.md").unwrap();
                }
            });
            // Without the second open, about one in three fails.
            let failed = (0..2000).filter_map(|_| source(&dir, "a.md").err()).next();
            stop.store(true, Ordering::Relaxed);
            failed
        });

        assert!(failed.is_none(), "{failed:?}");
    }

    #[test]
    fn version_follows_the_content() {
        assert_eq!(version(b"# A\n"), version(b"# A\n"));
        assert_ne!(version(b"# A\n"), version(b"# B\n"));
        assert_eq!(version(b"").len(), 16);
    }
}
