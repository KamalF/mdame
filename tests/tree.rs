mod common;

use std::fs;

use axum::http::StatusCode;
use common::{get_json, local};
use mdame::app::AppState;
use serde_json::json;

#[tokio::test]
async fn tree_of_the_open_workspace() {
    let dir = tempfile::tempdir().unwrap();
    fs::create_dir(dir.path().join("docs")).unwrap();
    fs::write(dir.path().join("docs/a.md"), "").unwrap();
    let state = AppState {
        state_dir: dir.path().to_path_buf(),
        ..local()
    };
    state.open_workspace(dir.path()).unwrap();

    let (status, body) = get_json(state, "/api/tree").await;
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
    let (status, body) = get_json(local(), "/api/tree").await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(
        body,
        json!({ "error": { "code": "conflict", "message": "no workspace is open" } })
    );
}
