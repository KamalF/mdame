mod common;

use std::fs;
use std::os::unix::fs::{PermissionsExt, symlink};
use std::path::Path;
use std::sync::Arc;

use axum::http::StatusCode;
use common::{HOST, get_json, local, send, send_to, status_and_json, text};
use mdame::app::AppState;
use mdame::server::router;
use mdame::themes::BUILT_INS;
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

#[tokio::test]
async fn each_built_in_theme_is_listed_and_served() {
    let (_, body) = get_json(local(), "/api/state").await;
    assert_eq!(body["themes"], json!(BUILT_INS));
    for name in BUILT_INS {
        let response = send(local(), &format!("/themes/{name}.css"), &[HOST]).await;
        assert_eq!(response.status(), StatusCode::OK, "{name}");
        let content_type = &response.headers()["content-type"];
        assert_eq!(content_type, "text/css; charset=utf-8", "{name}");
        assert!(text(response).await.contains("color-scheme: "), "{name}");
    }
}

/// The built-ins, then `users`.
fn listed(users: &[&str]) -> serde_json::Value {
    json!([&BUILT_INS[..], users].concat())
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
    let dir = common::tempdir();
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
    assert_eq!(body["themes"], listed(&["arc", "nord"]));
}

#[tokio::test]
async fn a_user_theme_overrides_a_builtin() {
    let dir = common::tempdir();
    let state = with_themes(dir.path(), &[("light.css", "/* mine */")]);
    let response = send(state, "/themes/light.css", &[HOST]).await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response.headers()["content-type"],
        "text/css; charset=utf-8"
    );
    assert_eq!(text(response).await, "/* mine */");
}

#[tokio::test]
async fn a_new_user_theme_shows_without_a_restart() {
    let dir = common::tempdir();
    let app = router(Arc::new(with_themes(dir.path(), &[])));
    fs::write(dir.path().join("themes/nord.css"), "/* nord */").unwrap();

    let (_, state) = status_and_json(send_to(&app, "/api/state", &[HOST]).await).await;
    assert_eq!(state["themes"], listed(&["nord"]));
    let response = send_to(&app, "/themes/nord.css", &[HOST]).await;
    assert_eq!(text(response).await, "/* nord */");
}

#[tokio::test]
async fn a_link_in_the_folder_is_a_theme() {
    // As a dotfile manager makes it: the file is in another folder.
    let dir = common::tempdir();
    fs::create_dir(dir.path().join("dotfiles")).unwrap();
    fs::write(dir.path().join("dotfiles/nord.css"), "/* nord */").unwrap();
    let state = with_themes(dir.path(), &[]);
    symlink("../dotfiles/nord.css", dir.path().join("themes/nord.css")).unwrap();
    let app = router(Arc::new(state));

    let (_, state) = status_and_json(send_to(&app, "/api/state", &[HOST]).await).await;
    assert_eq!(state["themes"], listed(&["nord"]));
    let response = send_to(&app, "/themes/nord.css", &[HOST]).await;
    assert_eq!(text(response).await, "/* nord */");
}

#[tokio::test]
async fn a_theme_outside_the_folder_is_refused() {
    let dir = common::tempdir();
    fs::write(dir.path().join("secret.css"), "/* secret */").unwrap();
    let state = with_themes(dir.path(), &[]);
    let response = send(state, "/themes/..%2Fsecret.css", &[HOST]).await;
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn an_unreadable_theme_is_an_error() {
    let dir = common::tempdir();
    let state = with_themes(dir.path(), &[("nord.css", "/* nord */")]);
    let locked = dir.path().join("themes/nord.css");
    fs::set_permissions(&locked, fs::Permissions::from_mode(0o000)).unwrap();
    if fs::read(&locked).is_ok() {
        // Root reads it anyway: nothing to test.
        return;
    }
    let response = send(state, "/themes/nord.css", &[HOST]).await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}
