//! Watcher cases ported from mdlive's `tests/websocket_test.rs`.

mod common;

use std::fs;
use std::path::PathBuf;
use std::time::Duration;

use mdame::app::AppState;
use mdame::watch::{EVENT_CAPACITY, Event};
use tokio::sync::broadcast::{self, Receiver};
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
        Watched::in_dir(common::tempdir(), files)
    }

    /// For a `dir` prepared before the workspace opens.
    fn in_dir(dir: tempfile::TempDir, files: &[(&str, &[u8])]) -> Watched {
        let state = common::workspace(dir.path(), files);
        let mut events = state.events.subscribe();
        // On macOS, FSEvents can report the creation of these files after
        // the watch starts. On the runner of CI, these events came with
        // the events of the test.
        if cfg!(target_os = "macos") {
            drop_until_quiet(&mut events);
        }
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
        assert!(
            same(&events, expected),
            "expected {expected:?}, got {events:?}"
        );
    }
}

/// Drops the events of the next `FIRST_EVENT`, then those that follow until
/// none came for `QUIET`.
fn drop_until_quiet(events: &mut Receiver<Event>) {
    let mut wait = FIRST_EVENT;
    loop {
        std::thread::sleep(wait);
        let mut dropped = false;
        while events.try_recv().is_ok() {
            dropped = true;
        }
        if !dropped {
            return;
        }
        wait = QUIET;
    }
}

/// In any order. On macOS, a write can be `created`: for some seconds after
/// the creation of a file, FSEvents keeps reporting it.
fn same(events: &[Event], expected: &[Event]) -> bool {
    let matches = |expected: &Event, event: &Event| {
        expected == event
            || cfg!(target_os = "macos")
                && matches!(
                    (expected, event),
                    (Event::Changed { path }, Event::Created { path: created }) if path == created
                )
    };
    events.len() == expected.len()
        && expected
            .iter()
            .all(|expected| events.iter().any(|event| matches(expected, event)))
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

fn renamed(from: &str, to: &str) -> Event {
    Event::Renamed {
        from: from.to_owned(),
        to: to.to_owned(),
    }
}

/// On macOS, the disk gives the kinds of the events: FSEvents merges the
/// events of a path, and never tells the side of a rename.
fn per_os<'a>(linux: &'a [Event], macos: &'a [Event]) -> &'a [Event] {
    if cfg!(target_os = "macos") {
        macos
    } else {
        linux
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
    watched
        .assert_next(per_os(
            &[renamed("a.md", "a.md~"), created("a.md")],
            &[created("a.md"), created("a.md~")],
        ))
        .await;
}

#[tokio::test]
async fn symlinked_folder_out_of_the_workspace_is_not_watched() {
    let dir = common::tempdir();
    let outside = dir.path().join("outside");
    fs::create_dir_all(&outside).unwrap();
    fs::create_dir_all(dir.path().join("ws")).unwrap();
    std::os::unix::fs::symlink(&outside, dir.path().join("ws/link")).unwrap();
    let mut watched = Watched::in_dir(dir, &[A]);
    fs::write(outside.join("private.md"), "").unwrap();
    watched.assert_next(&[]).await;
}

#[tokio::test]
async fn save_through_a_temporary_file_creates_it() {
    let mut watched = Watched::new(&[A]);
    let temporary = watched.path("a.md.tmp.12345");
    fs::write(&temporary, "# Saved\n").unwrap();
    fs::rename(&temporary, watched.path("a.md")).unwrap();
    watched
        .assert_next(per_os(
            &[created("a.md")],
            &[removed("a.md.tmp.12345"), created("a.md")],
        ))
        .await;
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
        .assert_next(per_os(
            &[removed("a.md"), created("a.md")],
            &[created("a.md")],
        ))
        .await;
}

#[tokio::test]
async fn folder_deleted_then_created_is_removed_and_created() {
    let mut watched = Watched::new(&[A, ("docs/child.md", b"")]);
    fs::remove_dir_all(watched.path("docs")).unwrap();
    fs::create_dir(watched.path("docs")).unwrap();
    let events = watched.next().await;
    let (linux, macos) = ([removed("docs"), created("docs")], [created("docs")]);
    let expected = per_os(&linux, &macos);
    // On the macOS runner of CI, FSEvents once also reported a change of
    // `docs`, before its creation.
    let with_change = [changed("docs"), created("docs")];
    assert!(
        same(&events, expected) || cfg!(target_os = "macos") && events == with_change,
        "expected {expected:?}, got {events:?}"
    );
}

#[tokio::test]
async fn folder_swapped_through_moves_is_removed_and_created() {
    let mut watched = Watched::new(&[A, ("docs/a.md", b"")]);
    let outside = common::tempdir();
    fs::create_dir(outside.path().join("new")).unwrap();
    fs::write(outside.path().join("new/b.md"), "").unwrap();
    fs::rename(watched.path("docs"), outside.path().join("old")).unwrap();
    fs::rename(outside.path().join("new"), watched.path("docs")).unwrap();
    watched
        .assert_next(per_os(
            &[removed("docs"), created("docs"), created("docs/b.md")],
            &[created("docs"), created("docs/b.md")],
        ))
        .await;
}

#[tokio::test]
async fn renames_are_paired() {
    let mut watched = Watched::new(&[A, ("sub/b.md", b"")]);
    fs::rename(watched.path("a.md"), watched.path("c.md")).unwrap();
    fs::rename(watched.path("sub"), watched.path("moved")).unwrap();
    watched
        .assert_next(per_os(
            &[renamed("a.md", "c.md"), renamed("sub", "moved")],
            &[
                removed("a.md"),
                created("c.md"),
                removed("sub"),
                created("moved"),
                created("moved/b.md"),
            ],
        ))
        .await;
}

#[tokio::test]
async fn populated_folder_moved_in_is_created() {
    let mut watched = Watched::new(&[A]);
    let staging = common::tempdir();
    let source = staging.path().join("moved");
    fs::create_dir(&source).unwrap();
    fs::write(source.join("inner.md"), "# Inner\n").unwrap();
    fs::rename(&source, watched.path("moved")).unwrap();
    watched
        .assert_next(&[created("moved"), created("moved/inner.md")])
        .await;
}

#[tokio::test]
#[cfg_attr(
    target_os = "macos",
    ignore = "notify-debouncer-full drops the events of a folder delete on FSEvents: a known issue"
)]
async fn folder_delete_is_one_removal() {
    let mut watched = Watched::new(&[A, ("doomed/child.md", b"")]);
    fs::remove_dir_all(watched.path("doomed")).unwrap();
    watched.assert_next(&[removed("doomed")]).await;
}

