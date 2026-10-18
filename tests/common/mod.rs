use std::path::PathBuf;
use std::sync::{Arc, RwLock};

use axum::{body::Body, http::Request, response::Response};
use mdame::{app::AppState, config::Config, server::router};
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
    }
}
