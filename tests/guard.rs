mod common;

use axum::http::{StatusCode, header};
use std::fs;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use common::{local, send, send_to};
use mdame::app::{Access, AppState, OPENED_CODE_LIFE, OpenCode, PRINTED_CODE_LIFE};
use mdame::server::router;
use mdame::watch::Event;

const OK: StatusCode = StatusCode::OK;
const FORBIDDEN: StatusCode = StatusCode::FORBIDDEN;
const REDIRECT: StatusCode = StatusCode::TEMPORARY_REDIRECT;

const LOOPBACK: &str = "127.0.0.1:4891";
const ALL: &str = "0.0.0.0:4891";
const LAN: &str = "192.168.1.5:4891";

const HOST: (&str, &str) = ("host", "127.0.0.1:4891");
const COOKIE: (&str, &str) = ("cookie", "mdame_token_4891=secret");

/// A server bound to `bound`, with the token "secret".
fn with_token(bound: &str) -> AppState {
    with_access(bound, Vec::new())
}

/// As `with_token`, with these open codes.
fn with_access(bound: &str, open_codes: Vec<OpenCode>) -> AppState {
    let access = Access {
        token: Some("secret".to_string()),
        open_codes,
    };
    AppState {
        addr: bound.parse().unwrap(),
        access: Mutex::new(access),
        ..local()
    }
}

#[tokio::test]
async fn request_passes_only_with_own_host_own_origin_and_the_token() {
    #[rustfmt::skip]
    let cases: [(_, _, _, &[(&str, &str)], _); 21] = [
        ("loopback, cookie", LOOPBACK, "/api/state", &[HOST, COOKIE], OK),
        ("own origin, 127.0.0.1", LOOPBACK, "/api/state", &[HOST, COOKIE, ("origin", "http://127.0.0.1:4891")], OK),
        ("own origin, localhost", LOOPBACK, "/api/state", &[("host", "localhost:4891"), COOKIE, ("origin", "http://localhost:4891")], OK),
        ("own origin, ::1", LOOPBACK, "/api/state", &[("host", "[::1]:4891"), COOKIE, ("origin", "http://[::1]:4891")], OK),
        ("foreign origin", LOOPBACK, "/api/state", &[HOST, COOKIE, ("origin", "https://evil.example")], FORBIDDEN),
        ("origin on another local port", LOOPBACK, "/api/state", &[HOST, COOKIE, ("origin", "http://127.0.0.1:3000")], FORBIDDEN),
        // Sandboxed documents, such as files served by /raw, send "null".
        ("null origin", LOOPBACK, "/api/state", &[HOST, COOKIE, ("origin", "null")], FORBIDDEN),
        // DNS rebinding: evil.example resolves to 127.0.0.1.
        ("foreign host", LOOPBACK, "/api/state", &[("host", "evil.example:4891"), COOKIE], FORBIDDEN),
        ("host with another port", LOOPBACK, "/api/state", &[("host", "127.0.0.1:3000"), COOKIE], FORBIDDEN),
        ("no host", LOOPBACK, "/api/state", &[COOKIE], FORBIDDEN),
        // A program on this machine that can reach the port.
        ("loopback, no token", LOOPBACK, "/api/state", &[HOST], FORBIDDEN),
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
    ];
    for (case, bound, uri, headers, expected) in cases {
        let response = send(with_token(bound), uri, headers).await;
        assert_eq!(response.status(), expected, "{case}");
    }
}

#[tokio::test]
async fn query_token_sets_the_cookie_and_the_cookie_does_not() {
    let host = ("host", "192.168.1.5:4891");
    let response = send(with_token(ALL), "/?t=secret", &[host]).await;
    assert_eq!(
        response.headers()[header::SET_COOKIE],
        "mdame_token_4891=secret; HttpOnly; SameSite=Strict; Path=/; Max-Age=34560000"
    );

    let response = send(with_token(ALL), "/", &[host, COOKIE]).await;
    assert!(response.headers().get(header::SET_COOKIE).is_none());
}

fn code(code: &str, life: Duration) -> OpenCode {
    OpenCode::new(code.to_string(), life)
}

fn token_of(state: &AppState) -> String {
    state.access.lock().unwrap().token.clone().unwrap()
}