#[tokio::test]
async fn unreadable_folder_does_not_stop_the_watch() {
    use std::os::unix::fs::PermissionsExt;
    let dir = common::tempdir();
    let locked = dir.path().join("ws/locked");
    fs::create_dir_all(&locked).unwrap();
    fs::set_permissions(&locked, fs::Permissions::from_mode(0o000)).unwrap();
    let mut watched = Watched::in_dir(dir, &[A, ("sub/b.md", b"")]);
    fs::write(watched.path("sub/b.md"), "# B\n").unwrap();
    let result = watched.next().await;
    fs::set_permissions(&locked, fs::Permissions::from_mode(0o755)).unwrap();
    assert!(same(&result, &[changed("sub/b.md")]), "got {result:?}");
}

#[tokio::test]
async fn reading_the_tree_sends_nothing() {
    // More folders than the burst threshold: each one is opened.
    let paths: Vec<String> = (0..150).map(|i| format!("d{i}/a.md")).collect();
    let files: Vec<(&str, &[u8])> = paths.iter().map(|path| (path.as_str(), &b""[..])).collect();
    let mut watched = Watched::new(&files);
    mdame::tree::build(&watched.state.workspace);
    watched.assert_next(&[]).await;
}

#[tokio::test]
async fn burst_gives_resync() {
    // The threshold applies to each batch, and the debouncer sends a batch
    // every 50 ms. If the writes are slow, as on a busy Mac, they spread
    // over batches of 100 events or fewer. So the test tries 3 bursts.
    for _ in 0..3 {
        let mut watched = Watched::new(&[A]);
        for i in 0..300 {
            fs::write(watched.path(&format!("{i}.md")), "").unwrap();
        }
        if watched.next().await.contains(&Event::Resync) {
            return;
        }
    }
    panic!("no resync in 3 bursts");
}

