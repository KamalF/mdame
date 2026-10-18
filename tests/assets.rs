mod common;

use axum::http::{StatusCode, header};
use common::{local, send};

const HOST: (&str, &str) = ("host", "127.0.0.1:4891");

#[tokio::test]
async fn page_is_served_with_security_headers() {
    let response = send(local(), "/", &[HOST]).await;
    assert_eq!(response.status(), StatusCode::OK);
    let headers = response.headers();
    assert_eq!(headers[header::CONTENT_TYPE], "text/html; charset=utf-8");
    assert_eq!(
        headers[header::CONTENT_SECURITY_POLICY],
        "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'"
    );
    assert_eq!(headers[header::X_CONTENT_TYPE_OPTIONS], "nosniff");
    assert_eq!(headers[header::REFERRER_POLICY], "no-referrer");
}

#[tokio::test]
async fn view_and_edit_urls_serve_the_page() {
    for uri in ["/view/notes/today.md", "/edit/README.md"] {
        let response = send(local(), uri, &[HOST]).await;
        assert_eq!(response.status(), StatusCode::OK, "{uri}");
        assert_eq!(
            response.headers()[header::CONTENT_TYPE],
            "text/html; charset=utf-8"
        );
    }
}

#[tokio::test]
async fn unchanged_asset_answers_not_modified() {
    let response = send(local(), "/assets/main.js", &[HOST]).await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response.headers()[header::CONTENT_TYPE],
        "text/javascript; charset=utf-8"
    );
    let etag = response.headers()[header::ETAG]
        .to_str()
        .unwrap()
        .to_string();

    let again = send(
        local(),
        "/assets/main.js",
        &[HOST, ("if-none-match", &etag)],
    )
    .await;
    assert_eq!(again.status(), StatusCode::NOT_MODIFIED);
}

#[tokio::test]
async fn unknown_asset_is_not_found() {
    let response = send(local(), "/assets/nothing.js", &[HOST]).await;
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn assets_do_not_escape_web_dist() {
    for uri in [
        "/assets/../../Cargo.toml",
        "/assets/%2e%2e/%2e%2e/Cargo.toml",
    ] {
        let response = send(local(), uri, &[HOST]).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND, "{uri}");
    }
}

#[tokio::test]
async fn refusals_carry_security_headers_too() {
    let origin = ("origin", "https://evil.example");
    let response = send(local(), "/", &[HOST, origin]).await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    assert_eq!(
        response.headers()[header::X_CONTENT_TYPE_OPTIONS],
        "nosniff"
    );
}
