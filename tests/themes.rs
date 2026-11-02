mod common;

use std::fs;
use std::os::unix::fs::{PermissionsExt, symlink};
use std::path::Path;
use std::sync::Arc;

use axum::http::StatusCode;
use common::{HOST, get_json, local, send, send_to, status_and_json};
use mdame::app::AppState;
use mdame::server::router;
use serde_json::json;

/// A state whose themes folder is `dir/themes`, holding `files`.
fn with_themes(dir: &Path, files: &[(&str, &str)]) -> AppState {
    let themes = dir.join("themes");
    fs::create_dir_all(&themes).unwrap();
    for (name, css) in files {
        fs::write(themes.join(name), css).unwrap();
    }
    AppState {
        themes_dir: themes,
        ..local()
    }
}

async fn body(response: axum::response::Response) -> String {
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    String::from_utf8(bytes.to_vec()).unwrap()
}

#[tokio::test]
async fn a_builtin_theme_is_css() {
    for (name, scheme) in [
        ("light", "color-scheme: light"),
        ("dark", "color-scheme: dark"),
    ] {
        let response = send(local(), &format!("/themes/{name}.css"), &[HOST]).await;
        assert_eq!(response.status(), StatusCode::OK, "{name}");
        let content_type = &response.headers()["content-type"];
        assert_eq!(content_type, "text/css; charset=utf-8", "{name}");
        assert!(body(response).await.contains(scheme), "{name}");
    }
}

#[tokio::test]
async fn an_unknown_theme_is_404() {
    for uri in ["/themes/nothing.css", "/themes/light", "/themes/.css"] {
        let status = send(local(), uri, &[HOST]).await.status();
        assert_eq!(status, StatusCode::NOT_FOUND, "{uri}");
    }
}

#[tokio::test]
async fn a_theme_name_is_one_segment() {
    // Each would name main.css, which exists.
    for uri in [
        "/themes/..%2Fassets%2Fmain.css",
        "/themes/x%2F..%2F..%2Fassets%2Fmain.css",
        "/themes/..%2F..%2Fdist%2Fassets%2Fmain.css",
    ] {
        let status = send(local(), uri, &[HOST]).await.status();
        assert_eq!(status, StatusCode::NOT_FOUND, "{uri}");
    }
}

#[tokio::test]
async fn state_lists_user_themes_after_the_builtins() {
    let dir = tempfile::tempdir().unwrap();
    let files = [
        ("nord.css", ""),
        ("arc.css", ""),
        ("light.css", ""),
        (".hidden.css", ""),
        ("notes.txt", ""),
    ];
    let state = with_themes(dir.path(), &files);
    fs::create_dir(dir.path().join("themes/folder.css")).unwrap();

    let (_, body) = get_json(state, "/api/state").await;
    assert_eq!(body["themes"], json!(["light", "dark", "arc", "nord"]));
}

#[tokio::test]
async fn a_user_theme_overrides_a_builtin() {
    let dir = tempfile::tempdir().unwrap();
    let state = with_themes(dir.path(), &[("light.css", "/* mine */")]);
    let response = send(state, "/themes/light.css", &[HOST]).await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response.headers()["content-type"],
        "text/css; charset=utf-8"
    );
    assert_eq!(body(response).await, "/* mine */");
}

#[tokio::test]
async fn a_new_user_theme_shows_without_a_restart() {
    let dir = tempfile::tempdir().unwrap();
    let app = router(Arc::new(with_themes(dir.path(), &[])));
    fs::write(dir.path().join("themes/nord.css"), "/* nord */").unwrap();

    let (_, state) = status_and_json(send_to(&app, "/api/state", &[HOST]).await).await;
    assert_eq!(state["themes"], json!(["light", "dark", "nord"]));
    let response = send_to(&app, "/themes/nord.css", &[HOST]).await;
    assert_eq!(body(response).await, "/* nord */");
}

#[tokio::test]
async fn a_link_in_the_folder_is_a_theme() {
    // As a dotfile manager makes it: the file is in another folder.
    let dir = tempfile::tempdir().unwrap();
    fs::create_dir(dir.path().join("dotfiles")).unwrap();
    fs::write(dir.path().join("dotfiles/nord.css"), "/* nord */").unwrap();
    let state = with_themes(dir.path(), &[]);
    symlink("../dotfiles/nord.css", dir.path().join("themes/nord.css")).unwrap();
    let app = router(Arc::new(state));

    let (_, state) = status_and_json(send_to(&app, "/api/state", &[HOST]).await).await;
    assert_eq!(state["themes"], json!(["light", "dark", "nord"]));
    let response = send_to(&app, "/themes/nord.css", &[HOST]).await;
    assert_eq!(body(response).await, "/* nord */");
}

#[tokio::test]
async fn a_theme_outside_the_folder_is_refused() {
    let dir = tempfile::tempdir().unwrap();
    fs::write(dir.path().join("secret.css"), "/* secret */").unwrap();
    let state = with_themes(dir.path(), &[]);
    let response = send(state, "/themes/..%2Fsecret.css", &[HOST]).await;
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn an_unreadable_theme_is_an_error() {
    let dir = tempfile::tempdir().unwrap();
    let state = with_themes(dir.path(), &[("nord.css", "/* nord */")]);
    let locked = dir.path().join("themes/nord.css");
    fs::set_permissions(&locked, fs::Permissions::from_mode(0o000)).unwrap();
    if fs::read(&locked).is_ok() {
        // Root reads it anyway: nothing to test.
        return;
    }
    let response = send(state, "/themes/nord.css", &[HOST]).await;
    assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
}
