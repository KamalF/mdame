mod common;

use axum::http::StatusCode;
use common::get_json;

#[tokio::test]
async fn tree_of_the_open_workspace() {
    let dir = tempfile::tempdir().unwrap();
    let state = common::workspace(dir.path(), &[("docs/a.md", b"")]);

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
