use std::collections::BTreeMap;
use std::io::BufRead;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
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

/// On 15,000 folders, 4 threads walk in 0.19 s, and 12 in 0.12 s. But each
/// thread can compile a crafted ignore file: see `MAX_IGNORE_BYTES`.
const WALK_THREADS: usize = 4;

/// One walk at a time: `MAX_IGNORE_BYTES` then bounds the memory of all the
/// walks, not of each one.
static WALKING: Mutex<()> = Mutex::new(());

/// The files that the walker reads in each folder, for its ignore rules.
/// It also reads git's `info/exclude`: see `check_git_exclude`.
const IGNORE_FILES: [&str; 2] = [".gitignore", ".ignore"];

/// Crafted patterns cost memory as the square of their number when the
/// walker matches a name against them: 32 KiB of `?N` lines asked for 8 GB.
/// The largest real ones, in Chromium and Firefox, hold 10 KB.
const MAX_IGNORE_FILE: u64 = 16 * 1024;

/// The ignore files that one walk reads, in bytes. The walker builds the
/// globs of up to `WALK_THREADS` files at once, at about 700 times their
/// size for crafted patterns, and keeps those of each folder above the one
/// that it reads.
const MAX_IGNORE_BYTES: u64 = 1024 * 1024;

/// The ignore file of `folder` that the walker must not read, and why, if
/// any. Through links, each must be a regular file of 16 KiB at most, and
/// its path must not enter a pseudo file system of the kernel. Otherwise
/// the walker could read without end: a FIFO blocks, `/dev/zero` never
/// ends, and `/proc/self/pagemap` says 0 bytes but holds gigabytes. A
/// cloned repository can hold a link to any of them. `read` adds up the
/// bytes that the walk reads, up to `MAX_IGNORE_BYTES`.
fn bad_ignore_file(
    folder: &Path,
    read: &AtomicU64,
    devices: &Devices,
) -> Option<(PathBuf, &'static str)> {
    let base = match Base::open(folder, devices) {
        Ok(base) => base,
        Err(error) if missing(&error) => return None,
        Err(_) => return Some((folder.to_owned(), UNCHECKED)),
    };
    let size = IGNORE_FILES
        .iter()
        .map(|name| check(&base, Path::new(name)))
        .chain(std::iter::once_with(|| check_git_exclude(&base)))
        .sum::<Result<u64, _>>();
    let size = match size {
        Ok(size) => size,
        Err(bad) => return Some(bad),
    };
    let past_budget = size > 0 && read.fetch_add(size, Ordering::Relaxed) + size > MAX_IGNORE_BYTES;
    past_budget.then(|| {
        let why = "has ignore files past the 1 MiB that one walk reads";
        (folder.to_owned(), why)
    })
}

/// Whether `error` stops the walker too, so that the file counts as
/// missing. Another error, such as a lack of file descriptors, may be gone
/// when the walker opens the file: the check then refuses it.
fn missing(error: &std::io::Error) -> bool {
    use std::io::ErrorKind;
    let looped = error.raw_os_error() == Some(rustix::io::Errno::LOOP.raw_os_error());
    looped
        || matches!(
            error.kind(),
            ErrorKind::NotFound
                | ErrorKind::NotADirectory
                | ErrorKind::PermissionDenied
                | ErrorKind::InvalidFilename
                // A NUL in a path, which the walker's open refuses too.
                | ErrorKind::InvalidInput
        )
}

const UNCHECKED: &str = "could not be checked, for example for lack of file descriptors";

/// The size of `path`, from `base`, 0 if it is missing.
fn check(base: &Base, path: &Path) -> Result<u64, (PathBuf, &'static str)> {
    find(base, path)
        .and_then(|file| file.map_or(Ok(0), |file| judge(&file)))
        .map_err(|why| (base.path.join(path), why))
}

fn judge(file: &Found) -> Result<u64, &'static str> {
    if !file.regular {
        Err("is not a regular file")
    } else if file.len > MAX_IGNORE_FILE {
        Err("is over 16 KiB")
    } else {
        Ok(file.len)
    }
}

/// What `check` needs to know of a file, through links.
struct Found {
    regular: bool,
    len: u64,
}

