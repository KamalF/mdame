mod common;

use std::sync::RwLock;

use common::{local, send};
use mdame::app::AppState;
use mdame::config::{Config, HistoryMode};
use serde_json::Value;

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
