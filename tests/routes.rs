//! Rules that hold for every route of a kind. A new route adds a row here.

mod common;

use std::os::unix::fs::symlink;
use std::path::Path;

use axum::http::{Method, StatusCode};
use common::{HOST, send, send_body};
use mdame::app::AppState;

const ROUTES: [(Method, &str); 13] = [
    (Method::GET, "/"),
    (Method::GET, "/view/a.md"),
    (Method::GET, "/edit/a.md"),
    (Method::GET, "/assets/main.js"),
    (Method::GET, "/raw/a.md"),
    (Method::GET, "/api/state"),
    (Method::PUT, "/api/settings"),
    (Method::POST, "/api/workspace"),
    (Method::GET, "/api/complete?prefix=/"),
    (Method::GET, "/api/recents"),
    (Method::GET, "/api/tree"),
    (Method::GET, "/api/file?path=a.md"),
    (Method::GET, "/ws"),
];

/// Routes that take a workspace path, with `{}` where the path goes.
const PATH_ROUTES: [&str; 2] = ["/api/file?path={}", "/raw/{}"];

fn workspace(dir: &Path) -> AppState {
    common::workspace(dir, &[("a.md", b"# A\n")])
}

#[tokio::test]
async fn every_route_refuses_a_foreign_origin() {
    let dir = tempfile::tempdir().unwrap();
    for (method, uri) in ROUTES {
        let origin = ("origin", "https://evil.example");
        let response = send_body(workspace(dir.path()), method, uri, &[HOST, origin], "{}").await;
        let status = response.status();
        assert_eq!(status, StatusCode::FORBIDDEN, "{uri}");
    }
}

#[tokio::test]
async fn routes_that_change_state_take_json_only() {
    // The body type of a plain HTML form.
    let form = ("content-type", "application/x-www-form-urlencoded");
    for (method, uri) in ROUTES
        .into_iter()
        .filter(|(method, _)| method != Method::GET)
    {
        let status = send_body(common::local(), method, uri, &[HOST, form], "path=/")
            .await
            .status();
        assert_eq!(status, StatusCode::BAD_REQUEST, "{uri}");
    }
}

#[tokio::test]
async fn path_routes_stay_in_the_workspace() {
    let dir = tempfile::tempdir().unwrap();
    workspace(dir.path());
    let secret = dir.path().join("secret.md");
    symlink(&secret, dir.path().join("ws/out.md")).unwrap();
    symlink("../secret.md", dir.path().join("ws/relative-out.md")).unwrap();
    symlink("a.md", dir.path().join("ws/link.md")).unwrap();
    let absolute = secret.to_str().unwrap().to_owned();
    let cases = [
        ("../secret.md", StatusCode::FORBIDDEN),
        (&absolute, StatusCode::FORBIDDEN),
        ("out.md", StatusCode::FORBIDDEN),
        ("relative-out.md", StatusCode::FORBIDDEN),
        ("link.md", StatusCode::OK),
    ];
    for route in PATH_ROUTES {
        for (path, expected) in &cases {
            let uri = route.replace("{}", &path.replace('/', "%2F"));
            let status = send(workspace(dir.path()), &uri, &[HOST]).await.status();
            assert_eq!(status, *expected, "{uri}");
        }
    }
}