/// The folder that `find` starts from, opened once for all the files that
/// it checks there.
struct Base<'a> {
    path: &'a Path,
    devices: &'a Devices,
    #[cfg(target_os = "linux")]
    fd: rustix::fd::OwnedFd,
    #[cfg(target_os = "linux")]
    on_kernel_file_system: bool,
}

impl<'a> Base<'a> {
    #[cfg(target_os = "linux")]
    fn open(path: &'a Path, devices: &'a Devices) -> std::io::Result<Base<'a>> {
        use rustix::fs::{CWD, Mode, OFlags, fstat, openat};
        let flags = OFlags::PATH | OFlags::DIRECTORY | OFlags::CLOEXEC;
        let fd = openat(CWD, path, flags, Mode::empty())?;
        let device = fstat(&fd)?.st_dev;
        Ok(Base {
            path,
            devices,
            on_kernel_file_system: devices.of_kernel(device, &fd),
            fd,
        })
    }

    #[cfg(not(target_os = "linux"))]
    fn open(path: &'a Path, devices: &'a Devices) -> std::io::Result<Base<'a>> {
        Ok(Base { path, devices })
    }
}

/// The verdicts of `on_kernel_file_system` for the devices that one walk
/// meets: `fstatfs` costs a round trip to the server on NFS. A file system
/// mounted elsewhere, or a file mounted on its own, has its own device.
#[derive(Default)]
struct Devices(#[cfg(target_os = "linux")] Mutex<Vec<(u64, bool)>>);

#[cfg(target_os = "linux")]
impl Devices {
    fn known(&self, device: u64) -> Option<bool> {
        let known = self.0.lock().unwrap_or_else(PoisonError::into_inner);
        known
            .iter()
            .find(|&&(seen, _)| seen == device)
            .map(|&(_, kernel)| kernel)
    }

    /// `file` is on `device`.
    fn of_kernel(&self, device: u64, file: &rustix::fd::OwnedFd) -> bool {
        self.known(device).unwrap_or_else(|| {
            let kernel = on_kernel_file_system(file);
            let mut known = self.0.lock().unwrap_or_else(PoisonError::into_inner);
            known.push((device, kernel));
            kernel
        })
    }
}

/// procfs, sysfs, tracefs or debugfs, whose files can say 0 bytes and hold
/// gigabytes, or block. By the type of the file system, not the path: a
/// container may mount the host's procfs at `/run/host/proc`. Before Linux
/// 3.12, `fstatfs` refuses an `O_PATH` descriptor: its path in procfs
/// serves then. If neither works, the file system counts as the kernel's.
#[cfg(target_os = "linux")]
fn on_kernel_file_system(file: &rustix::fd::OwnedFd) -> bool {
    use rustix::fd::AsRawFd;
    use rustix::fs::{FsWord, PROC_SUPER_MAGIC, fstatfs, statfs};
    const SYSFS: FsWord = 0x6265_6572;
    const TRACEFS: FsWord = 0x7472_6163;
    const DEBUGFS: FsWord = 0x6462_6720;
    fstatfs(file)
        .or_else(|_| statfs(format!("/proc/self/fd/{}", file.as_raw_fd()).as_str()))
        .map_or(true, |fs| {
            [PROC_SUPER_MAGIC, SYSFS, TRACEFS, DEBUGFS].contains(&(fs.f_type as FsWord))
        })
}

/// `None` if `path`, from `base`, is missing. Follows the path one name at
/// a time, and each link by hand, as the kernel would, and refuses it as
/// soon as it enters a file system of the kernel, even where the next name
/// is missing. In procfs, `/proc/self/fd/<n>` names a folder of the process
/// that opens it, if any, so the walker could open another file than the
/// one checked, or one that is missing now. Elsewhere, the files of a
/// cloned repository stay as they are, and the walker opens the same file.
#[cfg(target_os = "linux")]
fn find(base: &Base, path: &Path) -> Result<Option<Found>, &'static str> {
    use rustix::fd::{AsFd, OwnedFd};
    use rustix::fs::{AtFlags, FileType, Mode, OFlags, openat, readlinkat, statat};
    use std::borrow::Cow;
    use std::ffi::{OsStr, OsString};
    use std::os::unix::ffi::OsStrExt;
    use std::path::Component;
    const REFUSED: &str = "leads into a file system of the kernel, such as procfs";
    // More than a real path needs. Each name costs a system call or more,
    // some 40 times what the kernel's own resolution costs on a local disk,
    // and a crafted link can name itself through thousands of names.
    const MAX_NAMES: usize = 256;
    const TOO_MANY: &str = "takes more than 256 names to reach, links included";
    let gone = |error: rustix::io::Errno| match missing(&error.into()) {
        true => Ok(None),
        false => Err(UNCHECKED),
    };
    if base.on_kernel_file_system {
        return Err(REFUSED);
    }
    // `None` while in `base`.
    let mut folder: Option<OwnedFd> = None;
    let mut names = path.components();
    // The names of the links on the way, before the rest of `names`: the
    // next one last.
    let mut detour: Vec<OsString> = Vec::new();
    let mut links = 0;
    let mut walked = 0;
    loop {
        let name = match detour.pop() {
            Some(name) => Cow::Owned(name),
            None => match names.next() {
                Some(Component::CurDir) => continue,
                Some(part) => Cow::Borrowed(part.as_os_str()),
                None => break,
            },
        };
        // Refused, not missing: the kernel may reach the file.
        walked += 1;
        if walked > MAX_NAMES {
            return Err(TOO_MANY);
        }
        let last = detour.is_empty() && names.clone().next().is_none();
        let at = folder.as_ref().map_or(base.fd.as_fd(), |fd| fd.as_fd());
        let stat = match statat(at, &*name, AtFlags::SYMLINK_NOFOLLOW) {
            Ok(stat) => stat,
            Err(error) => return gone(error),
        };
        match FileType::from_raw_mode(stat.st_mode) {
            FileType::Symlink => {
                // The kernel's limit: the walker gets ELOOP too.
                links += 1;
                if links > 40 {
                    return Ok(None);
                }
                let target = match readlinkat(at, &*name, Vec::new()) {
                    Ok(target) => target,
                    Err(error) => return gone(error),
                };
                let target = Path::new(OsStr::from_bytes(target.as_bytes()));
                let parts = target
                    .components()
                    .filter(|part| *part != Component::CurDir);
                // Counted before they are kept: 40 links of 2,000 names each
                // would cost as much as 80,000 names.
                if walked + detour.len() + parts.clone().count() > MAX_NAMES {
                    return Err(TOO_MANY);
                }
                detour.extend(parts.rev().map(|part| part.as_os_str().to_owned()));
            }
            // A file can be mounted on its own, from another file system
            // than its folder's.
            FileType::RegularFile if last => {
                let kernel = match base.devices.known(stat.st_dev) {
                    Some(kernel) => kernel,
                    None => {
                        let flags = OFlags::PATH | OFlags::NOFOLLOW | OFlags::CLOEXEC;
                        match openat(at, &*name, flags, Mode::empty()) {
                            Ok(file) => base.devices.of_kernel(stat.st_dev, &file),
                            Err(error) => return gone(error),
                        }
                    }
                };
                if kernel {
                    return Err(REFUSED);
                }
                return Ok(Some(Found {
                    regular: true,
                    len: stat.st_size as u64,
                }));
            }
            _ if last => {
                return Ok(Some(Found {
                    regular: false,
                    len: 0,
                }));
            }
            FileType::Directory => {
                let flags = OFlags::PATH | OFlags::DIRECTORY | OFlags::NOFOLLOW | OFlags::CLOEXEC;
                let next = match openat(at, &*name, flags, Mode::empty()) {
                    Ok(next) => next,
                    Err(error) => return gone(error),
                };
                if base.devices.of_kernel(stat.st_dev, &next) {
                    return Err(REFUSED);
                }
                folder = Some(next);
            }
            _ => return Ok(None),
        }
    }
    // `path` leads to a folder.
    Ok(Some(Found {
        regular: false,
        len: 0,
    }))
}

