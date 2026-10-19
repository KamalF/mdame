use std::path::Path;
use std::time::Duration;

use notify_debouncer_full::notify::{
    self, RecommendedWatcher, RecursiveMode,
    event::{EventKind, ModifyKind, RenameMode},
};
use notify_debouncer_full::{Debouncer, RecommendedCache, new_debouncer_opt};
use serde::Serialize;
use tokio::sync::{broadcast, mpsc};

pub const EVENT_CAPACITY: usize = 256;

/// A batch with more events than this, for example after a `git checkout`,
/// is sent as one `resync`.
pub const BURST_THRESHOLD: usize = 100;

const DEBOUNCE: Duration = Duration::from_millis(200);

pub type Watcher = Debouncer<RecommendedWatcher, RecommendedCache>;

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Event {
    Changed { path: String },
    Created { path: String },
    Removed { path: String },
    Renamed { from: String, to: String },
    Workspace { root: String },
    Resync,
}

/// Sends the events under `root` on `sender` until the watcher is dropped.
pub fn start(root: &Path, sender: broadcast::Sender<Event>) -> notify::Result<Watcher> {
    let (batches, mut received) = mpsc::channel(16);
    // The debouncer calls back on its own thread, outside tokio.
    let handler = move |batch| {
        let _ = batches.blocking_send(batch);
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
    debouncer.watch(root, RecursiveMode::Recursive)?;
    let root = root.to_owned();
    tokio::spawn(async move {
        while let Some(batch) = received.recv().await {
            match batch {
                Ok(batch) => {
                    let batch: Vec<_> = batch.into_iter().map(|event| event.event).collect();
                    for event in events(&root, &batch) {
                        // An error only means that no tab is connected.
                        let _ = sender.send(event);
                    }
                }
                Err(errors) => {
                    for error in errors {
                        tracing::warn!("watcher: {error}");
                    }
                }
            }
        }
    });
    Ok(debouncer)
}

/// Turns one debounced batch into events with workspace-relative paths.
pub fn events(root: &Path, batch: &[notify::Event]) -> Vec<Event> {
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
            relative(root, path)
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

/// `None` for paths outside the root, under `.mdame/` or a symlink, or not
/// UTF-8.
fn relative(root: &Path, path: &Path) -> Option<String> {
    let relative = path.strip_prefix(root).ok()?;
    if relative.starts_with(".mdame") || below_a_link(root, relative) {
        return None;
    }
    let relative = relative.to_str()?;
    (!relative.is_empty()).then(|| relative.to_owned())
}

/// notify still watches a folder that is replaced by a symlink right after
/// its creation, so the events of an outside folder can come through it.
fn below_a_link(root: &Path, relative: &Path) -> bool {
    let mut ancestor = root.to_owned();
    let mut parents = relative.parent().into_iter().flat_map(Path::components);
    parents.any(|part| {
        ancestor.push(part);
        ancestor
            .symlink_metadata()
            .is_ok_and(|m| m.file_type().is_symlink())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use notify_debouncer_full::notify::event::{
        AccessKind, CreateKind, DataChange, Flag, RemoveKind,
    };
    use std::path::PathBuf;

    const ROOT: &str = "/ws";

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
        events(Path::new(ROOT), batch)
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
    fn paths_below_a_symlink_are_skipped() {
        let dir = tempfile::tempdir().unwrap();
        let outside = dir.path().join("outside");
        std::fs::create_dir_all(outside.join("deep")).unwrap();
        std::fs::create_dir(dir.path().join("ws")).unwrap();
        std::os::unix::fs::symlink(&outside, dir.path().join("ws/x")).unwrap();
        let root = dir.path().join("ws");
        let below = root.join("x/deep/private.md");
        let batch = [
            create(below.to_str().unwrap()),
            create(root.join("x").to_str().unwrap()),
        ];
        assert_eq!(events(&root, &batch), [Event::Created { path: path("x") }]);
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
