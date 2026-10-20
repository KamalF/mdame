mod common;

use std::fs;

use axum::http::StatusCode;
use common::{get_json, local};
use serde_json::json;

#[tokio::test]
async fn suggests_entries_of_the_typed_folder() {
    let dir = tempfile::tempdir().unwrap();
    fs::create_dir(dir.path().join("notes")).unwrap();
    let root = dir.path().display();

    let (status, body) = get_json(local(), &format!("/api/complete?prefix={root}/n")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        body,
        json!([{ "path": format!("{root}/notes/"), "dir": true }])
    );
}

#[tokio::test]
async fn missing_prefix_is_a_bad_request() {
    let (status, body) = get_json(local(), "/api/complete").await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"]["code"], "bad_request");
}
