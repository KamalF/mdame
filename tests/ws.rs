mod common;

use std::fs;
use std::sync::Arc;
use std::time::Duration;

use futures_util::StreamExt;
use mdame::app::AppState;
use mdame::server::router;
use mdame::watch::Event;
use tokio::net::{TcpListener, TcpStream};
use tokio::time::timeout;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream};

type Client = WebSocketStream<MaybeTlsStream<TcpStream>>;

/// Serves `state` on a free port; the `Arc` lets the test send events.
async fn serve(state: AppState) -> (Arc<AppState>, String) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let state = Arc::new(AppState { addr, ..state });
    tokio::spawn(axum::serve(listener, router(state.clone())).into_future());
    (state, format!("ws://{addr}/ws"))
}

async fn connect(url: &str) -> Client {
    tokio_tungstenite::connect_async(url).await.unwrap().0
}

async fn next_text(client: &mut Client) -> String {
    let message = timeout(Duration::from_secs(2), client.next()).await;
    match message.expect("a message within 2 s").unwrap().unwrap() {
        Message::Text(text) => text.to_string(),
        other => panic!("expected text, got {other:?}"),
    }
}

#[tokio::test]
async fn file_change_reaches_the_tab_with_a_relative_path() {
    let dir = tempfile::tempdir().unwrap();
    let (_state, url) = serve(common::workspace(dir.path(), &[("docs/a.md", b"# A\n")])).await;
    let mut client = connect(&url).await;

    fs::write(dir.path().join("ws/docs/a.md"), "# Changed\n").unwrap();
    assert_eq!(
        next_text(&mut client).await,
        r#"{"type":"changed","path":"docs/a.md"}"#
    );
}

/// A socket that a stolen token opened must not keep getting events.
#[tokio::test]
async fn a_new_token_closes_the_sockets_of_the_old_one() {
    let (state, url) = serve(common::local()).await;
    let mut client = connect(&url).await;

    state.access.lock().unwrap().token = Some("new".to_string());
    state.events.send(Event::Resync).unwrap();
    let message = timeout(Duration::from_secs(2), client.next()).await;
    let closed = match message.expect("an answer within 2 s") {
        None | Some(Err(_)) | Some(Ok(Message::Close(_))) => true,
        Some(Ok(_)) => false,
    };
    assert!(closed);
}

#[tokio::test]
async fn every_tab_gets_each_event() {
    let (state, url) = serve(common::local()).await;
    let mut first = connect(&url).await;
    let mut second = connect(&url).await;

    state.events.send(Event::Resync).unwrap();
    for client in [&mut first, &mut second] {
        assert_eq!(next_text(client).await, r#"{"type":"resync"}"#);
    }
}

#[tokio::test]
async fn lagging_tab_gets_resync() {
    let (state, url) = serve(common::local()).await;
    let mut client = connect(&url).await;

    // This test runs on one thread: the loop does not yield, so the
    // connection task cannot read until all events are sent.
    let changed = |i: usize| Event::Changed {
        path: format!("{i}.md"),
    };
    for i in 0..300 {
        state.events.send(changed(i)).unwrap();
    }
    assert_eq!(next_text(&mut client).await, r#"{"type":"resync"}"#);
    assert_eq!(
        next_text(&mut client).await,
        r#"{"type":"changed","path":"44.md"}"#
    );
}

#[tokio::test]
async fn closed_tab_unsubscribes() {
    let (state, url) = serve(common::local()).await;
    let client = connect(&url).await;
    assert_eq!(state.events.receiver_count(), 1);

    drop(client);
    timeout(Duration::from_secs(2), async {
        while state.events.receiver_count() > 0 {
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .expect("the receiver is dropped");
}
