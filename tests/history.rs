mod common;

use std::fs::{self, Permissions};
use std::os::unix::fs::{PermissionsExt, symlink};
use std::path::Path;

use axum::http::{Method, StatusCode};
use axum::response::Response;
use common::{HOST, JSON, etag, etag_of, get_json, send_body};
use mdame::app::AppState;
use mdame::config::HistoryMode;
use mdame::history::encode_path;
use serde_json::json;

/// A workspace with `a.md` and two of its revisions.
fn workspace(dir: &Path) -> AppState {
    common::workspace(
        dir,
        &[
            ("a.md", b"# C\n"),
            (".mdame/history/a.md/999.md", b"# A\n"),
            (".mdame/history/a.md/1000.md", b"# Bb\n"),
        ],
    )
}

#[tokio::test]
async fn history_lists_the_revisions_newest_first() {
    let dir = tempfile::tempdir().unwrap();
    workspace(dir.path());
    symlink("a.md", dir.path().join("ws/link.md")).unwrap();
    // A link lists the revisions of its file.
    for path in ["a.md", "link.md"] {
        let uri = format!("/api/history?path={path}");
        let (status, revisions) = get_json(workspace(dir.path()), &uri).await;

        assert_eq!(status, StatusCode::OK, "{path}");
        let expected = json!([
            { "id": "1000.md", "time": 1000, "size": 5 },
            { "id": "999.md", "time": 999, "size": 4 },
        ]);
        assert_eq!(revisions, expected, "{path}");
    }
}

#[tokio::test]
async fn history_of_a_file_never_saved_is_empty() {
    let dir = tempfile::tempdir().unwrap();
    let files: [(&str, &[u8]); 2] = [("a.md", b"# A\n"), (".mdame/history/b.md/1.md", b"")];
    let state = common::workspace(dir.path(), &files);
    let (status, revisions) = get_json(state, "/api/history?path=a.md").await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(revisions, json!([]));
}

#[tokio::test]
async fn listing_creates_no_history_folder() {
    for mode in [HistoryMode::Workspace, HistoryMode::State] {
        let dir = tempfile::tempdir().unwrap();
        let mut state = common::workspace(dir.path(), &[("a.md", b"# A\n")]);
        state.state_dir = dir.path().join("state");
        state.config.get_mut().unwrap().history = Some(mode);
        let (status, revisions) = get_json(state, "/api/history?path=a.md").await;

        assert_eq!(status, StatusCode::OK, "{mode:?}");
        assert_eq!(revisions, json!([]), "{mode:?}");
        assert!(!dir.path().join("ws/.mdame").exists(), "{mode:?}");
        assert!(!dir.path().join("state").exists(), "{mode:?}");
    }
}

#[tokio::test]
async fn a_history_folder_that_is_a_link_is_refused() {
    // A crafted repository: pruning would delete the notes there.
    for (link, target) in [(".mdame", "notes"), (".mdame/history", "../notes")] {
        let dir = tempfile::tempdir().unwrap();
        let files: [(&str, &[u8]); 2] = [("a.md", b"old\n"), ("notes/1000.md", b"note\n")];
        common::workspace(dir.path(), &files);
        let link = dir.path().join("ws").join(link);
        fs::create_dir_all(link.parent().unwrap()).unwrap();
        symlink(target, &link).unwrap();
        let headers = [HOST, JSON, ("if-match", &etag(b"old\n"))];
        let body = json!({ "content": "new\n" }).to_string();
        let state = common::workspace(dir.path(), &files);
        let saved = send_body(state, Method::PUT, "/api/file?path=a.md", &headers, &body).await;
        let state = common::workspace(dir.path(), &files);
        let (listed, _) = get_json(state, "/api/history?path=a.md").await;

        assert_eq!(
            saved.status(),
            StatusCode::INTERNAL_SERVER_ERROR,
            "{target}"
        );
        assert_eq!(listed, StatusCode::INTERNAL_SERVER_ERROR, "{target}");
        assert!(!dir.path().join("ws/notes/a.md").exists(), "{target}");
        assert!(!dir.path().join("ws/notes/history").exists(), "{target}");
    }
}

#[tokio::test]
async fn history_view_returns_the_revision_text() {
    let dir = tempfile::tempdir().unwrap();
    let uri = "/api/history/view?path=a.md&id=999.md";
    let (status, body) = get_json(workspace(dir.path()), uri).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, json!({ "content": "# A\n" }));
}