#[tokio::test]
async fn a_change_in_a_gitignored_folder_sends_nothing() {
    let mut watched = Watched::new(&[(".gitignore", b"build/\n"), ("build/a.md", b"")]);
    fs::write(watched.path("build/a.md"), "# Built\n").unwrap();
    fs::create_dir(watched.path("build/sub")).unwrap();
    watched.assert_next(&[]).await;
}

#[tokio::test]
async fn a_new_folder_is_watched() {
    let mut watched = Watched::new(&[A]);
    fs::create_dir(watched.path("notes")).unwrap();
    watched.assert_next(&[created("notes")]).await;
    fs::write(watched.path("notes/b.md"), "# B\n").unwrap();
    watched.assert_next(&[created("notes/b.md")]).await;
}

#[tokio::test]
async fn a_file_written_right_after_its_folder_is_created_is_seen() {
    let mut watched = Watched::new(&[A]);
    fs::create_dir_all(watched.path("notes/deep")).unwrap();
    fs::write(watched.path("notes/deep/b.md"), "# B\n").unwrap();
    watched
        .assert_next(&[
            created("notes"),
            created("notes/deep"),
            created("notes/deep/b.md"),
        ])
        .await;
}

#[tokio::test]
async fn a_renamed_folder_stays_watched() {
    let mut watched = Watched::new(&[A, ("sub/b.md", b"")]);
    fs::rename(watched.path("sub"), watched.path("moved")).unwrap();
    watched
        .assert_next(per_os(
            &[renamed("sub", "moved")],
            &[removed("sub"), created("moved"), created("moved/b.md")],
        ))
        .await;
    fs::write(watched.path("moved/b.md"), "# B\n").unwrap();
    watched.assert_next(&[changed("moved/b.md")]).await;
}

#[tokio::test]
async fn a_folder_that_a_gitignore_change_shows_is_watched() {
    let mut watched = Watched::new(&[(".gitignore", b"build/\n"), ("build/a.md", b"")]);
    fs::write(watched.path(".gitignore"), "").unwrap();
    watched
        .assert_next(&[changed(".gitignore"), created("build/a.md")])
        .await;
    fs::write(watched.path("build/a.md"), "# Built\n").unwrap();
    watched.assert_next(&[changed("build/a.md")]).await;
}

#[tokio::test]
async fn a_folder_that_a_gitignore_change_hides_sends_nothing() {
    let mut watched = Watched::new(&[A, ("build/a.md", b"")]);
    fs::write(watched.path(".gitignore"), "build/\n").unwrap();
    watched.assert_next(&[created(".gitignore")]).await;
    fs::write(watched.path("build/a.md"), "# Built\n").unwrap();
    watched.assert_next(&[]).await;
}

#[tokio::test]
async fn a_folder_created_again_stays_watched() {
    let mut watched = Watched::new(&[A, ("docs/a.md", b"")]);
    fs::remove_dir_all(watched.path("docs")).unwrap();
    fs::create_dir(watched.path("docs")).unwrap();
    watched
        .assert_next(per_os(
            &[removed("docs"), created("docs")],
            &[created("docs")],
        ))
        .await;
    fs::write(watched.path("docs/b.md"), "# B\n").unwrap();
    watched.assert_next(&[created("docs/b.md")]).await;
}

#[tokio::test]
async fn a_folder_swapped_through_moves_stays_watched() {
    let mut watched = Watched::new(&[A, ("docs/a.md", b"")]);
    let outside = common::tempdir();
    fs::create_dir(outside.path().join("new")).unwrap();
    fs::rename(watched.path("docs"), outside.path().join("old")).unwrap();
    fs::rename(outside.path().join("new"), watched.path("docs")).unwrap();
    watched
        .assert_next(per_os(
            &[removed("docs"), created("docs")],
            &[created("docs")],
        ))
        .await;
    fs::write(watched.path("docs/b.md"), "# B\n").unwrap();
    watched.assert_next(&[created("docs/b.md")]).await;
}

#[tokio::test]
async fn a_tab_connected_during_the_first_walk_gets_a_resync() {
    let dir = common::tempdir();
    let (sender, mut events) = broadcast::channel(EVENT_CAPACITY);
    let _watcher = mdame::watch::start(dir.path(), sender).unwrap();
    let event = timeout(FIRST_EVENT, events.recv()).await.unwrap().unwrap();
    assert_eq!(event, Event::Resync);
}
