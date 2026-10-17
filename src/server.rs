use crate::app::AppState;
use crate::error::ApiError;
use axum::{
    Json, Router,
    extract::{Request, State},
    http::header,
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

    Ok(next.run(req).await)
}

fn is_own_host(host: &str, addr: SocketAddr) -> bool {
    let port = addr.port();
    [
        format!("localhost:{port}"),
        format!("127.0.0.1:{port}"),
        format!("[::1]:{port}"),
        addr.to_string(),
    ]
    .contains(&host.to_string())
}

pub fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route("/", get(|| async { "hello" }))
        .route("/api/state", get(state))
        .layer(middleware::from_fn_with_state(app_state.clone(), guard))
        .with_state(app_state)
}
