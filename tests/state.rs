mod common;

use std::fs;
use std::sync::RwLock;

use axum::http::{Method, StatusCode};
use common::{HOST, JSON, get_json, local, send_body, status_and_json};
use mdame::app::AppState;
use mdame::config::{self, Config, HistoryMode, Recents};
use mdame::watch::Event;
use serde_json::Value;

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
async fn open_workspace_shows_in_state_and_recents() {
    let dir = tempfile::tempdir().unwrap();
    let file = dir.path().join("a.md");
    fs::write(&file, "").unwrap();
    let recents_path = dir.path().join("state/recents.toml");
    let state = AppState {
        state_dir: dir.path().join("state"),
        ..local()
    };

    state.open_workspace(&file).unwrap();

    let recents: Recents = config::load(&recents_path).unwrap();
    assert_eq!(recents.entries[0].path, file.canonicalize().unwrap());
    let body = get_state(state).await;
    let root = dir.path().canonicalize().unwrap();
    assert_eq!(body["workspace"]["root"], root.display().to_string());
    assert_eq!(body["workspace"]["start"], "a.md");
}

#[tokio::test]
async fn unreadable_recents_do_not_stop_the_open() {
    let dir = tempfile::tempdir().unwrap();
    let recents_path = dir.path().join("recents.toml");
    fs::write(&recents_path, "not toml [").unwrap();
    let state = AppState {
        state_dir: dir.path().to_path_buf(),
        ..local()
    };

    state.open_workspace(dir.path()).unwrap();

    let recents: Recents = config::load(&recents_path).unwrap();
    assert_eq!(recents.entries.len(), 1);
}

async fn open(state: AppState, path: &str) -> (StatusCode, Value) {
    let body = serde_json::json!({ "path": path }).to_string();
    let response = send_body(state, Method::POST, "/api/workspace", &[HOST, JSON], &body).await;
    status_and_json(response).await
}

#[tokio::test]
async fn picker_opens_a_folder() {
    let dir = tempfile::tempdir().unwrap();
    let state = AppState {
        state_dir: dir.path().to_path_buf(),
        ..local()
    };
    let mut events = state.events.subscribe();
    let (status, body) = open(state, dir.path().to_str().unwrap()).await;
    assert_eq!(status, StatusCode::OK);
    let root = dir.path().canonicalize().unwrap().display().to_string();
    assert_eq!(body["workspace"]["root"], root);
    assert_eq!(events.try_recv().unwrap(), Event::Workspace { root });
}

#[tokio::test]
async fn second_open_is_a_conflict() {
    let dir = tempfile::tempdir().unwrap();
    let state = AppState {
        state_dir: dir.path().to_path_buf(),
        ..local()
    };
    state.open_workspace(dir.path()).unwrap();

    let (status, body) = open(state, dir.path().to_str().unwrap()).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["error"]["code"], "conflict");
}

#[tokio::test]
async fn missing_relative_or_impossible_path_is_refused() {
    let dir = tempfile::tempdir().unwrap();
    let missing = dir.path().join("missing");
    fs::write(dir.path().join("a.md"), "").unwrap();
    let through_file = dir.path().join("a.md/notes");
    let cases = [
        (missing.to_str().unwrap(), StatusCode::NOT_FOUND),
        (through_file.to_str().unwrap(), StatusCode::BAD_REQUEST),
        ("notes", StatusCode::BAD_REQUEST),
    ];
    for (path, expected) in cases {
        let (status, body) = open(local(), path).await;
        assert_eq!(status, expected, "{path}");
        let message = body["error"]["message"].as_str().unwrap();
        assert!(!message.contains("os error"), "{message}");
    }
}

#[tokio::test]
async fn recents_newest_first() {
    let dir = tempfile::tempdir().unwrap();
    let recents_path = dir.path().join("recents.toml");
    let text = r#"
        [[recent]]
        path = "/b"
        last_opened_secs = 2

        [[recent]]
        path = "/a"
        last_opened_secs = 1
    "#;
    fs::write(&recents_path, text).unwrap();
    let state = AppState {
        state_dir: dir.path().to_path_buf(),
        ..local()
    };

    let body = get_json(state, "/api/recents").await.1;
    assert_eq!(
        body,
        serde_json::json!([
            { "path": "/b", "last_opened_secs": 2 },
            { "path": "/a", "last_opened_secs": 1 },
        ])
    );
}

#[tokio::test]
async fn unreadable_recents_are_an_empty_list() {
    let dir = tempfile::tempdir().unwrap();
    let recents_path = dir.path().join("recents.toml");
    fs::write(&recents_path, "not toml [").unwrap();
    let state = AppState {
        state_dir: dir.path().to_path_buf(),
        ..local()
    };

    assert_eq!(
        get_json(state, "/api/recents").await.1,
        serde_json::json!([])
    );
}

#[tokio::test]
async fn state_gives_the_home_folder() {
    let home = std::env::home_dir().unwrap();
    let body = get_state(local()).await;
    assert_eq!(body["home"], home.display().to_string());
}
