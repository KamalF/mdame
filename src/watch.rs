use std::collections::HashSet;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, PoisonError, Weak, mpsc};
use std::time::{Duration, Instant};

use notify_debouncer_full::notify::{
    self, RecommendedWatcher, RecursiveMode, WatcherKind,
    event::{EventKind, ModifyKind, RenameMode},
};
use notify_debouncer_full::{DebounceEventResult, Debouncer, NoCache, new_debouncer_opt};
use serde::Serialize;
use tokio::sync::broadcast;

use crate::tree;
use crate::workspace::OWN_DIR;

pub const EVENT_CAPACITY: usize = 256;

/// A batch with more events than this, for example after a `git checkout`,
/// is sent as one `resync`.
const BURST_THRESHOLD: usize = 100;

const DEBOUNCE: Duration = Duration::from_millis(200);

// The cache of file ids that macOS would get pairs renames, but it walks
// the root on each rescan, through symlinks and ignored folders.
type Debounced = Debouncer<RecommendedWatcher, NoCache>;

/// Watches the workspace until it is dropped.
pub struct Watcher {
    _debouncer: Arc<Mutex<Debounced>>,
    started: Mutex<mpsc::Receiver<()>>,
}

impl Watcher {
    /// Blocks until the folders of the workspace are watched.
    pub fn wait_started(&self) {
        // The sender is dropped then.
        let started = self.started.lock().unwrap_or_else(PoisonError::into_inner);
        let _ = started.recv();
    }
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Event {
    Changed { path: String },
    Created { path: String },
    Removed { path: String },
    Renamed { from: String, to: String },
    Resync,
}

/// Sends the events under `root` on `sender` until the watcher is dropped.
pub fn start(root: &Path, sender: broadcast::Sender<Event>) -> notify::Result<Watcher> {
    let (batches, received) = mpsc::sync_channel(16);
    let handler = move |batch| {
        let _ = batches.send(batch);
    };
    // A symlinked folder can point out of the workspace: its events would
    // leak outside names, and a link to `/` would watch the whole disk.
    let config = notify::Config::default().with_follow_symlinks(false);
    let mut debouncer =
        new_debouncer_opt::<_, RecommendedWatcher, _>(DEBOUNCE, None, handler, NoCache, config)?;
    if watches_whole_trees() {
        debouncer.watch(root, RecursiveMode::Recursive)?;
    }
    let folders = Folders {
        root: root.to_owned(),
        watched: HashSet::new(),
    };
    let debouncer = Arc::new(Mutex::new(debouncer));
    let weak = Arc::downgrade(&debouncer);
    let (done, started) = mpsc::channel();
    // Walking the workspace blocks: not on a thread of tokio.
    std::thread::spawn(move || forward(&received, &weak, folders, &sender, done));
    Ok(Watcher {
        _debouncer: debouncer,
        started: Mutex::new(started),
    })
}

/// FSEvents watches a whole tree at the cost of one folder. inotify costs
/// one watch per folder: there, mdame watches only the folders that the
/// tree shows.
fn watches_whole_trees() -> bool {
    Debounced::kind() == WatcherKind::Fsevent
}

/// Sends the events of each batch, after a new walk if the batch may have
/// changed the folders that the tree shows.
fn forward(
    received: &mpsc::Receiver<DebounceEventResult>,
    debouncer: &Weak<Mutex<Debounced>>,
    mut folders: Folders,
    sender: &broadcast::Sender<Event>,
    started: mpsc::Sender<()>,
) {
    // `None` once the watcher is dropped.
    let update = |folders: &mut Folders, batch: &[notify::Event]| {
        let debouncer = debouncer.upgrade()?;
        let mut debouncer = debouncer.lock().unwrap_or_else(PoisonError::into_inner);
        Some(folders.update(&mut debouncer, batch))
    };
    // Here, not in `start`: notify-debouncer-full 0.7 takes quadratic time
    // to watch folders one by one, 12 s for 15,000.
    if update(&mut folders, &[]).is_none() {
        return;
    }
    // A tab may have connected during the first walk, and missed changes.
    // Sent before `wait_started` returns, so that a receiver that
    // subscribes after it gets only later events.
    let _ = sender.send(Event::Resync);
    drop(started);
    let mut renamed = Vec::new();
    for first in received {
        // A walk can take a second: one walk serves every batch that waits.
        let batch: Vec<_> = std::iter::once(first)
            .chain(received.try_iter())
            .flat_map(unpack)
            .collect();
        let found = if batch.iter().any(|event| folders.changed_by(event)) {
            let Some(found) = update(&mut folders, &batch) else {
                return;
            };
            found
        } else {
            Vec::new()
        };
        let mut events = events(&folders, &batch, &found);
        drop_echoes(&mut events, &mut renamed, Instant::now());
        for event in events {
            // An error only means that no tab is connected.
            let _ = sender.send(event);
        }
    }
}

fn unpack(batch: DebounceEventResult) -> Vec<notify::Event> {
    match batch {
        Ok(batch) => batch.into_iter().map(|event| event.event).collect(),
        Err(errors) => {
            for error in errors {
                tracing::warn!("watcher: {error}");
            }
            Vec::new()
        }
    }
}

/// How long a renamed path can still get the echo of its rename.
const ECHO: Duration = Duration::from_secs(1);

/// A watched folder reports its own move too, as a removal, a moment after
/// its parent reports the rename: maybe in the next batch. A removal of a
/// path renamed less than `ECHO` ago is that echo. `renamed` keeps the
/// paths renamed in the batches before.
fn drop_echoes(events: &mut Vec<Event>, renamed: &mut Vec<(String, Instant)>, now: Instant) {
    renamed.retain(|(_, at)| now.duration_since(*at) < ECHO);
    for event in events.iter() {
        if let Event::Renamed { from, .. } = event {
            renamed.push((from.clone(), now));
        }
    }
    events.retain(|event| {
        !matches!(event, Event::Removed { path } if renamed.iter().any(|(from, _)| from == path))
    });
}

/// The folders that the tree shows, as of the last walk.
struct Folders {
    root: PathBuf,
    watched: HashSet<PathBuf>,
}

impl Folders {
    /// Walks the workspace again after `batch`, and watches what it finds.
    /// Gives the entries of the folders that were not watched before: they
    /// may have been written before their folder's watch.
    fn update(&mut self, debouncer: &mut Debounced, batch: &[notify::Event]) -> Vec<PathBuf> {
        // Events were lost, and with them the removals that dropped
        // watches: every folder is watched again.
        let rescan = batch.iter().any(notify::Event::need_rescan);
        // notify drops the watches of a folder removed or moved away, and
        // of the folders below it, even if the path is back by now.
        let gone: HashSet<&Path> = batch
            .iter()
            .filter(|event| {
                matches!(
                    event.kind,
                    EventKind::Remove(_)
                        | EventKind::Modify(ModifyKind::Name(RenameMode::From | RenameMode::Both))
                )
            })
            .filter_map(|event| event.paths.first().map(PathBuf::as_path))
            .collect();
        self.watched
            .retain(|folder| !folder.ancestors().any(|path| gone.contains(path)));
        // At the start, the resync after the first walk covers what was
        // written before the watches.
        let start = self.watched.is_empty();
        let before = self.watched.clone();
        let mut found = Vec::new();
        // A folder may have changed between the walk and its watch: a
        // second walk finds it. Not more, so that a stream of new folders
        // cannot hold the events back.
        for walk in 0..2 {
            let mut folders = HashSet::new();
            found.clear();
            let walked = Mutex::new(Vec::new());
            tree::walk(&self.root, |entry| {
                let is_folder = entry.file_type().is_some_and(|kind| kind.is_dir());
                let mut walked = walked.lock().unwrap_or_else(PoisonError::into_inner);
                walked.push((entry.path().to_owned(), is_folder));
            });
            let mut walked = walked.into_inner().unwrap_or_else(PoisonError::into_inner);
            // A folder before its entries.
            walked.sort_unstable();
            for (path, is_folder) in walked {
                let parent = path.parent().filter(|parent| folders.contains(*parent));
                if !start && parent.is_some_and(|parent| !before.contains(parent)) {
                    found.push(path.clone());
                }
                if is_folder {
                    folders.insert(path);
                }
            }
            let all = rescan && walk == 0;
            let added = !watches_whole_trees()
                && watch_folders(debouncer, &self.watched, &mut folders, all);
            self.watched = folders;
            if !added {
                break;
            }
        }
        found
    }

