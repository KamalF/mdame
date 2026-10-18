mod common;

use std::fs;
use std::sync::{Arc, RwLock};

use axum::{body::Body, http::Request, http::StatusCode};
use common::{local, send};
use mdame::app::AppState;
use mdame::config::{self, Config, HistoryMode};
use mdame::server::router;
use serde_json::Value;
use tower::ServiceExt;

async fn needs_setup(state: AppState) -> Value {
    let response = send(state, "/api/state", &[("host", "127.0.0.1:4891")]).await;
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let body: Value = serde_json::from_slice(&bytes).unwrap();
    body["needs_setup"].clone()
}

#[tokio::test]
async fn needs_setup_until_history_is_chosen() {
    assert_eq!(needs_setup(local()).await, true);

    let config = Config {
        history: Some(HistoryMode::State),
        ..Config::default()
    };
    let state = AppState {
        config: RwLock::new(config),
        ..local()
    };
    assert_eq!(needs_setup(state).await, false);
}

async fn put(state: AppState, content_type: &str, body: &str) -> (StatusCode, Value) {
    let request = Request::put("/api/settings")
        .header("host", "127.0.0.1:4891")
        .header("content-type", content_type)
        .body(Body::from(body.to_owned()))
        .unwrap();
    let response = router(Arc::new(state)).oneshot(request).await.unwrap();
    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    (status, serde_json::from_slice(&bytes).unwrap())
}

const JSON: &str = "application/json";

#[tokio::test]
async fn saves_history_and_returns_the_new_state() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("mdame/config.toml");
    let state = AppState {
        config_path: path.clone(),
        ..local()
    };

    let (status, body) = put(state, JSON, r#"{"history":"state"}"#).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["needs_setup"], false);
    let saved: Config = config::load(&path).unwrap();
    assert_eq!(saved.history, Some(HistoryMode::State));
}

#[tokio::test]
async fn keeps_the_other_settings() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("config.toml");
    fs::write(&path, "theme = \"dark\"\n").unwrap();
    let state = AppState {
        config: config::load::<Config>(&path).unwrap().into(),
        config_path: path.clone(),
        ..local()
    };

    let (status, _) = put(state, JSON, r#"{"history":"workspace"}"#).await;
    assert_eq!(status, StatusCode::OK);
    let saved: Config = config::load(&path).unwrap();
    assert_eq!(saved.theme.as_deref(), Some("dark"));
    assert_eq!(saved.history, Some(HistoryMode::Workspace));
}

#[tokio::test]
async fn refuses_what_is_not_a_known_json_setting() {
    let cases = [
        // The body type of a plain HTML form.
        ("application/x-www-form-urlencoded", "history=state"),
        (JSON, r#"{"history":"elsewhere"}"#),
        (JSON, r#"{"history":"state","theme":"dark"}"#),
        (JSON, "{}"),
    ];
    for (content_type, body) in cases {
        let (status, response) = put(local(), content_type, body).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{content_type} {body}");
        assert_eq!(response["error"]["code"], "bad_request");
    }
}

#[tokio::test]
async fn failed_save_is_an_internal_error() {
    let dir = tempfile::tempdir().unwrap();
    let file = dir.path().join("file");
    fs::write(&file, "").unwrap();
    let state = AppState {
        config_path: file.join("config.toml"),
        ..local()
    };

    let (status, body) = put(state, JSON, r#"{"history":"state"}"#).await;
    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
    assert_eq!(body["error"]["code"], "internal");
}