#[tokio::test]
async fn an_id_names_a_revision_of_this_file_only() {
    let dir = tempfile::tempdir().unwrap();
    let files: [(&str, &[u8]); 4] = [
        ("a.md", b"# A\n"),
        (".mdame/history/b.md/1000.md", b"# B\n"),
        // The revision of a file `a.md/1.md`, from before `a.md` was a file:
        // `1.md` is a folder.
        (".mdame/history/a.md/1.md/1000.md", b"# 1\n"),
        (".mdame/history/a.md/1000.md", b"# A0\n"),
    ];
    for id in [
        "1.md/../../b.md/1000.md",
        "../b.md/1000.md",
        "1.md",
        "1.%00md",
        "1001.md",
        "",
    ] {
        let state = common::workspace(dir.path(), &files);
        let uri = format!("/api/history/view?path=a.md&id={id}");
        let (status, body) = get_json(state, &uri).await;

        assert_eq!(status, StatusCode::NOT_FOUND, "{id}");
        assert_eq!(body["error"]["message"], "a.md: no such revision", "{id}");
    }
    // No history folder: no id names a revision.
    let dir = tempfile::tempdir().unwrap();
    let state = common::workspace(dir.path(), &[("a.md", b"# A\n")]);
    let (status, _) = get_json(state, "/api/history/view?path=a.md&id=1000.md").await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn history_view_refuses_a_revision_that_is_not_utf8() {
    let dir = tempfile::tempdir().unwrap();
    let files: [(&str, &[u8]); 2] = [
        ("a.md", b"# A\n"),
        (".mdame/history/a.md/1000.md", b"\xff\n"),
    ];
    let state = common::workspace(dir.path(), &files);
    let (status, body) = get_json(state, "/api/history/view?path=a.md&id=1000.md").await;

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"]["code"], "not_viewable");
}

#[tokio::test]
async fn history_view_refuses_a_revision_over_the_edit_limit() {
    let dir = tempfile::tempdir().unwrap();
    // The spec's limit, not the constant: a test must fail if the constant moves.
    let limit = 8 * 1024 * 1024;
    let files: [(&str, &[u8]); 3] = [
        ("a.md", b"# A\n"),
        (".mdame/history/a.md/1000.md", &vec![b'a'; limit]),
        (".mdame/history/a.md/1001.md", &vec![b'a'; limit + 1]),
    ];
    for (id, expected) in [
        ("1000.md", StatusCode::OK),
        ("1001.md", StatusCode::PAYLOAD_TOO_LARGE),
    ] {
        let state = common::workspace(dir.path(), &files);
        let uri = format!("/api/history/view?path=a.md&id={id}");
        let (status, _) = get_json(state, &uri).await;
        assert_eq!(status, expected, "{id}");
    }
}

#[tokio::test]
async fn history_view_opens_no_fifo_and_follows_no_link() {
    let dir = tempfile::tempdir().unwrap();
    let files: [(&str, &[u8]); 2] = [("a.md", b"# A\n"), (".mdame/history/a.md/1000.md", b"")];
    common::workspace(dir.path(), &files);
    let folder = dir.path().join("ws/.mdame/history/a.md");
    let fifo = folder.join("1001.md");
    assert!(
        std::process::Command::new("mkfifo")
            .arg(&fifo)
            .status()
            .unwrap()
            .success()
    );
    symlink("1000.md", folder.join("1002.md")).unwrap();
    for id in ["1001.md", "1002.md"] {
        let state = common::workspace(dir.path(), &files);
        let uri = format!("/api/history/view?path=a.md&id={id}");
        let (status, body) = get_json(state, &uri).await;

        assert_eq!(status, StatusCode::NOT_FOUND, "{id}");
        assert_eq!(body["error"]["message"], "a.md: no such revision", "{id}");
    }
}

async fn restore(state: AppState, path: &str, id: &str) -> Response {
    let body = json!({ "path": path, "id": id }).to_string();
    let uri = "/api/history/restore";
    send_body(state, Method::POST, uri, &[HOST, JSON], &body).await
}

fn read(dir: &Path) -> String {
    fs::read_to_string(dir.join("ws/a.md")).unwrap()
}

#[tokio::test]
async fn restore_writes_the_revision_over_the_file() {
    let dir = tempfile::tempdir().unwrap();
    let response = restore(workspace(dir.path()), "a.md", "999.md").await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(etag_of(&response), etag(b"# A\n"));
    assert_eq!(read(dir.path()), "# A\n");
}

#[tokio::test]
async fn restore_keeps_the_current_content_as_a_revision() {
    let dir = tempfile::tempdir().unwrap();
    restore(workspace(dir.path()), "a.md", "999.md").await;
    // No files given: the workspace keeps what the restore wrote.
    let state = common::workspace(dir.path(), &[]);
    let (_, revisions) = get_json(state, "/api/history?path=a.md").await;
    let newest = revisions[0]["id"].as_str().unwrap();
    let response = restore(common::workspace(dir.path(), &[]), "a.md", newest).await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(read(dir.path()), "# C\n");
}

#[tokio::test]
async fn restore_in_state_mode_makes_the_state_folder_private() {
    let dir = tempfile::tempdir().unwrap();
    let mut state = common::workspace(dir.path(), &[("a.md", b"# B\n")]);
    state.state_dir = dir.path().join("state");
    state.config.get_mut().unwrap().history = Some(HistoryMode::State);
    let root = dir.path().join("ws").canonicalize().unwrap();
    let folder = state
        .state_dir
        .join(encode_path(&root))
        .join("history/a.md");
    fs::create_dir_all(&folder).unwrap();
    fs::write(folder.join("999.md"), "# A\n").unwrap();
    // Others could list it: the restore makes it private, as a save does.
    fs::set_permissions(&state.state_dir, Permissions::from_mode(0o755)).unwrap();
    let response = restore(state, "a.md", "999.md").await;

    assert_eq!(response.status(), StatusCode::OK);
    let mode = fs::metadata(dir.path().join("state"))
        .unwrap()
        .permissions()
        .mode();
    assert_eq!(mode & 0o777, 0o700);
}

#[tokio::test]
async fn restore_refuses_a_file_that_is_not_utf8() {
    let dir = tempfile::tempdir().unwrap();
    let files: [(&str, &[u8]); 2] = [
        ("a.md", b"\xff\n"),
        (".mdame/history/a.md/999.md", b"# A\n"),
    ];
    let response = restore(common::workspace(dir.path(), &files), "a.md", "999.md").await;
    let (status, body) = common::status_and_json(response).await;

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"]["code"], "not_viewable");
    assert_eq!(fs::read(dir.path().join("ws/a.md")).unwrap(), b"\xff\n");
}

#[tokio::test]
async fn restore_of_a_deleted_file_is_refused() {
    let dir = tempfile::tempdir().unwrap();
    let state = workspace(dir.path());
    fs::remove_file(dir.path().join("ws/a.md")).unwrap();
    let response = restore(state, "a.md", "999.md").await;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    assert!(!dir.path().join("ws/a.md").exists());
}
