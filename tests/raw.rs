mod common;

use std::fs;
use std::path::Path;

use axum::http::{StatusCode, header};
use axum::response::Response;
use common::{HOST, send};
use mdame::app::AppState;

const SANDBOX: &str =
    "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'";

fn workspace(dir: &Path) -> AppState {
    common::workspace(
        dir,
        &[
            ("img/a b.png", &[0x89, b'P', b'N', b'G']),
            ("logo.SVG", b"<svg onload=\"alert(1)\"/>"),
            ("page.html", b"<script>alert(1)</script>"),
        ],
    )
}

async fn get_raw(state: AppState, path: &str) -> Response {
    send(state, &format!("/raw/{path}"), &[HOST]).await
}

async fn body(response: Response) -> Vec<u8> {
    axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap()
        .to_vec()
}

#[tokio::test]
async fn image_keeps_its_type_and_is_sandboxed() {
    let dir = tempfile::tempdir().unwrap();
    let response = get_raw(workspace(dir.path()), "img/a%20b.png").await;
    assert_eq!(response.status(), StatusCode::OK);
    let headers = response.headers();
    assert_eq!(headers[header::CONTENT_TYPE], "image/png");
    assert_eq!(headers[header::CONTENT_SECURITY_POLICY], SANDBOX);
    assert_eq!(headers[header::X_CONTENT_TYPE_OPTIONS], "nosniff");
    assert_eq!(body(response).await, [0x89, b'P', b'N', b'G']);
}

#[tokio::test]
async fn svg_is_sandboxed() {
    let dir = tempfile::tempdir().unwrap();
    let response = get_raw(workspace(dir.path()), "logo.SVG").await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()[header::CONTENT_TYPE], "image/svg+xml");
    assert_eq!(response.headers()[header::CONTENT_SECURITY_POLICY], SANDBOX);
}

#[tokio::test]
async fn html_is_plain_text_and_sandboxed() {
    let dir = tempfile::tempdir().unwrap();
    let response = get_raw(workspace(dir.path()), "page.html").await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response.headers()[header::CONTENT_TYPE],
        "text/plain; charset=utf-8"
    );
    assert_eq!(response.headers()[header::CONTENT_SECURITY_POLICY], SANDBOX);
}

#[tokio::test]
async fn missing_files_and_folders_are_not_found() {
    let dir = tempfile::tempdir().unwrap();
    for path in ["nothing.png", "img"] {
        let response = get_raw(workspace(dir.path()), path).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND, "{path}");
    }
}

#[tokio::test]
async fn file_over_64_mb_is_refused() {
    let dir = tempfile::tempdir().unwrap();
    let state = workspace(dir.path());
    // Sparse: it takes no disk space.
    let file = fs::File::create(dir.path().join("ws/huge.bin")).unwrap();
    file.set_len(1 << 40).unwrap();
    let response = get_raw(state, "huge.bin").await;
    assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
}

#[tokio::test]
async fn fifo_is_not_opened() {
    let dir = tempfile::tempdir().unwrap();
    let state = workspace(dir.path());
    let fifo = dir.path().join("ws/pipe.png");
    assert!(
        std::process::Command::new("mkfifo")
            .arg(&fifo)
            .status()
            .unwrap()
            .success()
    );
    let response = get_raw(state, "pipe.png").await;
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn paths_out_of_the_workspace_are_forbidden() {
    let dir = tempfile::tempdir().unwrap();
    let response = get_raw(workspace(dir.path()), "..%2Fsecret.md").await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}
