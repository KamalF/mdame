use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;

use crate::server;

const PORT: u16 = 4891;

pub struct AppState {
    pub addr: SocketAddr,
    pub workspace: Option<String>,
}

pub async fn run() -> Result<(), Box<dyn std::error::Error>> {
    let listener = TcpListener::bind(("127.0.0.1", PORT)).await?;
    let app_state = AppState {
        addr: listener.local_addr()?,
        workspace: None,
    };
    let state: Arc<AppState> = Arc::new(app_state);

    println!("mdame on http://{}", state.addr);
    axum::serve(listener, server::router(state)).await?;
    Ok(())
}
