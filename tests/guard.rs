mod common;

use axum::http::{StatusCode, header};
use common::{local, send};
use mdame::app::AppState;

const OK: StatusCode = StatusCode::OK;
const FORBIDDEN: StatusCode = StatusCode::FORBIDDEN;

const LOOPBACK: &str = "127.0.0.1:4891";
const ALL: &str = "0.0.0.0:4891";
const LAN: &str = "192.168.1.5:4891";

/// A server bound to `bound`, with the token "secret".
fn network(bound: &str) -> AppState {
    AppState {
        addr: bound.parse().unwrap(),
        token: Some("secret".to_string()),
        ..local()
    }
}

#[tokio::test]
async fn request_passes_only_with_own_host_own_origin_and_the_token() {
    #[rustfmt::skip]
    let cases: [(_, _, _, &[(&str, &str)], _); 21] = [
        ("loopback, no origin", LOOPBACK, "/api/state", &[("host", "127.0.0.1:4891")], OK),
        ("own origin, 127.0.0.1", LOOPBACK, "/api/state", &[("host", "127.0.0.1:4891"), ("origin", "http://127.0.0.1:4891")], OK),
        ("own origin, localhost", LOOPBACK, "/api/state", &[("host", "localhost:4891"), ("origin", "http://localhost:4891")], OK),
        ("own origin, ::1", LOOPBACK, "/api/state", &[("host", "[::1]:4891"), ("origin", "http://[::1]:4891")], OK),
        ("foreign origin", LOOPBACK, "/api/state", &[("host", "127.0.0.1:4891"), ("origin", "https://evil.example")], FORBIDDEN),
        ("origin on another local port", LOOPBACK, "/api/state", &[("host", "127.0.0.1:4891"), ("origin", "http://127.0.0.1:3000")], FORBIDDEN),
        // Sandboxed documents, such as files served by /raw, send "null".
        ("null origin", LOOPBACK, "/api/state", &[("host", "127.0.0.1:4891"), ("origin", "null")], FORBIDDEN),
        // DNS rebinding: evil.example resolves to 127.0.0.1.
        ("foreign host", LOOPBACK, "/api/state", &[("host", "evil.example:4891")], FORBIDDEN),
        ("host with another port", LOOPBACK, "/api/state", &[("host", "127.0.0.1:3000")], FORBIDDEN),
        ("no host", LOOPBACK, "/api/state", &[], FORBIDDEN),
        ("network, query token", ALL, "/api/state?t=secret", &[("host", "192.168.1.5:4891")], OK),
        ("network, cookie token", ALL, "/api/state", &[("host", "192.168.1.5:4891"), ("cookie", "theme=dark; mdame_token_4891=secret")], OK),
        ("network, no token", ALL, "/api/state", &[("host", "192.168.1.5:4891")], FORBIDDEN),
        ("network, wrong query token", ALL, "/api/state?t=guess", &[("host", "192.168.1.5:4891")], FORBIDDEN),
        ("network, token cut short", ALL, "/api/state?t=secre", &[("host", "192.168.1.5:4891")], FORBIDDEN),
        // Two bytes changed by the same bit: an XOR of the differences cancels out.
        ("network, token with two bytes changed alike", ALL, "/api/state?t=rdcret", &[("host", "192.168.1.5:4891")], FORBIDDEN),
        ("network, wrong cookie token", ALL, "/api/state", &[("host", "192.168.1.5:4891"), ("cookie", "mdame_token_4891=guess")], FORBIDDEN),
        ("network, host with another port", ALL, "/api/state?t=secret", &[("host", "192.168.1.5:3000")], FORBIDDEN),
        ("network, token with a foreign origin", ALL, "/api/state?t=secret", &[("host", "192.168.1.5:4891"), ("origin", "https://evil.example")], FORBIDDEN),
        ("bound to one address, foreign host", LAN, "/api/state?t=secret", &[("host", "evil.example:4891")], FORBIDDEN),
        ("bound to one address, own host", LAN, "/api/state?t=secret", &[("host", "192.168.1.5:4891")], OK),
    ];
    for (case, bound, uri, headers, expected) in cases {
        let state = if bound == LOOPBACK {
            local()
        } else {
            network(bound)
        };
        let response = send(state, uri, headers).await;
        assert_eq!(response.status(), expected, "{case}");
    }
}

/// A program on this machine that can reach the port.
#[tokio::test]
async fn loopback_needs_the_token_too() {
    let host = ("host", "127.0.0.1:4891");
    let response = send(network(LOOPBACK), "/api/state", &[host]).await;
    assert_eq!(response.status(), FORBIDDEN);
    let cookie = ("cookie", "mdame_token_4891=secret");
    let response = send(network(LOOPBACK), "/api/state", &[host, cookie]).await;
    assert_eq!(response.status(), OK);
}

#[tokio::test]
async fn query_token_sets_the_cookie_and_the_cookie_does_not() {
    let host = ("host", "192.168.1.5:4891");
    let response = send(network(ALL), "/?t=secret", &[host]).await;
    assert_eq!(
        response.headers()[header::SET_COOKIE],
        "mdame_token_4891=secret; HttpOnly; SameSite=Strict; Path=/; Max-Age=34560000"
    );

    let cookie = ("cookie", "mdame_token_4891=secret");
    let response = send(network(ALL), "/", &[host, cookie]).await;
    assert!(response.headers().get(header::SET_COOKIE).is_none());
}
