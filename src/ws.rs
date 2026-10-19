use std::sync::Arc;

use axum::extract::State;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::response::Response;
use tokio::sync::broadcast::{Receiver, error::RecvError};

use crate::app::AppState;
use crate::watch::Event;

/// Subscribes before the upgrade, so that no event is lost while the
/// connection opens.
pub async fn handler(State(app): State<Arc<AppState>>, upgrade: WebSocketUpgrade) -> Response {
    let events = app.events.subscribe();
    upgrade.on_upgrade(move |socket| forward(socket, events))
}

async fn forward(mut socket: WebSocket, mut events: Receiver<Event>) {
    loop {
        tokio::select! {
            event = events.recv() => {
                let event = match event {
                    Ok(event) => event,
                    // Events were dropped for this tab: it must refetch.
                    Err(RecvError::Lagged(_)) => Event::Resync,
                    Err(RecvError::Closed) => return,
                };
                let json = serde_json::to_string(&event).expect("events serialize");
                if socket.send(Message::text(json)).await.is_err() {
                    return;
                }
            }
            // The page sends nothing; reading notices a closed tab at once
            // instead of at the next event.
            message = socket.recv() => match message {
                Some(Ok(Message::Close(_)) | Err(_)) | None => return,
                Some(Ok(_)) => {}
            },
        }
    }
}