/// The browser's command line holds this code, which other accounts can read.
#[tokio::test]
async fn the_opened_code_works_once_and_for_a_minute() {
    let state = Arc::new(with_access(LOOPBACK, vec![code("c1", OPENED_CODE_LIFE)]));
    let app = router(state.clone());
    let response = send_to(&app, "//view/a.md?c=c1", &[HOST]).await;
    // The code leaves the address, so that a reload does not send it again.
    // An absolute location: `//view` alone would name a host.
    assert_eq!(response.status(), REDIRECT);
    let location = &response.headers()[header::LOCATION];
    assert_eq!(location, "http://127.0.0.1:4891//view/a.md");
    let cookie = response.headers()[header::SET_COOKIE].to_str().unwrap();
    assert!(cookie.starts_with("mdame_token_4891=secret;"), "{cookie}");
    assert_eq!(
        send_to(&app, "/view/a.md", &[HOST, COOKIE]).await.status(),
        OK
    );
    assert_eq!(token_of(&state), "secret");

    let mut old = code("c1", OPENED_CODE_LIFE);
    old.made = Instant::now().checked_sub(Duration::from_secs(61)).unwrap();
    let state = with_access(LOOPBACK, vec![old]);
    assert_eq!(send(state, "/?c=c1", &[HOST]).await.status(), FORBIDDEN);
}

/// A person may open the printed URL some time after mdame started.
#[tokio::test]
async fn the_printed_code_works_for_ten_minutes() {
    let mut printed = code("c2", PRINTED_CODE_LIFE);
    printed.made = Instant::now()
        .checked_sub(Duration::from_secs(590))
        .unwrap();
    let state = with_access(LOOPBACK, vec![printed]);
    assert_eq!(send(state, "/?c=c2", &[HOST]).await.status(), REDIRECT);

    let mut printed = code("c2", PRINTED_CODE_LIFE);
    printed.made = Instant::now()
        .checked_sub(Duration::from_secs(601))
        .unwrap();
    let state = with_access(LOOPBACK, vec![printed]);
    assert_eq!(send(state, "/?c=c2", &[HOST]).await.status(), FORBIDDEN);
}

/// Another program used the code before the browser: its cookie must stop
/// working, at this start and at the next.
#[tokio::test]
async fn a_code_used_twice_makes_a_new_token() {
    let dir = tempfile::tempdir().unwrap();
    let token_file = dir.path().join("token");
    let state = Arc::new(AppState {
        token_file: Some(token_file.clone()),
        ..with_access(LOOPBACK, vec![code("c1", OPENED_CODE_LIFE)])
    });
    let app = router(state.clone());
    assert_eq!(send_to(&app, "/?c=c1", &[HOST]).await.status(), REDIRECT);
    let mut events = state.events.subscribe();

    let response = send_to(&app, "/?c=c1", &[HOST]).await;
    assert_eq!(response.status(), FORBIDDEN);
    // Every socket wakes: those of the old token close at once.
    assert!(matches!(events.try_recv(), Ok(Event::Resync)));
    let token = token_of(&state);
    assert_ne!(token, "secret");
    assert_eq!(fs::read_to_string(&token_file).unwrap(), token);
    let stolen = send_to(&app, "/api/state", &[HOST, COOKIE]).await;
    assert_eq!(stolen.status(), FORBIDDEN);
    let cookie = format!("mdame_token_4891={token}");
    let new = send_to(&app, "/api/state", &[HOST, ("cookie", &cookie)]).await;
    assert_eq!(new.status(), OK);
    // One theft makes one new token: the code no longer counts at all.
    assert_eq!(send_to(&app, "/?c=c1", &[HOST]).await.status(), FORBIDDEN);
    assert_eq!(token_of(&state), token);
    // The new URL carries a new open code, not the token.
    let access = state.access.lock().unwrap();
    assert_eq!(access.open_codes.len(), 1);
    assert!(!access.open_codes[0].used && access.open_codes[0].code != "c1");
}

/// A browser that starts slowly still finds the theft.
#[tokio::test]
async fn a_used_code_that_comes_back_late_makes_a_new_token() {
    let mut used = code("c1", OPENED_CODE_LIFE);
    used.made = Instant::now().checked_sub(Duration::from_secs(61)).unwrap();
    used.used = true;
    let state = Arc::new(with_access(LOOPBACK, vec![used]));
    let response = send_to(&router(state.clone()), "/?c=c1", &[HOST]).await;
    assert_eq!(response.status(), FORBIDDEN);
    assert_ne!(token_of(&state), "secret");
}

/// A code leaves the address once used: one that comes back with the
/// cookie came from somewhere else too.
#[tokio::test]
async fn a_reuse_with_the_cookie_is_a_theft_too() {
    let state = Arc::new(with_access(LOOPBACK, vec![code("c1", OPENED_CODE_LIFE)]));
    let app = router(state.clone());
    assert_eq!(send_to(&app, "/?c=c1", &[HOST]).await.status(), REDIRECT);

    let response = send_to(&app, "/?c=c1", &[HOST, COOKIE]).await;
    assert_eq!(response.status(), FORBIDDEN);
    assert_ne!(token_of(&state), "secret");
}
