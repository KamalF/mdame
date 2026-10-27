mod common;

use std::os::unix::fs::symlink;
use std::path::Path;

use axum::http::StatusCode;
use common::get_json;
use mdame::app::AppState;
use mdame::config::HistoryMode;
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
    for id in ["1.md/../../b.md/1000.md", "../b.md/1000.md", "1001.md", ""] {
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
