//! Watcher cases ported from mdlive's `tests/websocket_test.rs`.

mod common;

use std::fs;
use std::path::PathBuf;
use std::time::Duration;

use mdame::app::AppState;
use mdame::watch::Event;
use tokio::sync::broadcast::Receiver;
use tokio::time::timeout;

const FIRST_EVENT: Duration = Duration::from_secs(2);
/// Longer than the debounce, so that a batch split over two ticks still
/// arrives whole.
const QUIET: Duration = Duration::from_millis(500);

struct Watched {
    dir: tempfile::TempDir,
    state: AppState,
    events: Receiver<Event>,
}

impl Watched {
    fn new(files: &[(&str, &[u8])]) -> Watched {
        let dir = tempfile::tempdir().unwrap();
        let state = common::workspace(dir.path(), files);
        let events = state.events.subscribe();
        Watched { dir, state, events }
    }

    fn path(&self, relative: &str) -> PathBuf {
        self.dir.path().join("ws").join(relative)
    }

    /// The events until none came for `QUIET`.
    async fn next(&mut self) -> Vec<Event> {
        let mut events = Vec::new();
        let mut wait = FIRST_EVENT;
        while let Ok(event) = timeout(wait, self.events.recv()).await {
            events.push(event.unwrap());
            wait = QUIET;
        }
        events
    }

    async fn assert_next(&mut self, expected: &[Event]) {
        let events = self.next().await;
        let same = events.len() == expected.len() && expected.iter().all(|e| events.contains(e));
        assert!(same, "expected {expected:?}, got {events:?}");
    }
}

fn changed(path: &str) -> Event {
    Event::Changed {
        path: path.to_owned(),
    }
}

fn created(path: &str) -> Event {
    Event::Created {
        path: path.to_owned(),
    }
}

fn removed(path: &str) -> Event {
    Event::Removed {
        path: path.to_owned(),
    }
}

const A: (&str, &[u8]) = ("a.md", b"# A\n");

#[tokio::test]
async fn write_is_a_change() {
    let mut watched = Watched::new(&[A]);
    fs::write(watched.path("a.md"), "# Changed\n").unwrap();
    watched.assert_next(&[changed("a.md")]).await;
}

#[tokio::test]
async fn new_file_and_folder_are_created() {
    let mut watched = Watched::new(&[A]);
    fs::write(watched.path("b.md"), "# B\n").unwrap();
    fs::create_dir(watched.path("notes")).unwrap();
    watched
        .assert_next(&[created("b.md"), created("notes")])
        .await;
}

#[tokio::test]
async fn vim_save_recreates_the_file() {
    let mut watched = Watched::new(&[A]);
    let (file, backup) = (watched.path("a.md"), watched.path("a.md~"));
    fs::rename(&file, &backup).unwrap();
    fs::write(&file, "# Saved\n").unwrap();
    fs::remove_file(&backup).unwrap();
    watched
        .assert_next(&[created("a.md"), removed("a.md~")])
        .await;
}

#[tokio::test]
async fn emacs_save_is_a_rename_then_a_creation() {
    let mut watched = Watched::new(&[A]);
    let file = watched.path("a.md");
    fs::rename(&file, watched.path("a.md~")).unwrap();
    fs::write(&file, "# Saved\n").unwrap();
    let renamed = Event::Renamed {
        from: "a.md".to_owned(),
        to: "a.md~".to_owned(),
    };
    watched.assert_next(&[renamed, created("a.md")]).await;
}

#[tokio::test]
async fn symlinked_folder_out_of_the_workspace_is_not_watched() {
    let dir = tempfile::tempdir().unwrap();
    let outside = dir.path().join("outside");
    fs::create_dir_all(&outside).unwrap();
    fs::create_dir_all(dir.path().join("ws")).unwrap();
    std::os::unix::fs::symlink(&outside, dir.path().join("ws/link")).unwrap();
    let state = common::workspace(dir.path(), &[A]);
    let mut watched = Watched {
        events: state.events.subscribe(),
        dir,
        state,
    };
    fs::write(outside.join("private.md"), "").unwrap();
    watched.assert_next(&[]).await;
}

#[tokio::test]
async fn save_through_a_temporary_file_creates_it() {
    let mut watched = Watched::new(&[A]);
    let temporary = watched.path("a.md.tmp.12345");
    fs::write(&temporary, "# Saved\n").unwrap();
    tokio::time::sleep(Duration::from_millis(100)).await;
    fs::rename(&temporary, watched.path("a.md")).unwrap();
    watched.assert_next(&[created("a.md")]).await;
}

