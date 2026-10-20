#![allow(dead_code)] // Each test crate uses a part of these helpers.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};

use axum::body::Body;
use axum::http::{Method, Request, StatusCode};
use axum::response::Response;
use mdame::{app::AppState, config::Config, server::router, watch::EVENT_CAPACITY};
use serde_json::Value;
use tokio::sync::broadcast;
use tower::ServiceExt;

pub async fn send(state: AppState, uri: &str, headers: &[(&str, &str)]) -> Response {
    send_body(state, Method::GET, uri, headers, "").await
}

pub async fn send_body(
    state: AppState,
    method: Method,
    uri: &str,
    headers: &[(&str, &str)],
    body: &str,
) -> Response {
    let mut request = Request::builder().method(method).uri(uri);
    for (name, value) in headers {
        request = request.header(*name, *value);
    }
    let request = request.body(Body::from(body.to_owned())).unwrap();
    router(Arc::new(state)).oneshot(request).await.unwrap()
}

pub async fn status_and_json(response: Response) -> (StatusCode, Value) {
    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    (status, serde_json::from_slice(&bytes).unwrap())
}

pub async fn get_json(state: AppState, uri: &str) -> (StatusCode, Value) {
    status_and_json(send(state, uri, &[HOST]).await).await
}

pub fn local() -> AppState {
    AppState {
        addr: "127.0.0.1:4891".parse().unwrap(),
        workspace: RwLock::new(None),
        token: None,
        config: RwLock::new(Config::default()),
        config_path: PathBuf::new(),
        recents_path: PathBuf::new(),
        state_dir: PathBuf::new(),
        events: broadcast::channel(EVENT_CAPACITY).0,
    }
}

pub const HOST: (&str, &str) = ("host", "127.0.0.1:4891");

/// A workspace in `dir/ws` holding `files`, with `secret.md` next to it,
/// outside the workspace.
pub fn workspace(dir: &Path, files: &[(&str, &[u8])]) -> AppState {
    let root = dir.join("ws");
    for (path, content) in files {
        let path = root.join(path);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, content).unwrap();
    }
    fs::create_dir_all(&root).unwrap();
    fs::write(dir.join("secret.md"), "secret\n").unwrap();
    let state = AppState {
        recents_path: dir.join("recents.toml"),
        ..local()
    };
    state.open_workspace(&root).unwrap();
    state
}
