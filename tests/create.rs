mod common;

use std::fs;
use std::path::Path;

use axum::http::{Method, StatusCode};
use common::{HOST, send_body, status_and_json};
use mdame::app::AppState;
use mdame::document::version;
use serde_json::{Value, json};

const JSON: (&str, &str) = ("content-type", "application/json");

async fn create(state: AppState, path: &str) -> (StatusCode, Value) {
    let body = json!({ "path": path }).to_string();
    let response = send_body(state, Method::POST, "/api/file", &[HOST, JSON], &body).await;
    status_and_json(response).await
}

fn workspace(dir: &Path) -> AppState {
    common::workspace(dir, &[("a.md", b"old\n")])
}

#[tokio::test]
async fn create_makes_an_empty_file() {
    let dir = tempfile::tempdir().unwrap();
    let (status, created) = create(workspace(dir.path()), "b.md").await;

    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(fs::read(dir.path().join("ws/b.md")).unwrap(), b"");
    assert_eq!(created["version"], version(b""));
    assert!(created["modified"].as_u64().unwrap() > 0);
}

#[tokio::test]
async fn create_of_an_existing_file_is_refused() {
    let dir = tempfile::tempdir().unwrap();
    let (status, error) = create(workspace(dir.path()), "a.md").await;

    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(error["error"]["message"], "a.md: the file exists");
    assert_eq!(fs::read(dir.path().join("ws/a.md")).unwrap(), b"old\n");
}

#[tokio::test]
async fn create_refuses_a_type_that_the_editor_cannot_open() {
    let dir = tempfile::tempdir().unwrap();
    for path in ["b.png", "notes"] {
        let (status, _) = create(workspace(dir.path()), path).await;

        assert_eq!(status, StatusCode::BAD_REQUEST, "{path}");
        assert!(!dir.path().join("ws").join(path).exists(), "{path}");
    }
}

#[tokio::test]
async fn create_in_a_missing_folder_names_the_folder() {
    let dir = tempfile::tempdir().unwrap();
    let cases = [
        ("new/deeper/b.md", "new/deeper: no such folder"),
        ("a.md/b.md", "a.md: no such folder"),
    ];
    for (path, message) in cases {
        let (status, error) = create(workspace(dir.path()), path).await;

        assert_eq!(status, StatusCode::NOT_FOUND, "{path}");
        assert_eq!(error["error"]["message"], message, "{path}");
    }
    assert!(!dir.path().join("ws/new").exists());
}

#[tokio::test]
async fn create_stays_in_the_workspace() {
    let dir = tempfile::tempdir().unwrap();
    let (status, _) = create(workspace(dir.path()), "../out.md").await;

    assert_eq!(status, StatusCode::FORBIDDEN);
    assert!(!dir.path().join("out.md").exists());
}