#[tokio::test]
async fn delete_is_a_removal() {
    let mut watched = Watched::new(&[A]);
    fs::remove_file(watched.path("a.md")).unwrap();
    watched.assert_next(&[removed("a.md")]).await;
}

#[tokio::test]
async fn delete_then_create_is_removed_and_created() {
    let mut watched = Watched::new(&[A]);
    fs::remove_file(watched.path("a.md")).unwrap();
    fs::write(watched.path("a.md"), "# Rewritten\n").unwrap();
    watched
        .assert_next(&[removed("a.md"), created("a.md")])
        .await;
}

#[tokio::test]
async fn folder_deleted_then_created_is_removed_and_created() {
    let mut watched = Watched::new(&[A, ("docs/child.md", b"")]);
    fs::remove_dir_all(watched.path("docs")).unwrap();
    fs::create_dir(watched.path("docs")).unwrap();
    watched
        .assert_next(&[removed("docs"), created("docs")])
        .await;
}

#[tokio::test]
async fn folder_swapped_through_moves_is_removed_and_created() {
    let mut watched = Watched::new(&[A, ("docs/a.md", b"")]);
    let outside = tempfile::tempdir().unwrap();
    fs::create_dir(outside.path().join("new")).unwrap();
    fs::write(outside.path().join("new/b.md"), "").unwrap();
    fs::rename(watched.path("docs"), outside.path().join("old")).unwrap();
    fs::rename(outside.path().join("new"), watched.path("docs")).unwrap();
    watched
        .assert_next(&[removed("docs"), created("docs")])
        .await;
}

#[tokio::test]
async fn renames_are_paired() {
    let mut watched = Watched::new(&[A, ("sub/b.md", b"")]);
    fs::rename(watched.path("a.md"), watched.path("c.md")).unwrap();
    fs::rename(watched.path("sub"), watched.path("moved")).unwrap();
    let renamed = |from: &str, to: &str| Event::Renamed {
        from: from.to_owned(),
        to: to.to_owned(),
    };
    watched
        .assert_next(&[renamed("a.md", "c.md"), renamed("sub", "moved")])
        .await;
}

#[tokio::test]
async fn populated_folder_moved_in_is_created() {
    let mut watched = Watched::new(&[A]);
    let staging = tempfile::tempdir().unwrap();
    let source = staging.path().join("moved");
    fs::create_dir(&source).unwrap();
    fs::write(source.join("inner.md"), "# Inner\n").unwrap();
    fs::rename(&source, watched.path("moved")).unwrap();
    watched.assert_next(&[created("moved")]).await;
}

#[tokio::test]
async fn folder_delete_is_one_removal() {
    let mut watched = Watched::new(&[A, ("doomed/child.md", b"")]);
    fs::remove_dir_all(watched.path("doomed")).unwrap();
    watched.assert_next(&[removed("doomed")]).await;
}

#[tokio::test]
async fn mdame_folder_is_ignored() {
    let mut watched = Watched::new(&[A, (".mdame/history/a.md/1.md", b"")]);
    fs::write(watched.path(".mdame/history/a.md/2.md"), "").unwrap();
    watched.assert_next(&[]).await;
}

#[tokio::test]
async fn reading_the_tree_sends_nothing() {
    // More folders than the burst threshold: each one is opened.
    let paths: Vec<String> = (0..150).map(|i| format!("d{i}/a.md")).collect();
    let files: Vec<(&str, &[u8])> = paths.iter().map(|path| (path.as_str(), &b""[..])).collect();
    let mut watched = Watched::new(&files);
    mdame::tree::build(&watched.state.workspace().unwrap());
    watched.assert_next(&[]).await;
}

#[tokio::test]
async fn burst_gives_resync() {
    let mut watched = Watched::new(&[A]);
    for i in 0..300 {
        fs::write(watched.path(&format!("{i}.md")), "").unwrap();
    }
    // A batch can be split over two ticks, so one part holds over 100.
    let events = watched.next().await;
    assert!(events.contains(&Event::Resync), "got {events:?}");
}

#[tokio::test]
async fn watcher_stops_with_the_workspace() {
    let mut watched = Watched::new(&[A]);
    drop(watched.state.workspace.write().unwrap().take());
    fs::write(watched.path("a.md"), "# Changed\n").unwrap();
    watched.assert_next(&[]).await;
}
