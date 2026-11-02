mod common;

use axum::http::StatusCode;
use common::{HOST, local, send};

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
        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        assert!(String::from_utf8_lossy(&body).contains(scheme), "{name}");
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
