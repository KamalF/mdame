use crate::app::AppState;
use crate::error::ApiError;
use axum::{
    Json, Router,
    extract::{Request, State},
    http::{HeaderMap, HeaderValue, header},
    middleware::{self, Next},
    response::Response,
    routing::get,
};
use serde::Serialize;
use std::net::SocketAddr;
use std::sync::Arc;

#[derive(Serialize)]
struct StateResponse {
    version: &'static str,
    workspace: Option<String>,
}

async fn state(State(app): State<Arc<AppState>>) -> Json<StateResponse> {
    Json(StateResponse {
        version: env!("CARGO_PKG_VERSION"),
        workspace: app.workspace.clone(),
    })
}

/// Refuses requests that do not come from the mdame page itself.
///
/// The Host check stops DNS rebinding: a hostile domain that resolves to
/// 127.0.0.1 still sends its own name as Host. The Origin check stops other
/// web pages, which browsers mark with their own Origin. Requests without an
/// Origin (curl, the page loading itself) pass.
///
/// When bound beyond loopback, every request also needs the token: in the
/// `t` query parameter, which sets a cookie, or in that cookie.
async fn guard(
    State(app): State<Arc<AppState>>,
    req: Request,
    next: Next,
) -> Result<Response, ApiError> {
    let headers = req.headers();

    let host = headers
        .get(header::HOST)
        .and_then(|value| value.to_str().ok())
        .filter(|host| is_own_host(host, app.addr))
        .ok_or_else(|| {
            tracing::debug!(host = ?headers.get(header::HOST), "refused: host not allowed");
            ApiError::Forbidden("host not allowed")
        })?;

    if let Some(origin) = headers.get(header::ORIGIN) {
        // The Host is already checked, so our own origin is the page's Host.
        if origin.as_bytes() != format!("http://{host}").as_bytes() {
            tracing::debug!(?origin, "refused: origin not allowed");
            return Err(ApiError::Forbidden("origin not allowed"));
        }
    }

    let mut set_cookie = None;
    if let Some(token) = &app.token {
        // The port is in the name so that two mdame on one machine keep
        // their own cookie: browsers ignore the port when sending cookies.
        let cookie_name = format!("mdame_token_{}", app.addr.port());
        if query_has_token(req.uri().query(), token) {
            set_cookie = Some(format!(
                "{cookie_name}={token}; HttpOnly; SameSite=Strict; Path=/"
            ));
        } else if !cookie_has_token(headers, &cookie_name, token) {
            tracing::debug!("refused: missing or wrong token");
            return Err(ApiError::Forbidden("missing or wrong token"));
        }
    }

    let mut response = next.run(req).await;
    if let Some(cookie) = set_cookie {
        let value = HeaderValue::try_from(cookie).expect("token is hex digits");
        response.headers_mut().insert(header::SET_COOKIE, value);
    }
    Ok(response)
}

fn is_own_host(host: &str, addr: SocketAddr) -> bool {
    let port = addr.port();
    if addr.ip().is_unspecified() {
        // Bound to all interfaces: the browser may name this machine by any
        // address or hostname. The token, always set in this case, is the
        // defence against DNS rebinding.
        return host.ends_with(&format!(":{port}"));
    }
    [
        format!("localhost:{port}"),
        format!("127.0.0.1:{port}"),
        format!("[::1]:{port}"),
        addr.to_string(),
    ]
    .contains(&host.to_string())
}

fn query_has_token(query: Option<&str>, token: &str) -> bool {
    query.is_some_and(|query| {
        query
            .split('&')
            .filter_map(|pair| pair.strip_prefix("t="))
            .any(|value| same_secret(value, token))
    })
}

fn cookie_has_token(headers: &HeaderMap, name: &str, token: &str) -> bool {
    headers
        .get_all(header::COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(';'))
        .filter_map(|cookie| cookie.trim().split_once('='))
        .any(|(key, value)| key == name && same_secret(value, token))
}

/// Compares in a time that does not depend on where the first difference
/// is, so that response times do not leak the token byte by byte.
fn same_secret(a: &str, b: &str) -> bool {
    a.len() == b.len()
        && a.bytes()
            .zip(b.bytes())
            .fold(0, |acc, (x, y)| acc | (x ^ y))
            == 0
}

pub fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route("/", get(|| async { "hello" }))
        .route("/api/state", get(state))
        .layer(middleware::from_fn_with_state(app_state.clone(), guard))
        .with_state(app_state)
}
