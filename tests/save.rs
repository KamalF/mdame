mod common;

use std::fs;
use std::path::Path;

use axum::http::{Method, StatusCode};
use common::{HOST, send_body, status_and_json};
use mdame::app::AppState;
use mdame::document::{EDIT_LIMIT, version};
use serde_json::{Value, json};

const JSON: (&str, &str) = ("content-type", "application/json");

async fn put(state: AppState, path: &str, body: Value) -> (StatusCode, Value) {
    let uri = format!("/api/file?path={path}");
    let body = body.to_string();
    status_and_json(send_body(state, Method::PUT, &uri, &[HOST, JSON], &body).await).await
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
    let body = json!({ "content": "new\n", "base_version": version(b"old\n") });
    let (status, saved) = put(workspace(dir.path()), "a.md", body).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(read(dir.path(), "a.md"), "new\n");
    assert_eq!(saved["version"], version(b"new\n"));
    assert!(saved["modified"].as_u64().unwrap() > 0);
}

#[tokio::test]
async fn save_snapshots_the_old_content_first() {
    let dir = tempfile::tempdir().unwrap();
    let body = json!({ "content": "new\n", "base_version": version(b"old\n") });
    put(workspace(dir.path()), "a.md", body).await;

    assert_eq!(snapshots(dir.path(), "a.md"), ["old\n"]);
}

#[tokio::test]
async fn save_of_an_empty_file_makes_no_snapshot() {
    let dir = tempfile::tempdir().unwrap();
    let state = common::workspace(dir.path(), &[("a.md", b"")]);
    let body = json!({ "content": "new\n", "base_version": version(b"") });
    let (status, _) = put(state, "a.md", body).await;

    assert_eq!(status, StatusCode::OK);
    assert!(snapshots(dir.path(), "a.md").is_empty());
}

#[tokio::test]
async fn save_with_a_stale_version_is_refused_and_writes_nothing() {
    let dir = tempfile::tempdir().unwrap();
    let body = json!({ "content": "new\n", "base_version": version(b"older\n") });
    let (status, error) = put(workspace(dir.path()), "a.md", body).await;

    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(error["error"]["message"], "a.md: the file changed on disk");
    assert_eq!(read(dir.path(), "a.md"), "old\n");
    assert!(snapshots(dir.path(), "a.md").is_empty());
}

#[tokio::test]
async fn save_of_a_deleted_file_is_refused() {
    let dir = tempfile::tempdir().unwrap();
    let state = workspace(dir.path());
    fs::remove_file(dir.path().join("ws/a.md")).unwrap();
    let body = json!({ "content": "new\n", "base_version": version(b"old\n") });
    let (status, _) = put(state, "a.md", body).await;

    assert_eq!(status, StatusCode::CONFLICT);
    assert!(!dir.path().join("ws/a.md").exists());
}

#[tokio::test]
async fn save_takes_content_up_to_the_edit_limit() {
    let dir = tempfile::tempdir().unwrap();
    let limit = EDIT_LIMIT as usize;
    let base_version = version(b"old\n");
    let body = json!({ "content": "a".repeat(limit), "base_version": base_version });
    let (status, _) = put(workspace(dir.path()), "a.md", body).await;
    assert_eq!(status, StatusCode::OK);

    let base_version = version("a".repeat(limit).as_bytes());
    let body = json!({ "content": "a".repeat(limit + 1), "base_version": base_version });
    // No files given: `a.md` keeps the content of the first save.
    let state = common::workspace(dir.path(), &[]);
    let (status, _) = put(state, "a.md", body).await;
    assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(read(dir.path(), "a.md").len(), limit);
}
