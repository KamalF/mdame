use std::hash::{DefaultHasher, Hash, Hasher};
use std::io::{self, ErrorKind, Read, Seek, Write};
use std::sync::{Mutex, PoisonError};
use std::time::{SystemTime, UNIX_EPOCH};

use cap_std::fs::{Dir, File, Metadata, OpenOptions};
use serde::Serialize;

use crate::error::io_message;
use crate::history;
use crate::render::{self, Family};

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
        "<p class=\"mdame-notice\">This file is over 1 MB, too large to show. \
         Open it in the editor.</p>"
            .to_owned()
    });
    Ok(View {
        html,
        family,
        modified: modified_secs(&metadata).unwrap_or(0),
        size,
        too_large,
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

/// The text of the file at `path`, for the editor. An image, or a file
/// that is not UTF-8, gives `Unsupported`: a lossy load would corrupt the
/// file on the next save.
pub fn source(dir: &Dir, path: &str) -> io::Result<Source> {
    let (file, metadata) = open_file(dir, path, OpenOptions::new().read(true))?;
    if Family::of(path) == Some(Family::Image) {
        return Err(not_text());
    }
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
/// A deleted file has changed too.
///
/// The file is written in place, not renamed over: its permissions and
/// hard links stay.
pub fn save(
    dir: &Dir,
    // Opening it can create it: a save that makes no snapshot must not.
    history: impl FnOnce() -> io::Result<Dir>,
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
    let (mut file, _) = match open_file(dir, path, OpenOptions::new().read(true).write(true)) {
        Err(error) if error.kind() == ErrorKind::NotFound => return Err(SaveError::Changed),
        opened => opened?,
    };
    let old = read_at_most(&file, EDIT_LIMIT)?;
    if version(&old) != base_version {
        return Err(SaveError::Changed);
    }
    // Writing over an empty file loses nothing.
    if !old.is_empty() {
        history()
            .and_then(|history| history::snapshot(&history, path, &old, now_ms()))
            .map_err(SaveError::Snapshot)?;
    }
    file.set_len(0)?;
    file.rewind()?;
    file.write_all(content.as_bytes())?;
    Ok(saved(version(content.as_bytes()), &file)?)
}

/// Creates an empty file at `path`. An existing file gives `AlreadyExists`.
/// A type that the editor cannot open, or that the tree hides, gives
/// `Unsupported`.
pub fn create(dir: &Dir, path: &str) -> io::Result<Saved> {
    if matches!(Family::of(path), None | Some(Family::Image)) {
        return Err(io::Error::new(
            ErrorKind::Unsupported,
            "not a type of text file that mdame shows",
        ));
    }
    let file = dir.open_with(path, OpenOptions::new().write(true).create_new(true))?;
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
    fn version_follows_the_content() {
        assert_eq!(version(b"# A\n"), version(b"# A\n"));
        assert_ne!(version(b"# A\n"), version(b"# B\n"));
        assert_eq!(version(b"").len(), 16);
    }
}
