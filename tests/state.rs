mod common;

use std::fs;
use std::sync::RwLock;

use axum::http::{Method, StatusCode};
use common::{HOST, JSON, get_json, local, send_body, status_and_json};
use mdame::app::AppState;
use mdame::config::{self, Config, HistoryMode};
use mdame::workspace::Workspace;
use serde_json::Value;
use tokio::sync::broadcast;

async fn get_state(state: AppState) -> Value {
    get_json(state, "/api/state").await.1
}

async fn needs_setup(state: AppState) -> Value {
    get_state(state).await["needs_setup"].clone()
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

async fn put(state: AppState, body: &str) -> (StatusCode, Value) {
    let response = send_body(state, Method::PUT, "/api/settings", &[HOST, JSON], body).await;
    status_and_json(response).await
}

#[tokio::test]
async fn saves_history_and_returns_the_new_state() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("mdame/config.toml");
    let state = AppState {
        config_path: path.clone(),
        ..local()
    };

    let (status, body) = put(state, r#"{"history":"state"}"#).await;
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

    let (status, _) = put(state, r#"{"history":"workspace"}"#).await;
    assert_eq!(status, StatusCode::OK);
    let saved: Config = config::load(&path).unwrap();
    assert_eq!(saved.theme.as_deref(), Some("dark"));
    assert_eq!(saved.history, Some(HistoryMode::Workspace));
}

#[tokio::test]
async fn refuses_what_is_not_a_known_json_setting() {
    for body in [
        r#"{"history":"elsewhere"}"#,
        r#"{"history":"state","theme":"dark"}"#,
        "{}",
    ] {
        let (status, response) = put(local(), body).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
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

    let (status, body) = put(state, r#"{"history":"state"}"#).await;
    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
    assert_eq!(body["error"]["code"], "internal");
}

#[tokio::test]
async fn state_gives_the_workspace_and_its_start_file() {
    let dir = tempfile::tempdir().unwrap();
    let file = dir.path().join("a.md");
    fs::write(&file, "").unwrap();
    let workspace = Workspace::open(&file).unwrap();
    let state = common::on(workspace, broadcast::channel(1).0);

    let body = get_state(state).await;
    let root = dir.path().canonicalize().unwrap();
    assert_eq!(body["workspace"]["root"], root.display().to_string());
    assert_eq!(body["workspace"]["start"], "a.md");
}
