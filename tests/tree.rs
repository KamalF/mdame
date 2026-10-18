mod common;

use std::fs;

use axum::http::StatusCode;
use common::{local, send};
use mdame::app::AppState;
use serde_json::{Value, json};

async fn get_tree(state: AppState) -> (StatusCode, Value) {
    let response = send(state, "/api/tree", &[("host", "127.0.0.1:4891")]).await;
    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    (status, serde_json::from_slice(&bytes).unwrap())
}

#[tokio::test]
async fn tree_of_the_open_workspace() {
    let dir = tempfile::tempdir().unwrap();
    fs::create_dir(dir.path().join("docs")).unwrap();
    fs::write(dir.path().join("docs/a.md"), "").unwrap();
    let state = AppState {
        recents_path: dir.path().join("recents.toml"),
        ..local()
    };
    state.open_workspace(dir.path()).unwrap();

    let (status, body) = get_tree(state).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["kind"], "dir");
    let docs = &body["children"][0];
    assert_eq!(docs["path"], "docs");
    assert_eq!(docs["children"][0]["path"], "docs/a.md");
    assert_eq!(docs["children"][0]["kind"], "file");
    assert_eq!(docs["children"][0]["family"], "markdown");
    assert_eq!(docs.get("family"), None);
    assert_eq!(docs["children"][0].get("children"), None);
}

#[tokio::test]
async fn no_tree_without_a_workspace() {
    let (status, body) = get_tree(local()).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(
        body,
        json!({ "error": { "code": "conflict", "message": "no workspace is open" } })
    );
}
