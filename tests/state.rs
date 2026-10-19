mod common;

use std::fs;
use std::sync::{Arc, RwLock};

use axum::body::Body;
use axum::http::{Method, Request, StatusCode};
use common::{local, send};
use mdame::app::AppState;
use mdame::config::{self, Config, HistoryMode, Recents};
use mdame::server::router;
use mdame::watch::Event;
use serde_json::Value;
use tower::ServiceExt;

async fn get_state(state: AppState) -> Value {
    get_json(state, "/api/state").await
}

async fn get_json(state: AppState, uri: &str) -> Value {
    let response = send(state, uri, &[("host", "127.0.0.1:4891")]).await;
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    serde_json::from_slice(&bytes).unwrap()
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

async fn put(state: AppState, content_type: &str, body: &str) -> (StatusCode, Value) {
    send_body(state, Method::PUT, "/api/settings", content_type, body).await
}

async fn send_body(
    state: AppState,
    method: Method,
    uri: &str,
    content_type: &str,
    body: &str,
) -> (StatusCode, Value) {
    let request = Request::builder()
        .method(method)
        .uri(uri)
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

#[tokio::test]
async fn open_workspace_shows_in_state_and_recents() {
    let dir = tempfile::tempdir().unwrap();
    let file = dir.path().join("a.md");
    fs::write(&file, "").unwrap();
    let recents_path = dir.path().join("state/recents.toml");
    let state = AppState {
        recents_path: recents_path.clone(),
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
        recents_path: recents_path.clone(),
        ..local()
    };

    state.open_workspace(dir.path()).unwrap();

    let recents: Recents = config::load(&recents_path).unwrap();
    assert_eq!(recents.entries.len(), 1);
}

async fn open(state: AppState, path: &str) -> (StatusCode, Value) {
    let body = serde_json::json!({ "path": path }).to_string();
    send_body(state, Method::POST, "/api/workspace", JSON, &body).await
}

#[tokio::test]
async fn picker_opens_a_folder() {
    let dir = tempfile::tempdir().unwrap();
    let state = AppState {
        recents_path: dir.path().join("recents.toml"),
        ..local()
    };
    let mut events = state.events.subscribe();
    let (status, body) = open(state, dir.path().to_str().unwrap()).await;
    assert_eq!(status, StatusCode::OK);
    let root = dir.path().canonicalize().unwrap();
    assert_eq!(body["workspace"]["root"], root.display().to_string());
    let root = root.display().to_string();
    assert_eq!(events.try_recv().unwrap(), Event::Workspace { root });
}

#[tokio::test]
async fn second_open_is_a_conflict() {
    let dir = tempfile::tempdir().unwrap();
    let state = AppState {
        recents_path: dir.path().join("recents.toml"),
        ..local()
    };
    state.open_workspace(dir.path()).unwrap();

    let (status, body) = open(state, dir.path().to_str().unwrap()).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["error"]["code"], "conflict");
}

#[tokio::test]
async fn missing_or_relative_path_is_refused() {
    let dir = tempfile::tempdir().unwrap();
    let missing = dir.path().join("missing");
    let cases = [
        (missing.to_str().unwrap(), StatusCode::NOT_FOUND),
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
        recents_path,
        ..local()
    };

    let body = get_json(state, "/api/recents").await;
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
        recents_path,
        ..local()
    };

    assert_eq!(get_json(state, "/api/recents").await, serde_json::json!([]));
}

#[tokio::test]
async fn state_gives_the_home_folder() {
    let home = std::env::home_dir().unwrap();
    let body = get_state(local()).await;
    assert_eq!(body["home"], home.display().to_string());
}