/// macOS has no procfs.
#[cfg(not(target_os = "linux"))]
fn find(base: &Base, path: &Path) -> Result<Option<Found>, &'static str> {
    let file = match base.path.join(path).metadata() {
        Ok(file) => file,
        Err(error) if missing(&error) => return Ok(None),
        Err(_) => return Err(UNCHECKED),
    };
    Ok(Some(Found {
        regular: file.is_file(),
        len: file.len(),
    }))
}

/// Checks git's `info/exclude` in `folder`, and the files that lead the
/// walker to it. A `.git` file, as in a worktree or a submodule, names the
/// folder that holds `commondir`, which names the folder that holds
/// `info/exclude`. The walker reads both names: they are checked before
/// they are read, and resolved as `ignore` resolves them, so that a
/// relative `gitdir:` counts from the current folder of mdame. Gives the
/// size of `info/exclude` alone: the walker builds no globs from the two
/// others.
fn check_git_exclude(folder: &Base) -> Result<u64, (PathBuf, &'static str)> {
    let refused = |why: &'static str| (folder.path.join(".git"), why);
    match find(folder, Path::new(".git")).map_err(refused)? {
        None => return Ok(0),
        Some(file) if file.regular => judge(&file).map_err(refused)?,
        Some(_) => return check(folder, Path::new(".git/info/exclude")),
    };
    let gitdir = first_line(&folder.path.join(".git")).map_err(refused)?;
    let Some(gitdir) = gitdir.and_then(|line| line.strip_prefix("gitdir: ").map(PathBuf::from))
    else {
        return Ok(0);
    };
    // As the walker opens them: from `/`, or from the current folder.
    let check_here = |path: &Path| {
        let start = Path::new(if path.is_absolute() { "/" } else { "." });
        match Base::open(start, folder.devices) {
            Ok(base) => check(&base, path),
            Err(error) if missing(&error) => Ok(0),
            Err(_) => Err((path.to_owned(), UNCHECKED)),
        }
    };
    let commondir = gitdir.join("commondir");
    check_here(&commondir)?;
    let Some(common) = first_line(&commondir).map_err(|why| (commondir.clone(), why))? else {
        return Ok(0);
    };
    let common = if common.starts_with('.') {
        gitdir.join(common)
    } else {
        PathBuf::from(common)
    };
    check_here(&common.join("info/exclude"))
}

