mod common;

use std::fs;
use std::path::Path;

use axum::http::StatusCode;
use common::{local, send};
use mdame::app::AppState;
use serde_json::Value;

async fn get_file(state: AppState, path: &str) -> (StatusCode, Value) {
    let uri = format!("/api/file?path={path}");
    let response = send(state, &uri, &[("host", "127.0.0.1:4891")]).await;
    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    (status, serde_json::from_slice(&bytes).unwrap())
}

/// A workspace in `dir/ws`, so that `dir` can hold a file outside it.
fn workspace(dir: &Path) -> AppState {
    let root = dir.join("ws");
    fs::create_dir_all(root.join("docs")).unwrap();
    fs::write(root.join("docs/a.md"), "# Title\n").unwrap();
    fs::write(dir.join("secret.md"), "secret\n").unwrap();
    let state = AppState {
        recents_path: dir.join("recents.toml"),
        ..local()
    };
    state.open_workspace(&root).unwrap();
    state
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
async fn missing_folder_and_unknown_files_are_not_found() {
    let dir = tempfile::tempdir().unwrap();
    fs::write(dir.path().join("Makefile"), "").unwrap();
    for path in ["nothing.md", "docs", "Makefile", "docs.md"] {
        let (status, body) = get_file(workspace(dir.path()), path).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{path}");
        assert_eq!(body["error"]["code"], "not_found", "{path}");
    }
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
async fn link_inside_the_workspace_opens() {
    let dir = tempfile::tempdir().unwrap();
    let state = workspace(dir.path());
    std::os::unix::fs::symlink("docs/a.md", dir.path().join("ws/link.md")).unwrap();
    let (status, body) = get_file(state, "link.md").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["family"], "markdown");
}

#[tokio::test]
async fn no_file_without_a_workspace() {
    let (status, _) = get_file(local(), "a.md").await;
    assert_eq!(status, StatusCode::CONFLICT);
}
