mod common;

use std::path::Path;

use axum::http::{Method, StatusCode};
use common::{HOST, get_json, send_body, status_and_json};
use mdame::app::AppState;
use serde_json::{Value, json};

const MARKDOWN: &str = "# Title\n\n![logo](img/logo.png)\n\n<script>x</script>\n";

async fn preview(state: AppState, path: &str, content: &str) -> (StatusCode, Value) {
    let body = json!({ "path": path, "content": content }).to_string();
    let json = ("content-type", "application/json");
    let response = send_body(state, Method::POST, "/api/render", &[HOST, json], &body).await;
    status_and_json(response).await
}

fn workspace(dir: &Path) -> AppState {
    common::workspace(dir, &[("docs/a.md", MARKDOWN.as_bytes())])
}

#[tokio::test]
async fn preview_gives_the_same_html_as_the_view() {
    let dir = tempfile::tempdir().unwrap();
    let (_, view) = get_json(workspace(dir.path()), "/api/file?path=docs/a.md").await;
    let (status, preview) = preview(workspace(dir.path()), "docs/a.md", MARKDOWN).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(preview["html"], view["html"]);
}

#[tokio::test]
async fn preview_over_1_mb_shows_a_notice() {
    let dir = tempfile::tempdir().unwrap();
    let limit = 1024 * 1024;
    for (length, notice) in [(limit, false), (limit + 1, true)] {
        let content = "a".repeat(length);
        let (status, preview) = preview(workspace(dir.path()), "a.md", &content).await;

        assert_eq!(status, StatusCode::OK, "{length}");
        let html = preview["html"].as_str().unwrap();
        assert_eq!(html.contains("over 1 MB"), notice, "{length}");
    }
}

#[tokio::test]
async fn preview_takes_escaped_text_up_to_the_edit_limit() {
    let dir = tempfile::tempdir().unwrap();
    // Each newline takes two bytes in JSON: the body is twice the text.
    let content = "\n".repeat(8 * 1024 * 1024);
    let (status, _) = preview(workspace(dir.path()), "a.md", &content).await;

    assert_eq!(status, StatusCode::OK);
}