/// As the walker reads it: the bytes after the first line need not be
/// UTF-8.
fn first_line(path: &Path) -> Result<Option<String>, &'static str> {
    let file = match std::fs::File::open(path) {
        Ok(file) => file,
        Err(error) if missing(&error) => return Ok(None),
        Err(_) => return Err(UNCHECKED),
    };
    match std::io::BufReader::new(file).lines().next() {
        Some(Ok(line)) => Ok(Some(line)),
        // The walker gives up on a first line that is not UTF-8 too.
        Some(Err(error)) if error.kind() == std::io::ErrorKind::InvalidData => Ok(None),
        Some(Err(_)) => Err(UNCHECKED),
        None => Ok(None),
    }
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
    // The walker reads the ignore files of the root and of each folder above
    // it before any filter, even those whose rules it does not apply. Above
    // the real path of the root: a link may lead to it by now.
    let Ok(real) = root.canonicalize() else {
        return Vec::new();
    };
    let in_repo = real.ancestors().any(|dir| dir.join(".git").exists());
    let read = AtomicU64::new(0);
    let devices = Devices::default();
    let bad = real
        .ancestors()
        .find_map(|folder| bad_ignore_file(folder, &read, &devices));
    if let Some((file, why)) = bad {
        tracing::warn!("the tree is empty: {} {why}", file.display());
        return Vec::new();
    }
    WalkBuilder::new(root)
        // In a repository, true stops the parent scan at its root.
        .require_git(in_repo)
        // Git reads core.excludesFile only in a repository, too.
        .git_global(in_repo)
        .parents(in_repo)
        .hidden(false)
        .filter_entry(move |entry| {
            if is_git_or_mdame(entry.file_name()) {
                return false;
            }
            let is_folder = entry.file_type().is_some_and(|kind| kind.is_dir());
            // Before the walker reads them.
            let bad = is_folder
                .then(|| bad_ignore_file(entry.path(), &read, &devices))
                .flatten();
            if let Some((file, why)) = &bad {
                tracing::warn!("skipped: {} {why}", file.display());
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

    /// `walk`, which fails this test rather than block it on a FIFO. The walk
    /// that blocks still holds the walk lock, so the other tests that walk
    /// wait too.
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
        // A regular file in procfs, small should the check break.
        if cfg!(target_os = "linux") {
            write(root.path(), "procfs/a.md", 1);
            symlink("/proc/self/status", root.path().join("procfs/.gitignore")).unwrap();
        }
        fs::write(root.path().join("fine/.gitignore"), "").unwrap();

        let paths = tree_paths(&walk_within_seconds(root.path()));
        assert_eq!(paths, ["", "fine", "fine/a.md"]);
    }

    #[test]
    fn a_worktree_with_a_bad_ignore_file_is_skipped() {
        let root = crate::workspace::tempdir();
        let git = crate::workspace::tempdir();
        // The walker reads only the first line of `.git` and of
        // `commondir`: a byte that is not UTF-8 after it must not stop the
        // checks.
        let worktree = |name: &str| {
            let gitdir = git.path().join(name);
            fs::create_dir_all(gitdir.join("common/info")).unwrap();
            fs::write(gitdir.join("commondir"), b"./common\n\xff\n").unwrap();
            let dot_git = [
                format!("gitdir: {}\n", gitdir.display()).as_bytes(),
                b"\xff\n",
            ]
            .concat();
            write(root.path(), &format!("{name}/a.md"), 1);
            fs::write(root.path().join(name).join(".git"), dot_git).unwrap();
            gitdir
        };
        let fifo = worktree("fifo");
        fs::remove_file(fifo.join("commondir")).unwrap();
        mkfifo(&fifo.join("commondir"));
        let exclude = worktree("exclude");
        mkfifo(&exclude.join("common/info/exclude"));
        let fine = worktree("fine");
        fs::write(fine.join("common/info/exclude"), "b.md\n").unwrap();
        write(root.path(), "fine/b.md", 1);

        let paths = tree_paths(&walk_within_seconds(root.path()));
        assert_eq!(paths, ["", "fine", "fine/a.md"]);
    }

    #[test]
    fn the_ignore_files_of_a_walk_stop_at_1_mib() {
        let root = crate::workspace::tempdir();
        // Room for the ignore files above the temporary folder, such as a
        // ~/.gitignore: `fit` files still fit with 4 KiB above.
        let fit = MAX_IGNORE_BYTES / MAX_IGNORE_FILE;
        let blank = "\n".repeat((MAX_IGNORE_FILE - 4096 / fit) as usize);
        for index in 0..fit + 2 {
            write(root.path(), &format!("{index}/a.md"), 1);
            fs::write(root.path().join(format!("{index}/.gitignore")), &blank).unwrap();
        }

        let paths = tree_paths(&walk_within_seconds(root.path()));
        let shown = paths.iter().filter(|path| path.ends_with("/a.md")).count();
        assert_eq!(shown as u64, fit);
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn an_ignore_file_through_procfs_is_refused() {
        use std::os::fd::AsRawFd;
        use std::os::unix::fs::symlink;
        // The targets are missing now, but may exist in the folder that the
        // walker has open under the same number: the open folder here, and
        // a number that nothing has open yet.
        let root = crate::workspace::tempdir();
        let other = crate::workspace::tempdir();
        let open = fs::File::open(other.path()).unwrap();
        let read = AtomicU64::new(0);
        let refused = |folder: &Path| {
            let (bad, why) = bad_ignore_file(folder, &read, &Devices::default()).unwrap();
            assert!(why.contains("file system of the kernel"), "{why}");
            bad
        };
        for fd in [open.as_raw_fd(), 999_999] {
            let magic = format!("/proc/self/fd/{fd}");

            let link = root.path().join(format!("link-{fd}"));
            fs::create_dir(&link).unwrap();
            symlink(format!("{magic}/z"), link.join(".gitignore")).unwrap();
            assert_eq!(refused(&link), link.join(".gitignore"));

            let module = root.path().join(format!("module-{fd}"));
            fs::create_dir(&module).unwrap();
            fs::write(module.join(".git"), format!("gitdir: {magic}\n")).unwrap();
            assert_eq!(
                refused(&module),
                PathBuf::from(format!("{magic}/commondir"))
            );

            let repo = root.path().join(format!("repo-{fd}"));
            fs::create_dir(&repo).unwrap();
            symlink(&magic, repo.join(".git")).unwrap();
            assert_eq!(refused(&repo), repo.join(".git"));
        }
    }

    #[test]
    fn only_the_errors_that_stop_the_walker_count_as_missing() {
        use std::io::{Error, ErrorKind};
        for kind in [
            ErrorKind::NotFound,
            ErrorKind::PermissionDenied,
            ErrorKind::InvalidInput,
        ] {
            assert!(missing(&Error::from(kind)), "{kind:?}");
        }
        assert!(missing(&Error::from(rustix::io::Errno::LOOP)));
        assert!(!missing(&Error::from(rustix::io::Errno::MFILE)));
        assert!(!missing(&Error::from(ErrorKind::Other)));
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn a_path_of_too_many_names_is_refused() {
        use std::os::unix::fs::symlink;
        let root = crate::workspace::tempdir();
        fs::create_dir_all(root.path().join("folder/a")).unwrap();
        fs::write(root.path().join("folder/x"), "").unwrap();
        let target = format!("{}x", "a/../".repeat(130));
        symlink(target, root.path().join("folder/.gitignore")).unwrap();

        let read = AtomicU64::new(0);
        let devices = Devices::default();
        let (bad, why) = bad_ignore_file(&root.path().join("folder"), &read, &devices).unwrap();
        assert_eq!(bad, root.path().join("folder/.gitignore"));
        assert!(why.contains("256 names"), "{why}");

        // Two links that name each other, each through 200 names: the
        // walker gets ELOOP, but only after 40 links of 200 names.
        let chain = root.path().join("chain");
        fs::create_dir_all(chain.join("a")).unwrap();
        let long = "/a/..".repeat(100);
        symlink(format!("two{long}"), chain.join("one")).unwrap();
        symlink(format!("one{long}"), chain.join("two")).unwrap();
        symlink("one", chain.join(".gitignore")).unwrap();
        let (bad, why) = bad_ignore_file(&chain, &read, &devices).unwrap();
        assert_eq!(bad, chain.join(".gitignore"));
        assert!(why.contains("256 names"), "{why}");
    }

    #[test]
    fn the_files_that_lead_to_info_exclude_count_for_nothing_in_the_budget() {
        let root = crate::workspace::tempdir();
        let gitdir = root.path().join("gitdir");
        fs::create_dir_all(gitdir.join("common")).unwrap();
        fs::write(gitdir.join("commondir"), "./common\n").unwrap();
        let module = root.path().join("module");
        fs::create_dir(&module).unwrap();
        fs::write(
            module.join(".git"),
            format!("gitdir: {}\n", gitdir.display()),
        )
        .unwrap();

        let spent = AtomicU64::new(MAX_IGNORE_BYTES);
        assert_eq!(bad_ignore_file(&module, &spent, &Devices::default()), None);
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
    fn the_folders_above_the_real_path_of_the_root_are_checked() {
        use std::os::unix::fs::symlink;
        let outer = crate::workspace::tempdir();
        write(outer.path(), "a/b/x.md", 1);
        mkfifo(&outer.path().join("a/.ignore"));
        let links = crate::workspace::tempdir();
        let docs = links.path().join("docs");
        write(&docs, "y.md", 1);
        let workspace = Workspace::open(&docs).unwrap();
        // A pull turns the folder into a link.
        fs::remove_dir_all(&docs).unwrap();
        symlink(outer.path().join("a/b"), &docs).unwrap();

        let (sender, receiver) = std::sync::mpsc::channel();
        std::thread::spawn(move || sender.send(build(&workspace)));
        let wait = std::time::Duration::from_secs(5);
        let tree = receiver.recv_timeout(wait).expect("the walk ends");
        assert_eq!(tree_paths(&tree), [""]);
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
