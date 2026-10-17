use std::sync::Arc;

use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use mdame::{app::AppState, server::router};
use tower::ServiceExt;

/// Sends `GET /api/state` to a server bound on 127.0.0.1:4891.
async fn status(host: Option<&str>, origin: Option<&str>) -> StatusCode {
    let state = AppState {
        addr: "127.0.0.1:4891".parse().unwrap(),
        workspace: None,
    };
    let mut request = Request::builder().uri("/api/state");
    if let Some(host) = host {
        request = request.header("host", host);
    }
    if let Some(origin) = origin {
        request = request.header("origin", origin);
    }
    let request = request.body(Body::empty()).unwrap();

    let response = router(Arc::new(state)).oneshot(request).await.unwrap();
    response.status()
}

#[tokio::test]
async fn request_without_origin_passes() {
    assert_eq!(status(Some("127.0.0.1:4891"), None).await, StatusCode::OK);
}

#[tokio::test]
async fn own_origin_passes() {
    for host in ["127.0.0.1:4891", "localhost:4891", "[::1]:4891"] {
        let origin = format!("http://{host}");
        assert_eq!(
            status(Some(host), Some(&origin)).await,
            StatusCode::OK,
            "{host}"
        );
    }
}

#[tokio::test]
async fn foreign_origin_is_refused() {
    let status = status(Some("127.0.0.1:4891"), Some("https://evil.example")).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn origin_on_another_local_port_is_refused() {
    let status = status(Some("127.0.0.1:4891"), Some("http://127.0.0.1:3000")).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn null_origin_is_refused() {
    // Sandboxed documents, such as files served by /raw, send "null".
    let status = status(Some("127.0.0.1:4891"), Some("null")).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn foreign_host_is_refused() {
    // DNS rebinding: evil.example resolves to 127.0.0.1.
    let status = status(Some("evil.example:4891"), None).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn host_with_another_port_is_refused() {
    let status = status(Some("127.0.0.1:3000"), None).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn missing_host_is_refused() {
    assert_eq!(status(None, None).await, StatusCode::FORBIDDEN);
}
