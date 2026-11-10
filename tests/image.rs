mod common;

use std::fs;
use std::os::unix::fs::symlink;
use std::path::Path;
use std::sync::Arc;

use axum::Router;
use axum::http::StatusCode;
use common::{HOST, post_bytes, status_and_json};
use mdame::document::IMAGE_LIMIT;
use mdame::server::router;
use serde_json::Value;

const PNG: &[u8] = b"\x89PNG\r\n\x1a\n pasted";

async fn save(app: &Router, path: &str, bytes: Vec<u8>) -> (StatusCode, Value) {
    let uri = format!("/api/image?path={path}");
    let headers = [HOST, ("content-type", "image/png")];
    status_and_json(post_bytes(app, &uri, &headers, bytes).await).await
}

fn workspace(dir: &Path) -> Router {
    let files: &[(&str, &[u8])] = &[("docs/plan.md", b"# Plan\n"), ("docs/shot.png", b"old")];
    router(Arc::new(common::workspace(dir, files)))
}

#[tokio::test]
async fn an_image_is_saved_where_it_is_asked() {
    let dir = common::tempdir();
    let (status, saved) = save(&workspace(dir.path()), "docs/pasted.png", PNG.to_vec()).await;

    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(saved["path"], "docs/pasted.png");
    assert_eq!(
        fs::read(dir.path().join("ws/docs/pasted.png")).unwrap(),
        PNG
    );
}

#[tokio::test]
async fn a_taken_name_gets_the_next_number() {
    let dir = common::tempdir();
    let app = workspace(dir.path());
    let (_, first) = save(&app, "docs/shot.png", PNG.to_vec()).await;
    let (_, second) = save(&app, "docs/shot.png", PNG.to_vec()).await;

    assert_eq!(first["path"], "docs/shot-2.png");
    assert_eq!(second["path"], "docs/shot-3.png");
    assert_eq!(
        fs::read(dir.path().join("ws/docs/shot.png")).unwrap(),
        b"old"
    );
}

#[tokio::test]
async fn only_an_image_type_is_saved() {
    let dir = common::tempdir();
    let app = workspace(dir.path());
    for path in ["docs/note.md", "docs/page.html", "docs/shot", "docs/run.sh"] {
        let (status, _) = save(&app, path, PNG.to_vec()).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{path}");
        assert!(!dir.path().join("ws").join(path).exists(), "{path}");
    }
    // `Path` reads `pics.png/.` as the folder `pics.png`.
    fs::create_dir_all(dir.path().join("ws/docs/pics.png")).unwrap();
    for path in ["docs/pics.png/.", "docs/pics.png/"] {
        let (status, _) = save(&app, path, PNG.to_vec()).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{path}");
    }
    assert_eq!(
        fs::read_dir(dir.path().join("ws/docs/pics.png"))
            .unwrap()
            .count(),
        0
    );
}

#[tokio::test]
async fn an_image_never_goes_in_a_hidden_folder() {
    let dir = common::tempdir();
    let app = workspace(dir.path());
    fs::create_dir_all(dir.path().join("ws/.claude/plans")).unwrap();
    fs::create_dir_all(dir.path().join("ws/.git")).unwrap();
    // A link with a plain name, into a hidden folder.
    symlink(".claude", dir.path().join("ws/claude-link")).unwrap();
    for path in [
        ".claude/plans/shot.png",
        ".git/shot.png",
        ".shot.png",
        "claude-link/shot.png",
    ] {
        let (status, error) = save(&app, path, PNG.to_vec()).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{path}");
        assert!(
            error["error"]["message"]
                .as_str()
                .unwrap()
                .ends_with("mdame saves no hidden image, and no image in a hidden folder"),
            "{path}: {error}"
        );
    }
    assert!(!dir.path().join("ws/.claude/shot.png").exists());
}

#[tokio::test]
async fn an_image_outside_the_workspace_is_refused() {
    let dir = common::tempdir();
    let app = workspace(dir.path());
    for path in ["../shot.png", "/tmp/shot.png"] {
        let (status, _) = save(&app, path, PNG.to_vec()).await;
        assert_eq!(status, StatusCode::FORBIDDEN, "{path}");
    }
    assert!(!dir.path().join("shot.png").exists());
}

#[tokio::test]
async fn an_image_in_a_missing_folder_is_not_found() {
    let dir = common::tempdir();
    let (status, error) = save(&workspace(dir.path()), "nowhere/shot.png", PNG.to_vec()).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(error["error"]["message"], "nowhere: no such folder");
}

#[tokio::test]
async fn an_image_over_the_limit_is_refused() {
    let dir = common::tempdir();
    let bytes = vec![0; IMAGE_LIMIT as usize + 1];
    let (status, error) = save(&workspace(dir.path()), "docs/big.png", bytes).await;

    assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(
        error["error"]["message"],
        "docs/big.png: an image may hold 16 MB at most"
    );
    assert!(!dir.path().join("ws/docs/big.png").exists());
}

#[tokio::test]
async fn an_image_needs_an_image_type() {
    let dir = common::tempdir();
    let app = workspace(dir.path());
    // The types of a form, which another site could send.
    for kind in [
        "text/plain",
        "application/x-www-form-urlencoded",
        "multipart/form-data",
    ] {
        let uri = "/api/image?path=docs/form.png";
        let headers = [HOST, ("content-type", kind)];
        let response = post_bytes(&app, uri, &headers, PNG.to_vec()).await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST, "{kind}");
    }
    assert!(!dir.path().join("ws/docs/form.png").exists());
}
