use crate::app::{
    Access, AppState, OpenCode, OpenError, PRINTED_CODE_LIFE, hex, new_token, print_urls,
    write_token,
};
use crate::config::{self, HistoryMode, Recent};
use crate::document::{self, EDIT_LIMIT, SaveError, View};
use crate::error::{ApiError, io_message};
use crate::history::{self, Revision};
use crate::tree::{self, Suggestion};
use crate::watch::Event;
use crate::workspace;
use crate::ws;
use axum::{
    Json, Router,
    extract::{
        DefaultBodyLimit, Path, Query, Request, State,
        rejection::{JsonRejection, QueryRejection},
    },
    http::{HeaderMap, HeaderValue, StatusCode, header},
    middleware::{self, Next},
    response::{IntoResponse, Redirect, Response},
    routing::{get, post, put},
};
use rust_embed::RustEmbed;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io;
use std::net::SocketAddr;
use std::sync::{Arc, PoisonError};

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
/// Every request also needs the token: in the `t` query parameter, or the
/// open code in `c`, either of which sets a cookie, or in that cookie.
async fn guard(
    State(app): State<Arc<AppState>>,
    mut req: Request,
    next: Next,
) -> Result<Response, ApiError> {
    let (mut response, set_cookie) = match admit(&app, &req)? {
        Admission::Pass { checked, cookie } => {
            req.extensions_mut().insert(checked);
            (next.run(req).await, cookie)
        }
        Admission::Redirect { location, cookie } => {
            (Redirect::temporary(&location).into_response(), cookie)
        }
    };
    if let Some(cookie) = set_cookie {
        let value = HeaderValue::try_from(cookie).expect("token is hex digits");
        response.headers_mut().insert(header::SET_COOKIE, value);
    }
    Ok(response)
}

enum Admission {
    Pass {
        checked: Checked,
        cookie: Option<String>,
    },
    Redirect {
        location: String,
        cookie: Option<String>,
    },
}

/// The decisions of the guard, under one lock on the token and its codes: a
/// theft that replaces the token during a request is either all seen or not
/// at all.
fn admit(app: &AppState, req: &Request) -> Result<Admission, ApiError> {
    let headers = req.headers();
    let mut access = app.access.lock().unwrap_or_else(PoisonError::into_inner);

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

    let Some(token) = access.token.clone() else {
        return Ok(Admission::Pass {
            checked: Checked { token: None },
            cookie: None,
        });
    };
    // The port is in the name so that two mdame on one machine keep their
    // own cookie: browsers ignore the port when sending cookies.
    let cookie_name = format!("mdame_token_{}", app.addr.port());
    // Kept across browser restarts: mdame may run longer than the browser.
    // Browsers cap Max-Age at 400 days.
    let cookie =
        format!("{cookie_name}={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=34560000");
    let query = req.uri().query();
    match open_code(&mut access, query) {
        Code::Stolen => {
            tracing::warn!(
                "a link that mdame opened or printed was used twice: the token is a new one"
            );
            replace_token(app, &mut access);
            return Err(ApiError::Forbidden(
                "open the new URL that mdame printed: this link was used before",
            ));
        }
        // The code leaves the address: a reload would send it again, and a
        // second use counts as a theft.
        Code::Fresh => {
            // Absolute: a path that starts with `//` would name another host.
            let location = format!("http://{host}{}", req.uri().path());
            return Ok(Admission::Redirect {
                location,
                cookie: Some(cookie),
            });
        }
        Code::Absent => {}
    }
    let checked = Checked {
        token: Some(token.clone()),
    };
    if query_has(query, "t", &token) {
        return Ok(Admission::Pass {
            checked,
            cookie: Some(cookie),
        });
    }
    if cookie_has_token(headers, &cookie_name, &token) {
        return Ok(Admission::Pass {
            checked,
            cookie: None,
        });
    }
    tracing::debug!("refused: missing or wrong token");
    Err(ApiError::Forbidden("missing or wrong token"))
}

/// The token that the guard checked a request against: a socket closes once
/// a theft replaces it.
#[derive(Clone)]
pub struct Checked {
    pub token: Option<String>,
}

enum Code {
    /// The query holds an open code, used now for the first time.
    Fresh,
    /// The query holds an open code that something used before: a code
    /// leaves the address once used, so something else had it first. The
    /// code then stops counting, so that one theft makes one new token.
    Stolen,
    Absent,
}

