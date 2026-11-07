use std::collections::HashSet;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Condvar, Mutex, PoisonError, Weak, mpsc};
use std::time::{Duration, Instant};

use notify_debouncer_full::notify::{
    self, RecommendedWatcher, RecursiveMode, WatcherKind,
    event::{EventKind, ModifyKind, RenameMode},
};
use notify_debouncer_full::{DebounceEventResult, Debouncer, RecommendedCache, new_debouncer_opt};
use serde::Serialize;
use tokio::sync::broadcast;

use crate::tree;
use crate::workspace::OWN_DIR;

pub const EVENT_CAPACITY: usize = 256;

/// A batch with more events than this, for example after a `git checkout`,
/// is sent as one `resync`.
const BURST_THRESHOLD: usize = 100;

const DEBOUNCE: Duration = Duration::from_millis(200);

type Debounced = Debouncer<RecommendedWatcher, RecommendedCache>;

/// Watches the workspace until it is dropped.
pub struct Watcher {
    _debouncer: Arc<Mutex<Debounced>>,
    started: Arc<Started>,
}

impl Watcher {
    /// Blocks until the folders of the workspace are watched.
    pub fn wait_started(&self) {
        let done = self.started.done.lock();
        let done = done.unwrap_or_else(PoisonError::into_inner);
        drop(self.started.changed.wait_while(done, |done| !*done));
    }
}

