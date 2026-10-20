mod common;

use std::fs;

use axum::http::StatusCode;
use common::get_json;
use mdame::document::{EDIT_LIMIT, version};

#[tokio::test]
async fn source_returns_the_text_and_its_version() {
    let dir = tempfile::tempdir().unwrap();
    let state = common::workspace(dir.path(), &[("docs/a.md", b"# A\n")]);

    let (status, body) = get_json(state, "/api/source?path=docs/a.md").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["content"], "# A\n");
    assert_eq!(body["version"], version(b"# A\n"));
    assert!(body["modified"].as_u64().unwrap() > 0);
}

#[tokio::test]
async fn source_refuses_what_is_not_utf8_text() {
    let dir = tempfile::tempdir().unwrap();
    let files: [(&str, &[u8]); 2] = [("latin1.md", b"caf\xe9\n"), ("a.png", b"# A\n")];
    for (path, _) in files {
        let state = common::workspace(dir.path(), &files);
        let (status, body) = get_json(state, &format!("/api/source?path={path}")).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{path}");
        assert_eq!(body["error"]["code"], "not_viewable", "{path}");
    }
}

#[tokio::test]
async fn source_refuses_a_file_over_the_edit_limit() {
    let dir = tempfile::tempdir().unwrap();
    let state = common::workspace(dir.path(), &[]);
    let limit = EDIT_LIMIT as usize;
    fs::write(dir.path().join("ws/limit.md"), "a".repeat(limit)).unwrap();
    fs::write(dir.path().join("ws/big.md"), "a".repeat(limit + 1)).unwrap();

    let (status, _) = get_json(state, "/api/source?path=limit.md").await;
    assert_eq!(status, StatusCode::OK);
    let state = common::workspace(dir.path(), &[]);
    let (status, _) = get_json(state, "/api/source?path=big.md").await;
    assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);
}