fn open_code(access: &mut Access, query: Option<&str>) -> Code {
    let codes = &mut access.open_codes;
    let Some(index) = codes
        .iter()
        .position(|code| query_has(query, "c", &code.code))
    else {
        return Code::Absent;
    };
    let code = &mut codes[index];
    // Used before, however late it comes back: a browser that started
    // slowly still finds the theft.
    if code.used {
        codes.remove(index);
        Code::Stolen
    } else if code.made.elapsed() < code.life {
        code.used = true;
        Code::Fresh
    } else {
        Code::Absent
    }
}

/// An open code went to someone else first. A new token makes the cookie
/// that it got worthless.
fn replace_token(app: &AppState, access: &mut Access) {
    let (Ok(token), Ok(code)) = (new_token(), new_token()) else {
        tracing::error!("no new token: the OS gave no random bytes");
        return;
    };
    if let Some(path) = &app.token_file
        && let Err(error) = write_token(path, &token, |temp, path| fs::rename(temp, path))
    {
        let path = path.display();
        tracing::warn!(
            "delete {path}: the next start would take the old token again: {}",
            io_message(&error)
        );
    }
    access.token = Some(token.clone());
    // The new URL carries a new open code, not the token: the user may open
    // it from the terminal, through a command line again. A used code stays:
    // a second use of it is still a theft.
    access.open_codes.retain(|code| code.used);
    access
        .open_codes
        .push(OpenCode::new(code.clone(), PRINTED_CODE_LIFE));
    // Wakes every socket: those of the old token close at once, not at
    // their next event.
    let _ = app.events.send(Event::Resync);
    print_urls(app.addr, &code, &token);
}

