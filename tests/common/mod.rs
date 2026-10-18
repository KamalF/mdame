#![allow(dead_code)] // Each test crate uses a part of these helpers.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};

use axum::{body::Body, http::Request, response::Response};
use mdame::{
    app::{AppState, RENDER_SLOTS},
    config::Config,
    server::router,
};
use tokio::sync::Semaphore;
use tower::ServiceExt;

pub async fn send(state: AppState, uri: &str, headers: &[(&str, &str)]) -> Response {
    let mut request = Request::builder().uri(uri);
    for (name, value) in headers {
        request = request.header(*name, *value);
    }
    let request = request.body(Body::empty()).unwrap();
    router(Arc::new(state)).oneshot(request).await.unwrap()
}

pub fn local() -> AppState {
    AppState {
        addr: "127.0.0.1:4891".parse().unwrap(),
        workspace: RwLock::new(None),
        token: None,
        config: RwLock::new(Config::default()),
        config_path: PathBuf::new(),
        recents_path: PathBuf::new(),
        renders: Arc::new(Semaphore::new(RENDER_SLOTS)),
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