    /// Whether `event` may change the folders that the tree shows: only a
    /// shown folder, a new folder or an ignore file can, and only in a
    /// shown folder. After a rescan, events were lost.
    fn changed_by(&self, event: &notify::Event) -> bool {
        let is_ignore_file = |path: &Path| {
            path.file_name()
                .is_some_and(|name| name == ".gitignore" || name == ".ignore")
        };
        let changes = |path: &PathBuf| match event.kind {
            EventKind::Access(_) | EventKind::Modify(ModifyKind::Metadata(_)) => false,
            EventKind::Modify(ModifyKind::Data(_)) => is_ignore_file(path),
            _ => is_ignore_file(path) || self.watched.contains(path) || path.is_dir(),
        };
        event.need_rescan()
            || event
                .paths
                .iter()
                .any(|path| self.relative(path).is_some() && changes(path))
    }

    /// `None` for paths outside the folders that the tree shows, under
    /// `.mdame/`, or not UTF-8.
    fn relative(&self, path: &Path) -> Option<String> {
        if !path
            .parent()
            .is_some_and(|parent| self.watched.contains(parent))
        {
            return None;
        }
        let relative = path.strip_prefix(&self.root).ok()?;
        if relative.starts_with(OWN_DIR) {
            return None;
        }
        let relative = relative.to_str()?;
        (!relative.is_empty()).then(|| relative.to_owned())
    }
}

/// Watches the folders of `new` that `old` lacks, or all of them, and
/// leaves out of `new` those that are gone. Gives whether it watched any.
fn watch_folders(
    debouncer: &mut Debounced,
    old: &HashSet<PathBuf>,
    new: &mut HashSet<PathBuf>,
    all: bool,
) -> bool {
    // notify has dropped the watch of a folder deleted or moved away, and
    // each call waits for its thread, busy with the events of the removal.
    for hidden in old.difference(new).filter(|folder| folder.exists()) {
        let _ = debouncer.unwatch(hidden);
    }
    // The debouncer looks for the watch of each event's path in the order
    // of the watches. Sorted, the root comes first and matches at once.
    // Otherwise, with 15,000 folders, the 30,000 events of one tree walk
    // overflowed the inotify queue, and each overflow made the tabs walk
    // the tree again.
    let mut added: Vec<PathBuf> = if all {
        new.iter().cloned().collect()
    } else {
        new.difference(old).cloned().collect()
    };
    added.sort();
    let mut watched = false;
    for folder in added {
        match debouncer.watch(&folder, RecursiveMode::NonRecursive) {
            Ok(()) => watched = true,
            // Watched if it comes back.
            Err(error) if vanished(&error) => {
                new.remove(&folder);
            }
            // Left in `new`, so that the warning is not repeated.
            Err(error) if denied(&error) => {
                tracing::warn!("not watched: {}", folder.display());
            }
            Err(error) => {
                tracing::warn!("live updates miss some folders: {error}");
                break;
            }
        }
    }
    watched
}

/// Also when the folder goes between the watch and notify's check of it.
fn vanished(error: &notify::Error) -> bool {
    match &error.kind {
        notify::ErrorKind::PathNotFound => true,
        notify::ErrorKind::Io(io) => io.kind() == ErrorKind::NotFound,
        _ => false,
    }
}

fn denied(error: &notify::Error) -> bool {
    matches!(&error.kind, notify::ErrorKind::Io(io) if io.kind() == ErrorKind::PermissionDenied)
}

/// Turns one debounced batch into events with workspace-relative paths.
/// `found` holds the entries of the folders that mdame started to watch
/// after the batch.
fn events(folders: &Folders, batch: &[notify::Event], found: &[PathBuf]) -> Vec<Event> {
    // Reads count for nothing: mdame's own tree walk opens every folder,
    // and a resync makes each tab walk it again. Nor do the events of the
    // folders that the tree hides, which reach the watcher on macOS.
    let batch: Vec<_> = batch
        .iter()
        .filter(|event| !matches!(event.kind, EventKind::Access(_)))
        .filter(|event| {
            event.need_rescan()
                || event
                    .paths
                    .iter()
                    .any(|path| folders.relative(path).is_some())
        })
        .collect();
    if batch.len() > BURST_THRESHOLD {
        return vec![Event::Resync];
    }
    let mut events = Vec::new();
    for notify_event in batch {
        if notify_event.need_rescan() {
            return vec![Event::Resync];
        }
        let path = |index: usize| {
            let path = notify_event.paths.get(index)?;
            folders.relative(path)
        };
        let event = match notify_event.kind {
            EventKind::Create(_) | EventKind::Modify(ModifyKind::Name(RenameMode::To)) => {
                path(0).map(|path| Event::Created { path })
            }
            EventKind::Remove(_) | EventKind::Modify(ModifyKind::Name(RenameMode::From)) => {
                path(0).map(|path| Event::Removed { path })
            }
            // A move into or out of the workspace, or of `.mdame/`, has
            // only one side.
            EventKind::Modify(ModifyKind::Name(RenameMode::Both)) => match (path(0), path(1)) {
                (Some(from), Some(to)) => Some(Event::Renamed { from, to }),
                (None, Some(path)) => Some(Event::Created { path }),
                (Some(path), None) => Some(Event::Removed { path }),
                (None, None) => None,
            },
            // inotify always tells which side of a rename it saw.
            EventKind::Modify(ModifyKind::Name(_)) => return vec![Event::Resync],
            EventKind::Modify(_) => path(0).map(|path| Event::Changed { path }),
            EventKind::Access(_) | EventKind::Any | EventKind::Other => None,
        };
        if let Some(event) = event {
            push(&mut events, event);
        }
    }
    // A new folder may hold entries written before its watch, even if its
    // own event comes in a later batch. Not a renamed folder: its entries
    // are the same. notify drops its watch, so what is written into it
    // before the walk sends nothing.
    let renamed: Vec<PathBuf> = events
        .iter()
        .filter_map(|event| match event {
            Event::Renamed { to, .. } => Some(PathBuf::from(to)),
            _ => None,
        })
        .collect();
    for path in found.iter().filter_map(|path| folders.relative(path)) {
        if !renamed
            .iter()
            .any(|folder| Path::new(&path).starts_with(folder))
        {
            push(&mut events, Event::Created { path });
            if events.len() > BURST_THRESHOLD {
                return vec![Event::Resync];
            }
        }
    }
    events
}

/// Sends no event twice in a row for a path, and no change to a file just
/// created. Nothing else is merged: a delete then create, or a rename to a
/// backup then create, can be a save or a folder swapped for another, and
/// the browser tells them apart by asking for the open file again.
fn push(events: &mut Vec<Event>, event: Event) {
    let paths = paths_of(&event);
    let last = events
        .iter()
        .rev()
        .find(|earlier| paths_of(earlier).iter().any(|path| paths.contains(path)));
    let created = matches!(
        (&event, last),
        (Event::Changed { path }, Some(Event::Created { path: created })) if path == created
    );
    if !created && last != Some(&event) {
        events.push(event);
    }
}

fn paths_of(event: &Event) -> Vec<&str> {
    match event {
        Event::Created { path } | Event::Changed { path } | Event::Removed { path } => vec![path],
        Event::Renamed { from, to } => vec![from, to],
        Event::Resync => Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use notify_debouncer_full::notify::event::{
        AccessKind, CreateKind, DataChange, Flag, MetadataKind, RemoveKind,
    };

    fn notify_event(kind: EventKind, paths: &[&str]) -> notify::Event {
        paths.iter().fold(notify::Event::new(kind), |event, path| {
            event.add_path(PathBuf::from(path))
        })
    }

    fn create(path: &str) -> notify::Event {
        notify_event(EventKind::Create(CreateKind::File), &[path])
    }

    fn remove(path: &str) -> notify::Event {
        notify_event(EventKind::Remove(RemoveKind::File), &[path])
    }

    fn write(path: &str) -> notify::Event {
        notify_event(
            EventKind::Modify(ModifyKind::Data(DataChange::Any)),
            &[path],
        )
    }

    fn rename(from: &str, to: &str) -> notify::Event {
        notify_event(
            EventKind::Modify(ModifyKind::Name(RenameMode::Both)),
            &[from, to],
        )
    }

    fn path(path: &str) -> String {
        path.to_owned()
    }

    fn map(batch: &[notify::Event]) -> Vec<Event> {
        let folders = Folders {
            root: PathBuf::from("/ws"),
            watched: HashSet::from(["/ws".into(), "/ws/sub".into()]),
        };
        events(&folders, batch, &[])
    }

    #[test]
    fn only_folders_and_ignore_files_change_the_shown_folders() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().to_owned();
        std::fs::create_dir(root.join("new")).unwrap();
        let folders = Folders {
            watched: HashSet::from([root.clone(), root.join("sub")]),
            root,
        };
        let at = |name: &str| folders.root.join(name).to_str().unwrap().to_owned();
        let changes = |event: notify::Event| folders.changed_by(&event);
        assert!(changes(create(&at("new"))));
        assert!(changes(remove(&at("sub"))));
        assert!(changes(rename(&at("sub"), &at("moved"))));
        assert!(changes(create(&at(".gitignore"))));
        assert!(changes(write(&at(".ignore"))));
        assert!(!changes(create(&at("a.md"))));
        assert!(!changes(remove(&at("a.md"))));
        assert!(!changes(rename(&at("a.md"), &at("b.md"))));
        assert!(!changes(write(&at("a.md"))));
        assert!(!changes(create(&at("hidden/new"))));
        // A walk opens each folder: these must not walk again.
        let on_new = |kind| notify_event(kind, &[&at("new")]);
        assert!(!changes(on_new(EventKind::Access(AccessKind::Any))));
        let metadata = EventKind::Modify(ModifyKind::Metadata(MetadataKind::Any));
        assert!(!changes(on_new(metadata)));
    }

    #[test]
    fn the_entries_of_a_new_folder_over_the_burst_threshold_give_resync() {
        let folders = Folders {
            root: PathBuf::from("/ws"),
            watched: HashSet::from(["/ws".into(), "/ws/new".into()]),
        };
        let batch = [create("/ws/new")];
        let found = |count: usize| -> Vec<PathBuf> {
            (0..count)
                .map(|i| PathBuf::from(format!("/ws/new/{i}.md")))
                .collect()
        };
        let under = events(&folders, &batch, &found(BURST_THRESHOLD - 1));
        assert_eq!(under.len(), BURST_THRESHOLD);
        let over = events(&folders, &batch, &found(BURST_THRESHOLD));
        assert_eq!(over, [Event::Resync]);
    }

    #[cfg(target_os = "linux")]
    fn debouncer() -> (Debounced, std::sync::mpsc::Receiver<DebounceEventResult>) {
        let (sender, received) = std::sync::mpsc::channel();
        let config = notify::Config::default().with_follow_symlinks(false);
        let debouncer =
            new_debouncer_opt::<_, RecommendedWatcher, _>(DEBOUNCE, None, sender, NoCache, config)
                .unwrap();
        (debouncer, received)
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn a_vanished_folder_leaves_the_set_and_a_denied_one_stays() {
        use std::fs::{self, Permissions};
        use std::os::unix::fs::PermissionsExt;

        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().to_owned();
        let denied = root.join("b");
        fs::create_dir(&denied).unwrap();
        fs::set_permissions(&denied, Permissions::from_mode(0o000)).unwrap();
        fs::create_dir(root.join("c")).unwrap();
        // Sorted, the vanished folder comes first: the others are still watched.
        let mut new = HashSet::from([root.join("a"), denied.clone(), root.join("c")]);
        let (mut debouncer, _received) = debouncer();
        assert!(watch_folders(
            &mut debouncer,
            &HashSet::new(),
            &mut new,
            false
        ));
        fs::set_permissions(&denied, Permissions::from_mode(0o755)).unwrap();
        assert_eq!(new, HashSet::from([denied, root.join("c")]));
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn after_a_rescan_a_folder_created_again_is_watched_again() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().canonicalize().unwrap();
        std::fs::create_dir(root.join("docs")).unwrap();
        let (mut debouncer, received) = debouncer();
        let mut folders = Folders {
            root: root.clone(),
            watched: HashSet::new(),
        };
        folders.update(&mut debouncer, &[]);
        std::fs::remove_dir(root.join("docs")).unwrap();
        std::fs::create_dir(root.join("docs")).unwrap();
        // notify drops the watch of `docs`, and the batch is lost, as in an
        // overflow.
        while received.recv_timeout(Duration::from_millis(500)).is_ok() {}
        let rescan = notify::Event::new(EventKind::Other).set_flag(Flag::Rescan);
        folders.update(&mut debouncer, &[rescan]);

        let written = root.join("docs/a.md");
        std::fs::write(&written, "").unwrap();
        let deadline = Instant::now() + Duration::from_secs(5);
        while let Ok(batch) =
            received.recv_timeout(deadline.saturating_duration_since(Instant::now()))
        {
            if batch
                .unwrap()
                .iter()
                .any(|event| event.paths.contains(&written))
            {
                return;
            }
        }
        panic!("no event for {}", written.display());
    }

    #[test]
    fn a_burst_in_a_folder_that_the_tree_hides_sends_nothing() {
        let batch: Vec<_> = (0..=BURST_THRESHOLD)
            .map(|i| write(&format!("/ws/target/{i}.md")))
            .collect();
        assert_eq!(map(&batch), []);
    }

    #[test]
    fn the_entries_of_a_new_folder_are_created_unless_it_was_renamed() {
        let folders = Folders {
            root: PathBuf::from("/ws"),
            watched: HashSet::from(["/ws".into(), "/ws/sub".into(), "/ws/b".into()]),
        };
        let found = [PathBuf::from("/ws/b/y.md")];
        assert_eq!(
            events(&folders, &[create("/ws/sub/x.md")], &found),
            [
                Event::Created {
                    path: path("sub/x.md")
                },
                Event::Created {
                    path: path("b/y.md")
                },
            ]
        );
        assert_eq!(
            events(&folders, &[rename("/ws/old", "/ws/b")], &found),
            [Event::Renamed {
                from: path("old"),
                to: path("b")
            }]
        );
    }

    #[test]
    fn a_path_in_a_folder_that_the_tree_hides_is_skipped() {
        let batch = [
            write("/ws/build/a.md"),
            rename("/ws/build/b.md", "/ws/b.md"),
        ];
        assert_eq!(map(&batch), [Event::Created { path: path("b.md") }]);
    }

    #[test]
    fn each_kind_maps_to_its_event() {
        let batch = [
            write("/ws/a.md"),
            create("/ws/notes"),
            remove("/ws/old.md"),
            rename("/ws/b.md", "/ws/sub/b.md"),
        ];
        assert_eq!(
            map(&batch),
            [
                Event::Changed { path: path("a.md") },
                Event::Created {
                    path: path("notes")
                },
                Event::Removed {
                    path: path("old.md")
                },
                Event::Renamed {
                    from: path("b.md"),
                    to: path("sub/b.md")
                },
            ]
        );
    }

    #[test]
    fn moves_across_the_root_have_one_side() {
        let batch = [
            notify_event(
                EventKind::Modify(ModifyKind::Name(RenameMode::To)),
                &["/ws/in.md"],
            ),
            notify_event(
                EventKind::Modify(ModifyKind::Name(RenameMode::From)),
                &["/ws/out.md"],
            ),
            rename("/elsewhere/c.md", "/ws/c.md"),
            rename("/ws/d.md", "/elsewhere/d.md"),
        ];
        assert_eq!(
            map(&batch),
            [
                Event::Created {
                    path: path("in.md")
                },
                Event::Removed {
                    path: path("out.md")
                },
                Event::Created { path: path("c.md") },
                Event::Removed { path: path("d.md") },
            ]
        );
    }

    #[test]
    fn a_removal_after_a_creation_after_a_removal_is_sent() {
        let batch = [remove("/ws/a.md"), create("/ws/a.md"), remove("/ws/a.md")];
        assert_eq!(
            map(&batch),
            [
                Event::Removed { path: path("a.md") },
                Event::Created { path: path("a.md") },
                Event::Removed { path: path("a.md") },
            ]
        );
    }

    #[test]
    fn delete_then_create_is_not_merged() {
        let batch = [remove("/ws/a.md"), create("/ws/a.md")];
        assert_eq!(
            map(&batch),
            [
                Event::Removed { path: path("a.md") },
                Event::Created { path: path("a.md") },
            ]
        );
    }

    #[test]
    fn rename_to_a_backup_then_create_is_not_merged() {
        let batch = [rename("/ws/a.md", "/ws/a.md~"), create("/ws/a.md")];
        assert_eq!(
            map(&batch),
            [
                Event::Renamed {
                    from: path("a.md"),
                    to: path("a.md~")
                },
                Event::Created { path: path("a.md") },
            ]
        );
    }

    #[test]
    fn folder_replaced_is_not_a_change() {
        let removed = notify_event(EventKind::Remove(RemoveKind::Folder), &["/ws/docs"]);
        let replacements = [
            notify_event(EventKind::Create(CreateKind::Folder), &["/ws/docs"]),
            notify_event(
                EventKind::Modify(ModifyKind::Name(RenameMode::To)),
                &["/ws/docs"],
            ),
            create("/ws/docs"),
        ];
        for replacement in replacements {
            assert_eq!(
                map(&[removed.clone(), replacement]),
                [
                    Event::Removed { path: path("docs") },
                    Event::Created { path: path("docs") },
                ]
            );
        }
    }

    #[test]
    fn change_after_create_is_not_sent() {
        let batch = [create("/ws/a.md"), create("/ws/b.md"), write("/ws/a.md")];
        assert_eq!(
            map(&batch),
            [
                Event::Created { path: path("a.md") },
                Event::Created { path: path("b.md") },
            ]
        );
    }

    #[test]
    fn duplicates_are_sent_once() {
        let batch = [write("/ws/a.md"), write("/ws/a.md")];
        assert_eq!(map(&batch), [Event::Changed { path: path("a.md") }]);
    }

    #[test]
    fn mdame_folder_and_outside_paths_are_skipped() {
        let batch = [
            create("/ws/.mdame/history/a.md/1.md"),
            write("/ws/.mdame"),
            write("/other/a.md"),
            write("/ws"),
            notify_event(EventKind::Access(AccessKind::Any), &["/ws/a.md"]),
        ];
        assert_eq!(map(&batch), []);
        assert_eq!(
            map(&[write("/ws/.mdamex.md")]),
            [Event::Changed {
                path: path(".mdamex.md")
            }]
        );
    }

    #[test]
    fn burst_and_rescan_give_resync() {
        let burst: Vec<_> = (0..=BURST_THRESHOLD)
            .map(|i| write(&format!("/ws/{i}.md")))
            .collect();
        assert_eq!(map(&burst), [Event::Resync]);
        assert_eq!(map(&burst[1..]).len(), BURST_THRESHOLD);

        let reads: Vec<_> = (0..=BURST_THRESHOLD)
            .map(|_| notify_event(EventKind::Access(AccessKind::Any), &["/ws/a.md"]))
            .chain([write("/ws/a.md")])
            .collect();
        assert_eq!(map(&reads), [Event::Changed { path: path("a.md") }]);

        let rescan = notify_event(EventKind::Other, &[]).set_flag(Flag::Rescan);
        assert_eq!(map(&[write("/ws/a.md"), rescan]), [Event::Resync]);
    }

    #[test]
    fn only_a_denied_or_vanished_folder_is_skipped() {
        let io = |kind| notify::Error::io(std::io::Error::from(kind));
        assert!(denied(&io(ErrorKind::PermissionDenied)));
        assert!(vanished(&notify::Error::path_not_found()));
        assert!(vanished(&io(ErrorKind::NotFound)));
        let limit = notify::Error::new(notify::ErrorKind::MaxFilesWatch);
        assert!(!denied(&limit) && !vanished(&limit));
    }

    #[test]
    fn a_removal_of_a_path_renamed_less_than_a_second_ago_is_dropped() {
        let start = Instant::now();
        let mut renamed = Vec::new();
        let mut batch = vec![Event::Renamed {
            from: path("sub"),
            to: path("moved"),
        }];
        drop_echoes(&mut batch, &mut renamed, start);
        assert_eq!(batch.len(), 1);

        let removed = || vec![Event::Removed { path: path("sub") }];
        let mut echo = removed();
        drop_echoes(&mut echo, &mut renamed, start + ECHO / 2);
        assert_eq!(echo, []);
        let mut later = removed();
        drop_echoes(&mut later, &mut renamed, start + ECHO);
        assert_eq!(later, removed());
    }

    #[test]
    fn events_serialize_with_a_type_field() {
        let json = |event| serde_json::to_string(&event).unwrap();
        assert_eq!(
            json(Event::Renamed {
                from: path("a.md"),
                to: path("b.md")
            }),
            r#"{"type":"renamed","from":"a.md","to":"b.md"}"#
        );
        assert_eq!(json(Event::Resync), r#"{"type":"resync"}"#);
    }
}