fn is_own_host(host: &str, addr: SocketAddr) -> bool {
    let port = addr.port();
    if addr.ip().is_unspecified() {
        // Bound to all interfaces: the browser may name this machine by any
        // address or hostname. The token is the defence against DNS
        // rebinding.
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

fn query_has(query: Option<&str>, key: &str, secret: &str) -> bool {
    query.is_some_and(|query| {
        query
            .split('&')
            .filter_map(|pair| pair.strip_prefix(key)?.strip_prefix('='))
            .any(|value| same_secret(value, secret))
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

const PAGE_CSP: &str = "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; frame-src 'none'; object-src 'none'; frame-ancestors 'none'";

async fn security_headers(req: Request, next: Next) -> Response {
    // A file may be private, and the browser's cache outlives the tab.
    let path = req.uri().path();
    let private = path.starts_with("/api/") || path.starts_with("/raw/");
    let mut response = next.run(req).await;
    let headers = response.headers_mut();
    if private {
        headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    }
    // `/raw` sets its own, stricter policy.
    headers
        .entry(header::CONTENT_SECURITY_POLICY)
        .or_insert(HeaderValue::from_static(PAGE_CSP));
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
    // Starting the watcher walks the whole folder.
    let opened = tokio::task::spawn_blocking({
        let (app, path) = (app.clone(), path.clone());
        move || app.open_picked(&path)
    })
    .await?;
    opened.map_err(|error| {
        let message = format!("{}: {error}", request.path);
        match error {
            OpenError::AlreadyOpen => ApiError::Conflict(error.to_string()),
            OpenError::Hidden => ApiError::BadRequest(message),
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
    let node = tokio::task::spawn_blocking(move || tree::build(&workspace)).await?;
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

#[derive(Deserialize)]
struct FileQuery {
    path: String,
}

async fn file(
    State(app): State<Arc<AppState>>,
    query: Result<Query<FileQuery>, QueryRejection>,
) -> Result<Json<View>, ApiError> {
    let Query(query) = query?;
    let workspace = app.workspace()?;
    // Reading and rendering a large file takes a while.
    let path = query.path.clone();
    let view = tokio::task::spawn_blocking(move || document::view(&workspace.dir, &path)).await?;
    view.map(Json)
        .map_err(|error| file_error(&query.path, error))
}

async fn source(
    State(app): State<Arc<AppState>>,
    query: Result<Query<FileQuery>, QueryRejection>,
) -> Result<impl IntoResponse, ApiError> {
    let Query(query) = query?;
    let workspace = app.workspace()?;
    let path = query.path.clone();
    let source =
        tokio::task::spawn_blocking(move || document::source(&workspace.dir, &path)).await?;
    let source = source.map_err(|error| file_error(&query.path, error))?;
    Ok(([(header::ETAG, etag(&source.version))], Json(source)))
}

fn etag(version: &str) -> String {
    format!("\"{version}\"")
}

async fn revisions(
    State(app): State<Arc<AppState>>,
    query: Result<Query<FileQuery>, QueryRejection>,
) -> Result<Json<Vec<Revision>>, ApiError> {
    let Query(query) = query?;
    let workspace = app.workspace()?;
    let mode = app.config.read().unwrap().history.unwrap_or_default();
    let path = query.path.clone();
    let revisions = tokio::task::spawn_blocking(move || {
        let history = history::open_root(mode, &workspace, &app.state_dir)?;
        document::revisions(&workspace.dir, history.as_ref(), &path)
    })
    .await?;
    revisions
        .map(Json)
        .map_err(|error| file_error(&query.path, error))
}

#[derive(Deserialize)]
struct RevisionQuery {
    path: String,
    id: String,
}

#[derive(Serialize)]
struct RevisionText {
    content: String,
}

async fn revision(
    State(app): State<Arc<AppState>>,
    query: Result<Query<RevisionQuery>, QueryRejection>,
) -> Result<Json<RevisionText>, ApiError> {
    let Query(query) = query?;
    let workspace = app.workspace()?;
    let mode = app.config.read().unwrap().history.unwrap_or_default();
    let (path, id) = (query.path.clone(), query.id);
    let content = tokio::task::spawn_blocking(move || {
        let history = history::open_root(mode, &workspace, &app.state_dir)?;
        document::revision(&workspace.dir, history.as_ref(), &path, &id)
    })
    .await?;
    content
        .map(|content| Json(RevisionText { content }))
        .map_err(|error| file_error(&query.path, error))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RenderRequest {
    path: String,
    content: String,
}

#[derive(Serialize)]
struct Rendered {
    html: String,
}

async fn render(
    body: Result<Json<RenderRequest>, JsonRejection>,
) -> Result<Json<Rendered>, ApiError> {
    let Json(request) = body?;
    let path = request.path.clone();
    let html =
        tokio::task::spawn_blocking(move || document::preview(&path, &request.content)).await?;
    html.map(|html| Json(Rendered { html }))
        .map_err(|error| file_error(&request.path, error))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct SaveRequest {
    content: String,
}

async fn save(
    State(app): State<Arc<AppState>>,
    query: Result<Query<FileQuery>, QueryRejection>,
    headers: HeaderMap,
    body: Result<Json<SaveRequest>, JsonRejection>,
) -> Result<impl IntoResponse, ApiError> {
    let Query(query) = query?;
    let Json(request) = body?;
    let base_version = if_match(&headers)?;
    let workspace = app.workspace()?;
    let mode = app.config.read().unwrap().history.unwrap_or_default();
    let keep = app.config.read().unwrap().snapshots_per_file();
    let path = query.path.clone();
    let saved = tokio::task::spawn_blocking(move || {
        document::save(
            &workspace.dir,
            || history::root(mode, &workspace, &app.state_dir),
            keep,
            &path,
            &request.content,
            &base_version,
        )
    })
    .await?;
    let saved = saved.map_err(|error| save_error(&query.path, error))?;
    Ok(([(header::ETAG, etag(&saved.version))], Json(saved)))
}

fn save_error(path: &str, error: SaveError) -> ApiError {
    match error {
        SaveError::Changed => ApiError::PreconditionFailed(format!("{path}: {error}")),
        SaveError::Snapshot(_) => ApiError::Internal(format!("{path}: {error}")),
        SaveError::Io(error) => file_error(path, error),
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RestoreRequest {
    path: String,
    id: String,
}

async fn restore(
    State(app): State<Arc<AppState>>,
    body: Result<Json<RestoreRequest>, JsonRejection>,
) -> Result<impl IntoResponse, ApiError> {
    let Json(request) = body?;
    let workspace = app.workspace()?;
    let mode = app.config.read().unwrap().history.unwrap_or_default();
    let keep = app.config.read().unwrap().snapshots_per_file();
    let (path, id) = (request.path.clone(), request.id);
    let restored = tokio::task::spawn_blocking(move || {
        let history = history::open_root(mode, &workspace, &app.state_dir)?;
        document::restore(&workspace.dir, history.as_ref(), keep, &path, &id)
    })
    .await?;
    let restored = restored.map_err(|error| save_error(&request.path, error))?;
    Ok(([(header::ETAG, etag(&restored.version))], Json(restored)))
}

/// The version that a save's `If-Match` names. Any other form than one
/// strong `ETag`, such as `*` or a list on one line or several, names no
/// version, so the save is refused as stale.
fn if_match(headers: &HeaderMap) -> Result<String, ApiError> {
    let mut values = headers.get_all(header::IF_MATCH).iter();
    let value = values.next().ok_or_else(|| {
        ApiError::PreconditionRequired("a save needs an If-Match header".to_owned())
    })?;
    if values.next().is_some() {
        return Ok(String::new());
    }
    let version = value
        .to_str()
        .ok()
        .and_then(|tag| tag.strip_prefix('"')?.strip_suffix('"'));
    Ok(version.unwrap_or_default().to_owned())
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct CreateRequest {
    path: String,
}

async fn create(
    State(app): State<Arc<AppState>>,
    body: Result<Json<CreateRequest>, JsonRejection>,
) -> Result<impl IntoResponse, ApiError> {
    let Json(request) = body?;
    let workspace = app.workspace()?;
    let path = request.path.clone();
    let created =
        tokio::task::spawn_blocking(move || document::create(&workspace.dir, &path)).await?;
    let created = created.map_err(|error| match error.kind() {
        io::ErrorKind::AlreadyExists => {
            ApiError::Conflict(format!("{}: the file exists", request.path))
        }
        io::ErrorKind::Unsupported => {
            ApiError::BadRequest(format!("{}: {}", request.path, io_message(&error)))
        }
        // The OS does not say which part of the path is missing.
        io::ErrorKind::NotFound | io::ErrorKind::NotADirectory => {
            match request.path.rsplit_once('/') {
                Some((folder, _)) => ApiError::NotFound(format!("{folder}: no such folder")),
                None => file_error(&request.path, error),
            }
        }
        _ => file_error(&request.path, error),
    })?;
    Ok((
        StatusCode::CREATED,
        [(header::ETAG, etag(&created.version))],
        Json(created),
    ))
}

fn file_error(path: &str, error: io::Error) -> ApiError {
    let message = format!("{path}: {}", io_message(&error));
    match error.kind() {
        // A folder of the path that is now a file.
        io::ErrorKind::NotFound | io::ErrorKind::NotADirectory => ApiError::NotFound(message),
        io::ErrorKind::Unsupported => ApiError::NotViewable(message),
        io::ErrorKind::FileTooLarge => ApiError::TooLarge(message),
        // cap-std refuses `..`, absolute paths and links out with no OS
        // error code; an OS error is a file mdame may not read.
        io::ErrorKind::PermissionDenied if error.raw_os_error().is_none() => {
            ApiError::Forbidden("path outside the workspace")
        }
        io::ErrorKind::PermissionDenied => ApiError::Forbidden("no permission to open this file"),
        _ => ApiError::Internal(message),
    }
}

/// A sandboxed document gets an opaque origin: an SVG's script cannot call
/// the API, since the guard refuses `Origin: null`, and gets no cookie.
const RAW_CSP: &str =
    "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'";

async fn raw(
    State(app): State<Arc<AppState>>,
    Path(path): Path<String>,
) -> Result<Response, ApiError> {
    let workspace = app.workspace()?;
    let relative = path.clone();
    let (bytes, content_type) =
        tokio::task::spawn_blocking(move || document::raw(&workspace.dir, &relative))
            .await?
            .map_err(|error| file_error(&path, error))?;
    let headers = [
        (header::CONTENT_TYPE, content_type),
        (header::CONTENT_SECURITY_POLICY, RAW_CSP),
    ];
    Ok((headers, bytes).into_response())
}

pub fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route("/", get(page))
        .route("/view/{*path}", get(page))
        .route("/edit/{*path}", get(page))
        .route("/assets/{*path}", get(asset))
        .route("/raw/{*path}", get(raw))
        .route("/api/state", get(state))
        .route("/api/settings", put(settings))
        .route("/api/workspace", post(open_workspace))
        .route("/api/complete", get(complete))
        .route("/api/recents", get(recents))
        .route("/api/tree", get(tree))
        .route(
            "/api/file",
            // JSON escapes can make the body much longer than the content.
            get(file)
                .put(save)
                .post(create)
                .layer(DefaultBodyLimit::max(4 * EDIT_LIMIT as usize)),
        )
        .route("/api/source", get(source))
        .route("/api/history", get(revisions))
        .route("/api/history/view", get(revision))
        .route("/api/history/restore", post(restore))
        .route(
            "/api/render",
            post(render).layer(DefaultBodyLimit::max(4 * EDIT_LIMIT as usize)),
        )
        .route("/ws", get(ws::handler))
        .layer(middleware::from_fn_with_state(app_state.clone(), guard))
        .layer(middleware::from_fn(security_headers))
        .with_state(app_state)
}
