mod common;

use std::fs;
use std::path::Path;
use std::sync::Arc;

use axum::http::StatusCode;
use common::{HOST, local, send};
use mdame::app::AppState;
use serde_json::Value;
use tokio::sync::Semaphore;

async fn get_file(state: AppState, path: &str) -> (StatusCode, Value) {
    let uri = format!("/api/file?path={path}");
    let response = send(state, &uri, &[HOST]).await;
    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    (status, serde_json::from_slice(&bytes).unwrap())
}

fn workspace(dir: &Path) -> AppState {
    common::workspace(dir, &[("docs/a.md", b"# Title\n")])
}

#[tokio::test]
async fn markdown_file_is_rendered() {
    let dir = tempfile::tempdir().unwrap();
    let (status, body) = get_file(workspace(dir.path()), "docs/a.md").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["family"], "markdown");
    assert_eq!(body["size"], 8);
    assert_eq!(body["too_large"], false);
    assert!(body["modified"].as_u64().unwrap() > 0);
    assert!(
        body["html"]
            .as_str()
            .unwrap()
            .starts_with("<h1 id=\"title\"")
    );
}

#[tokio::test]
async fn file_over_1_mb_is_not_rendered() {
    let dir = tempfile::tempdir().unwrap();
    let state = workspace(dir.path());
    fs::write(dir.path().join("ws/big.txt"), "a".repeat(1024 * 1024 + 1)).unwrap();
    let (status, body) = get_file(state, "big.txt").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["too_large"], true);
    assert!(body["html"].as_str().unwrap().contains("over 1 MB"));
}

#[tokio::test]
async fn image_is_not_read() {
    let dir = tempfile::tempdir().unwrap();
    let state = workspace(dir.path());
    fs::write(dir.path().join("ws/big.png"), vec![0; 1024 * 1024 + 1]).unwrap();
    let (status, body) = get_file(state, "big.png").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["too_large"], false);
    assert_eq!(body["html"], r#"<img src="/raw/big.png" alt="big.png">"#);
}

#[tokio::test]
async fn missing_files_and_folders_are_not_found() {
    let dir = tempfile::tempdir().unwrap();
    for path in ["nothing.md", "nothing.pdf", "docs"] {
        let (status, body) = get_file(workspace(dir.path()), path).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{path}");
        assert_eq!(body["error"]["code"], "not_found", "{path}");
    }
}

#[tokio::test]
async fn file_of_unknown_type_is_not_viewable() {
    let dir = tempfile::tempdir().unwrap();
    let state = workspace(dir.path());
    fs::write(dir.path().join("ws/Makefile"), "").unwrap();
    let (status, body) = get_file(state, "Makefile").await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"]["code"], "not_viewable");
}

#[tokio::test]
async fn paths_out_of_the_workspace_are_forbidden() {
    let dir = tempfile::tempdir().unwrap();
    workspace(dir.path());
    let secret = dir.path().join("secret.md");
    std::os::unix::fs::symlink(&secret, dir.path().join("ws/out.md")).unwrap();
    std::os::unix::fs::symlink("../secret.md", dir.path().join("ws/relative-out.md")).unwrap();
    let absolute = secret.to_str().unwrap().to_owned();
    for path in ["../secret.md", &absolute, "out.md", "relative-out.md"] {
        let (status, _) = get_file(workspace(dir.path()), path).await;
        assert_eq!(status, StatusCode::FORBIDDEN, "{path}");
    }
}

#[tokio::test]
async fn unreadable_file_is_not_called_outside() {
    use std::os::unix::fs::PermissionsExt;
    let dir = tempfile::tempdir().unwrap();
    let state = workspace(dir.path());
    let locked = dir.path().join("ws/docs/a.md");
    fs::set_permissions(&locked, fs::Permissions::from_mode(0o000)).unwrap();
    if fs::read(&locked).is_ok() {
        // Root reads it anyway: nothing to test.
        return;
    }
    let (status, body) = get_file(state, "docs/a.md").await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["error"]["message"], "no permission to read this file");
}

#[tokio::test]
async fn link_inside_the_workspace_opens() {
    let dir = tempfile::tempdir().unwrap();
    let state = workspace(dir.path());
    std::os::unix::fs::symlink("docs/a.md", dir.path().join("ws/link.md")).unwrap();
    let (status, body) = get_file(state, "link.md").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["family"], "markdown");
}

#[tokio::test]
async fn no_render_without_a_free_slot() {
    let dir = tempfile::tempdir().unwrap();
    let state = AppState {
        renders: Arc::new(Semaphore::new(0)),
        ..workspace(dir.path())
    };
    let (status, body) = get_file(state, "docs/a.md").await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["error"]["code"], "conflict");
}

#[tokio::test]
async fn a_render_frees_its_slot() {
    let dir = tempfile::tempdir().unwrap();
    let renders = Arc::new(Semaphore::new(1));
    for _ in 0..2 {
        let state = AppState {
            renders: renders.clone(),
            ..workspace(dir.path())
        };
        let (status, _) = get_file(state, "docs/a.md").await;
        assert_eq!(status, StatusCode::OK);
    }
}

#[tokio::test]
async fn no_file_without_a_workspace() {
    let (status, _) = get_file(local(), "a.md").await;
    assert_eq!(status, StatusCode::CONFLICT);
}
