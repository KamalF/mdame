mod common;

use axum::http::{StatusCode, header};
use common::{local, send};
use mdame::app::AppState;

/// A server bound with `-H 0.0.0.0`, reached as 192.168.1.5 from the network.
fn network() -> AppState {
    AppState {
        addr: "0.0.0.0:4891".parse().unwrap(),
        workspace: None,
        token: Some("secret".to_string()),
    }
}

const LAN_HOST: (&str, &str) = ("host", "192.168.1.5:4891");

async fn status(host: Option<&str>, origin: Option<&str>) -> StatusCode {
    let mut headers = Vec::new();
    if let Some(host) = host {
        headers.push(("host", host));
    }
    if let Some(origin) = origin {
        headers.push(("origin", origin));
    }
    send(local(), "/api/state", &headers).await.status()
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

#[tokio::test]
async fn network_request_without_token_is_refused() {
    let response = send(network(), "/api/state", &[LAN_HOST]).await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn network_request_with_wrong_token_is_refused() {
    let response = send(network(), "/api/state?t=guess", &[LAN_HOST]).await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);

    let cookie = ("cookie", "mdame_token_4891=guess");
    let response = send(network(), "/api/state", &[LAN_HOST, cookie]).await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn query_token_passes_and_sets_the_cookie() {
    let response = send(network(), "/?t=secret", &[LAN_HOST]).await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response.headers()[header::SET_COOKIE],
        "mdame_token_4891=secret; HttpOnly; SameSite=Strict; Path=/"
    );
}

#[tokio::test]
async fn cookie_token_passes() {
    let cookie = ("cookie", "theme=dark; mdame_token_4891=secret");
    let response = send(network(), "/api/state", &[LAN_HOST, cookie]).await;
    assert_eq!(response.status(), StatusCode::OK);
    assert!(response.headers().get(header::SET_COOKIE).is_none());
}

#[tokio::test]
async fn network_host_with_another_port_is_refused() {
    let host = ("host", "192.168.1.5:3000");
    let response = send(network(), "/api/state?t=secret", &[host]).await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn token_does_not_excuse_a_foreign_origin() {
    let origin = ("origin", "https://evil.example");
    let response = send(network(), "/api/state?t=secret", &[LAN_HOST, origin]).await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn ip_bound_server_still_checks_the_host() {
    let state = AppState {
        addr: "192.168.1.5:4891".parse().unwrap(),
        ..network()
    };
    let rebinding = ("host", "evil.example:4891");
    let response = send(state, "/api/state?t=secret", &[rebinding]).await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}
