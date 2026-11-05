mod common;

use axum::http::StatusCode;
use common::get_json;
use serde_json::json;

#[tokio::test]
async fn search_gives_the_matching_lines_with_their_context() {
    let dir = tempfile::tempdir().unwrap();
    let state = common::workspace(dir.path(), &[("a.md", b"# A\n\nThe needle.\n")]);
    let (status, body) = get_json(state, "/api/search?q=needle").await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["more"], false);
    assert_eq!(body["files"][0]["path"], "a.md");
    assert_eq!(
        body["files"][0]["lines"],
        json!([
            { "number": 1, "text": "# A", "matched": false },
            { "number": 2, "text": "", "matched": false },
            { "number": 3, "text": "The needle.", "matched": true },
        ])
    );
}

#[tokio::test]
async fn an_empty_query_is_400() {
    let dir = tempfile::tempdir().unwrap();
    for uri in ["/api/search?q=", "/api/search"] {
        let state = common::workspace(dir.path(), &[("a.md", b"# A\n")]);
        let (status, body) = get_json(state, uri).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{uri}");
        assert_eq!(body["error"]["code"], "bad_request", "{uri}");
    }
}
