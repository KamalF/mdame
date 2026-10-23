mod common;

use std::fs;
use std::path::Path;

use axum::http::{Method, StatusCode};
use axum::response::Response;
use common::{HOST, etag, etag_of, send_body, status_and_json};
use mdame::app::AppState;
use mdame::document::{EDIT_LIMIT, version};
use serde_json::json;

const JSON: (&str, &str) = ("content-type", "application/json");

/// Saves `content` to `path`, with `If-Match` when `if_match` is given.
async fn put(state: AppState, path: &str, if_match: Option<&str>, content: &str) -> Response {
    let uri = format!("/api/file?path={path}");
    let body = json!({ "content": content }).to_string();
    let mut headers = vec![HOST, JSON];
    if let Some(tag) = if_match {
        headers.push(("if-match", tag));
    }
    send_body(state, Method::PUT, &uri, &headers, &body).await
}

fn workspace(dir: &Path) -> AppState {
    common::workspace(dir, &[("a.md", b"old\n")])
}

fn read(dir: &Path, path: &str) -> String {
    fs::read_to_string(dir.join("ws").join(path)).unwrap()
}

fn snapshots(dir: &Path, path: &str) -> Vec<String> {
    let folder = dir.join("ws/.mdame/history").join(path);
    let Ok(entries) = fs::read_dir(folder) else {
        return Vec::new();
    };
    entries
        .map(|entry| fs::read_to_string(entry.unwrap().path()).unwrap())
        .collect()
}

#[tokio::test]
async fn save_writes_the_content_when_the_version_matches() {
    let dir = tempfile::tempdir().unwrap();
    let response = put(
        workspace(dir.path()),
        "a.md",
        Some(&etag(b"old\n")),
        "new\n",
    )
    .await;

    assert_eq!(etag_of(&response), etag(b"new\n"));
    let (status, saved) = status_and_json(response).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(read(dir.path(), "a.md"), "new\n");
    assert!(saved["modified"].as_u64().unwrap() > 0);
}

#[tokio::test]
async fn save_snapshots_the_old_content_first() {
    let dir = tempfile::tempdir().unwrap();
    put(
        workspace(dir.path()),
        "a.md",
        Some(&etag(b"old\n")),
        "new\n",
    )
    .await;

    assert_eq!(snapshots(dir.path(), "a.md"), ["old\n"]);
}

#[tokio::test]
async fn save_of_an_empty_file_makes_no_snapshot() {
    let dir = tempfile::tempdir().unwrap();
    let state = common::workspace(dir.path(), &[("a.md", b"")]);
    let response = put(state, "a.md", Some(&etag(b"")), "new\n").await;

    assert_eq!(response.status(), StatusCode::OK);
    assert!(snapshots(dir.path(), "a.md").is_empty());
}

#[tokio::test]
async fn save_with_a_stale_version_is_refused_and_writes_nothing() {
    let dir = tempfile::tempdir().unwrap();
    let response = put(
        workspace(dir.path()),
        "a.md",
        Some(&etag(b"older\n")),
        "new\n",
    )
    .await;

    let (status, error) = status_and_json(response).await;
    assert_eq!(status, StatusCode::PRECONDITION_FAILED);
    assert_eq!(error["error"]["message"], "a.md: the file changed on disk");
    assert_eq!(read(dir.path(), "a.md"), "old\n");
    assert!(snapshots(dir.path(), "a.md").is_empty());
}

#[tokio::test]
async fn save_without_if_match_is_refused() {
    let dir = tempfile::tempdir().unwrap();
    let response = put(workspace(dir.path()), "a.md", None, "new\n").await;

    assert_eq!(response.status(), StatusCode::PRECONDITION_REQUIRED);
    assert_eq!(read(dir.path(), "a.md"), "old\n");
}

#[tokio::test]
async fn if_match_must_be_one_strong_etag() {
    let dir = tempfile::tempdir().unwrap();
    let hash = version(b"old\n");
    let forms = [
        "*".to_owned(),
        hash.clone(),
        format!("W/\"{hash}\""),
        format!("\"other\", \"{hash}\""),
    ];
    for form in forms {
        let response = put(workspace(dir.path()), "a.md", Some(&form), "new\n").await;

        assert_eq!(response.status(), StatusCode::PRECONDITION_FAILED, "{form}");
        assert_eq!(read(dir.path(), "a.md"), "old\n", "{form}");
    }
}

#[tokio::test]
async fn save_of_a_deleted_file_is_refused() {
    let dir = tempfile::tempdir().unwrap();
    let state = workspace(dir.path());
    fs::remove_file(dir.path().join("ws/a.md")).unwrap();
    let response = put(state, "a.md", Some(&etag(b"old\n")), "new\n").await;

    assert_eq!(response.status(), StatusCode::PRECONDITION_FAILED);
    assert!(!dir.path().join("ws/a.md").exists());
}

#[tokio::test]
async fn save_takes_content_up_to_the_edit_limit() {
    let dir = tempfile::tempdir().unwrap();
    let limit = EDIT_LIMIT as usize;
    let content = "a".repeat(limit);
    let response = put(
        workspace(dir.path()),
        "a.md",
        Some(&etag(b"old\n")),
        &content,
    )
    .await;
    assert_eq!(response.status(), StatusCode::OK);

    let if_match = etag(content.as_bytes());
    // No files given: `a.md` keeps the content of the first save.
    let state = common::workspace(dir.path(), &[]);
    let response = put(state, "a.md", Some(&if_match), &"a".repeat(limit + 1)).await;
    assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(read(dir.path(), "a.md").len(), limit);
}
