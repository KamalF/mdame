use crate::app::{AppState, OpenError, hex};
use crate::config::{self, HistoryMode, Recent};
use crate::error::ApiError;
use crate::tree::{self, Suggestion};
use crate::workspace;
use axum::{
    Json, Router,
    extract::{
        Path, Query, Request, State,
        rejection::{JsonRejection, QueryRejection},
    },
    http::{HeaderMap, HeaderValue, StatusCode, header},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post, put},
};
use rust_embed::RustEmbed;
use serde::{Deserialize, Serialize};
use std::io;
use std::net::SocketAddr;
use std::sync::Arc;

#[derive(Serialize)]
struct StateResponse {
    version: &'static str,
    workspace: Option<WorkspaceResponse>,
    needs_setup: bool,
    home: Option<String>,
}

#[derive(Serialize)]
struct WorkspaceResponse {
    root: String,
    start: Option<String>,
}

fn state_response(app: &AppState) -> StateResponse {
    let workspace = app.workspace.read().unwrap();
    StateResponse {
        version: env!("CARGO_PKG_VERSION"),
        workspace: workspace.as_ref().map(|workspace| WorkspaceResponse {
            root: workspace.root.display().to_string(),
            start: workspace.start.clone(),
        }),
        needs_setup: app.config.read().unwrap().history.is_none(),
        home: std::env::home_dir().map(|home| home.display().to_string()),
    }
}

async fn state(State(app): State<Arc<AppState>>) -> Json<StateResponse> {
    Json(state_response(&app))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Settings {
    history: HistoryMode,
}

/// Saves the file first, so the config in memory never differs from it.
async fn settings(
    State(app): State<Arc<AppState>>,
    body: Result<Json<Settings>, JsonRejection>,
) -> Result<Json<StateResponse>, ApiError> {
    let Json(settings) = body?;
    let mut config = app.config.write().unwrap();
    let mut new = config.clone();
    new.history = Some(settings.history);
    config::save(&new, &app.config_path).map_err(|error| {
        tracing::error!("could not save the settings: {error}");
        ApiError::Internal(error.to_string())
    })?;
    *config = new;
    // state_response takes the read lock: holding the write lock would deadlock.
    drop(config);
    Ok(Json(state_response(&app)))
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

const PAGE_CSP: &str = "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'";

async fn security_headers(req: Request, next: Next) -> Response {
    let mut response = next.run(req).await;
    let headers = response.headers_mut();
    headers.insert(
        header::CONTENT_SECURITY_POLICY,
        HeaderValue::from_static(PAGE_CSP),
    );
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    headers.insert(
        header::REFERRER_POLICY,
        HeaderValue::from_static("no-referrer"),
    );
    response
}

#[derive(RustEmbed)]
#[folder = "web/dist"]
struct Dist;

async fn page(headers: HeaderMap) -> Response {
    embedded("index.html", &headers)
}

async fn asset(Path(path): Path<String>, headers: HeaderMap) -> Response {
    embedded(&format!("assets/{path}"), &headers)
}

fn embedded(path: &str, request_headers: &HeaderMap) -> Response {
    let Some(file) = Dist::get(path) else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let hash = file.metadata.sha256_hash();
    let etag = format!("\"{}\"", hex(&hash));
    let unchanged = request_headers
        .get(header::IF_NONE_MATCH)
        .is_some_and(|value| value.as_bytes() == etag.as_bytes());
    if unchanged {
        return (StatusCode::NOT_MODIFIED, [(header::ETAG, etag)]).into_response();
    }
    let content_type = content_type(path).to_string();
    (
        [(header::CONTENT_TYPE, content_type), (header::ETAG, etag)],
        file.data,
    )
        .into_response()
}

fn content_type(path: &str) -> &'static str {
    match path.rsplit_once('.').map(|(_, extension)| extension) {
        Some("html") => "text/html; charset=utf-8",
        Some("js") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("svg") => "image/svg+xml",
        Some("woff2") => "font/woff2",
        _ => "application/octet-stream",
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct OpenRequest {
    path: String,
}

async fn open_workspace(
    State(app): State<Arc<AppState>>,
    body: Result<Json<OpenRequest>, JsonRejection>,
) -> Result<Json<StateResponse>, ApiError> {
    let Json(request) = body?;
    let path = workspace::expand_home(&request.path, std::env::home_dir().as_deref());
    // A relative path would depend on the folder where mdame was started,
    // which the page does not know.
    if path.is_relative() {
        return Err(ApiError::BadRequest(format!(
            "{}: give an absolute path or one that starts with ~/",
            request.path
        )));
    }
    app.open_workspace(&path).map_err(|error| {
        let message = format!("{}: {error}", request.path);
        match error {
            OpenError::AlreadyOpen => ApiError::Conflict(error.to_string()),
            OpenError::Io(io) if io.kind() == io::ErrorKind::NotFound => {
                ApiError::NotFound(message)
            }
            OpenError::Io(_) => ApiError::BadRequest(message),
        }
    })?;
    Ok(Json(state_response(&app)))
}

async fn tree(State(app): State<Arc<AppState>>) -> Result<Json<tree::Node>, ApiError> {
    let workspace = app.workspace()?;
    // The walk reads every folder: run it where blocking is allowed.
    let node = tokio::task::spawn_blocking(move || tree::build(&workspace.root))
        .await
        .map_err(|error| ApiError::Internal(error.to_string()))?;
    Ok(Json(node))
}

async fn recents(State(app): State<Arc<AppState>>) -> Json<Vec<Recent>> {
    Json(app.recents().entries)
}

#[derive(Deserialize)]
struct CompleteQuery {
    prefix: String,
}

async fn complete(
    query: Result<Query<CompleteQuery>, QueryRejection>,
) -> Result<Json<Vec<Suggestion>>, ApiError> {
    let Query(query) = query?;
    let home = std::env::home_dir();
    Ok(Json(tree::complete(&query.prefix, home.as_deref())))
}

pub fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route("/", get(page))
        .route("/view/{*path}", get(page))
        .route("/edit/{*path}", get(page))
        .route("/assets/{*path}", get(asset))
        .route("/api/state", get(state))
        .route("/api/settings", put(settings))
        .route("/api/workspace", post(open_workspace))
        .route("/api/complete", get(complete))
        .route("/api/recents", get(recents))
        .route("/api/tree", get(tree))
        .layer(middleware::from_fn_with_state(app_state.clone(), guard))
        .layer(middleware::from_fn(security_headers))
        .with_state(app_state)
}