#[derive(Default)]
struct Started {
    done: Mutex<bool>,
    changed: Condvar,
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
    let mut debouncer = new_debouncer_opt::<_, RecommendedWatcher, _>(
        DEBOUNCE,
        None,
        handler,
        RecommendedCache::new(),
        config,
    )?;
    if watches_whole_trees() {
        debouncer.watch(root, RecursiveMode::Recursive)?;
    }
    let folders = Folders {
        root: root.to_owned(),
        watched: HashSet::new(),
    };
    let debouncer = Arc::new(Mutex::new(debouncer));
    let weak = Arc::downgrade(&debouncer);
    let started = Arc::<Started>::default();
    let done = Arc::clone(&started);
    // Walking the workspace blocks: not on a thread of tokio.
    std::thread::spawn(move || forward(&received, &weak, folders, &sender, &done));
    Ok(Watcher {
        _debouncer: debouncer,
        started,
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
    started: &Started,
) {
    // Here, not in `start`: notify-debouncer-full 0.7 takes quadratic time
    // to watch folders one by one, 12 s for 15,000.
    let Some(first) = debouncer.upgrade() else {
        return;
    };
    folders.update(&mut first.lock().unwrap_or_else(PoisonError::into_inner));
    drop(first);
    *started.done.lock().unwrap_or_else(PoisonError::into_inner) = true;
    started.changed.notify_all();
    let mut renamed = Vec::new();
    for batch in received {
        let batch: Vec<_> = match batch {
            Ok(batch) => batch.into_iter().map(|event| event.event).collect(),
            Err(errors) => {
                for error in errors {
                    tracing::warn!("watcher: {error}");
                }
                continue;
            }
        };
        let mut found = Vec::new();
        if batch.iter().any(changes_folders) {
            let Some(debouncer) = debouncer.upgrade() else {
                return;
            };
            let mut debouncer = debouncer.lock().unwrap_or_else(PoisonError::into_inner);
            found = folders.update(&mut debouncer);
        }
        let mut events = events(&folders, &batch, &found);
        drop_echoes(&mut events, &mut renamed, Instant::now());
        for event in events {
            // An error only means that no tab is connected.
            let _ = sender.send(event);
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

/// A write changes the folders that the tree shows only in an ignore file.
fn changes_folders(event: &notify::Event) -> bool {
    match event.kind {
        EventKind::Access(_) => false,
        EventKind::Modify(ModifyKind::Data(_)) => event.paths.iter().any(|path| {
            path.file_name()
                .is_some_and(|name| name == ".gitignore" || name == ".ignore")
        }),
        _ => true,
    }
}

/// The folders that the tree shows, as of the last walk.
struct Folders {
    root: PathBuf,
    watched: HashSet<PathBuf>,
}

impl Folders {
    /// Walks the workspace again, and watches what it finds. Gives the
    /// entries of the folders that were not watched before: they may have
    /// been written before their folder's watch.
    fn update(&mut self, debouncer: &mut Debounced) -> Vec<PathBuf> {
        // At the start, no event can be missed yet.
        let start = self.watched.is_empty();
        let mut folders = HashSet::new();
        let mut found = Vec::new();
        for entry in tree::walker(&self.root).filter_map(Result::ok) {
            let is_folder = entry.file_type().is_some_and(|kind| kind.is_dir());
            let path = entry.into_path();
            let parent = path.parent().filter(|parent| folders.contains(*parent));
            if !start && parent.is_some_and(|parent| !self.watched.contains(parent)) {
                found.push(path.clone());
            }
            if is_folder {
                folders.insert(path);
            }
        }
        if !watches_whole_trees() {
            watch_folders(debouncer, &self.watched, &folders);
        }
        self.watched = folders;
        found
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

fn watch_folders(debouncer: &mut Debounced, old: &HashSet<PathBuf>, new: &HashSet<PathBuf>) {
    for gone in old.difference(new) {
        // notify has removed the watch of a folder deleted or moved away.
        let _ = debouncer.unwatch(gone);
    }
    for folder in new.difference(old) {
        match debouncer.watch(folder, RecursiveMode::NonRecursive) {
            Ok(()) => {}
            Err(error) if can_skip(&error) => {
                tracing::warn!("not watched: {}", folder.display());
            }
            Err(error) => {
                tracing::warn!("live updates miss new folders: {error}");
                return;
            }
        }
    }
}

fn can_skip(error: &notify::Error) -> bool {
    match &error.kind {
        notify::ErrorKind::PathNotFound => true,
        notify::ErrorKind::Io(io) => io.kind() == ErrorKind::PermissionDenied,
        _ => false,
    }
}

/// Turns one debounced batch into events with workspace-relative paths.
/// `found` holds the entries of the folders that mdame started to watch
/// after the batch.
fn events(folders: &Folders, batch: &[notify::Event], found: &[PathBuf]) -> Vec<Event> {
    // Reads count for nothing: mdame's own tree walk opens every folder,
    // and a resync makes each tab walk it again.
    let batch: Vec<_> = batch
        .iter()
        .filter(|event| !matches!(event.kind, EventKind::Access(_)))
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
    // A folder created or moved in may hold entries written before its
    // watch. A renamed folder holds none.
    let created: Vec<PathBuf> = events
        .iter()
        .filter_map(|event| match event {
            Event::Created { path } => Some(PathBuf::from(path)),
            _ => None,
        })
        .collect();
    for path in found.iter().filter_map(|path| folders.relative(path)) {
        if created
            .iter()
            .any(|folder| Path::new(&path).starts_with(folder))
        {
            push(&mut events, Event::Created { path });
        }
    }
    if events.len() > BURST_THRESHOLD {
        return vec![Event::Resync];
    }
    events
}

/// Sends each event once, and no change to a file created in the batch.
/// Nothing else is merged: a delete then create, or a rename to a backup
/// then create, can be a save or a folder swapped for another, and the
/// browser tells them apart by asking for the open file again.
fn push(events: &mut Vec<Event>, event: Event) {
    if let Event::Changed { path } = &event
        && events.contains(&Event::Created { path: path.clone() })
    {
        return;
    }
    if !events.contains(&event) {
        events.push(event);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use notify_debouncer_full::notify::event::{
        AccessKind, CreateKind, DataChange, Flag, RemoveKind,
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
        let batch = [create("/ws/a.md"), write("/ws/a.md")];
        assert_eq!(map(&batch), [Event::Created { path: path("a.md") }]);
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
        let denied = std::io::Error::from(ErrorKind::PermissionDenied);
        assert!(can_skip(&notify::Error::io(denied)));
        assert!(can_skip(&notify::Error::path_not_found()));
        assert!(!can_skip(&notify::Error::new(
            notify::ErrorKind::MaxFilesWatch
        )));
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
