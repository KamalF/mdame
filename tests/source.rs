mod common;

use std::fs;

use axum::http::StatusCode;
use common::{HOST, etag, etag_of, get_json, send, status_and_json};

#[tokio::test]
async fn source_returns_the_text_and_its_version() {
    let dir = tempfile::tempdir().unwrap();
    let state = common::workspace(dir.path(), &[("docs/a.md", b"# A\n")]);

    let response = send(state, "/api/source?path=docs/a.md", &[HOST]).await;
    assert_eq!(etag_of(&response), etag(b"# A\n"));
    let (status, body) = status_and_json(response).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["content"], "# A\n");
    assert!(body["modified"].as_u64().unwrap() > 0);
}

/// The editor shows the deleted-file notice on this code.
#[tokio::test]
async fn source_of_a_missing_file_is_not_found() {
    let dir = tempfile::tempdir().unwrap();
    // The second one has a file where its folder would be.
    for path in ["missing.md", "a.md/b.md"] {
        let state = common::workspace(dir.path(), &[("a.md", b"# A\n")]);
        let (status, body) = get_json(state, &format!("/api/source?path={path}")).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{path}");
        assert_eq!(body["error"]["code"], "not_found", "{path}");
    }
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
    // The spec's limit, not the constant: a test must fail if the constant moves.
    let limit = 8 * 1024 * 1024;
    fs::write(dir.path().join("ws/limit.md"), "a".repeat(limit)).unwrap();
    fs::write(dir.path().join("ws/big.md"), "a".repeat(limit + 1)).unwrap();

    let (status, _) = get_json(state, "/api/source?path=limit.md").await;
    assert_eq!(status, StatusCode::OK);
    let state = common::workspace(dir.path(), &[]);
    let (status, _) = get_json(state, "/api/source?path=big.md").await;
    assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);
}
