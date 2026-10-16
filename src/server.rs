use crate::app::AppState;
use axum::{Json, Router, extract::State, routing::get};
use serde::Serialize;
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

pub fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route("/", get(|| async { "hello" }))
        .route("/api/state", get(state))
        .with_state(app_state)
}
