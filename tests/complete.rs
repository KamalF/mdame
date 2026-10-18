mod common;

use std::fs;

use axum::http::StatusCode;
use common::{local, send};
use serde_json::{Value, json};

const HOST: (&str, &str) = ("host", "127.0.0.1:4891");

async fn get(uri: &str) -> (StatusCode, Value) {
    let response = send(local(), uri, &[HOST]).await;
    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    (status, serde_json::from_slice(&bytes).unwrap())
}

#[tokio::test]
async fn suggests_entries_of_the_typed_folder() {
    let dir = tempfile::tempdir().unwrap();
    fs::create_dir(dir.path().join("notes")).unwrap();
    let root = dir.path().display();

    let (status, body) = get(&format!("/api/complete?prefix={root}/n")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        body,
        json!([{ "path": format!("{root}/notes/"), "dir": true }])
    );
}

#[tokio::test]
async fn missing_prefix_is_a_bad_request() {
    let (status, body) = get("/api/complete").await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"]["code"], "bad_request");
}
