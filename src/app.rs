use std::io::{self, ErrorKind};
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};

use clap::Parser;
use tokio::net::TcpListener;
use tokio::sync::{Semaphore, broadcast};

use crate::config::{self, Config, Recents};
use crate::error::{ApiError, io_message};
use crate::server;
use crate::watch::{self, EVENT_CAPACITY, Event};
use crate::workspace::Workspace;

const PORT_ATTEMPTS: usize = 10;

pub const RENDER_SLOTS: usize = 2;

#[derive(Parser)]
#[command(version)]
pub struct Args {
    /// Port to listen on; if it is in use, the next free one is taken
    #[arg(short, long, default_value_t = 4891)]
    pub port: u16,

    /// Address to listen on; any other than loopback needs the token printed in the URL
    #[arg(short = 'H', long, default_value = "127.0.0.1")]
    pub host: IpAddr,

    /// Show debug logs
    #[arg(short, long)]
    pub verbose: bool,

    /// Folder or file to open; without it, mdame starts at the picker
    pub path: Option<PathBuf>,
}

#[derive(Debug, thiserror::Error)]
pub enum OpenError {
    #[error("a workspace is already open")]
    AlreadyOpen,
    #[error("{}", io_message(.0))]
    Io(#[from] io::Error),
}

pub struct AppState {
    pub addr: SocketAddr,
    pub workspace: RwLock<Option<Arc<Workspace>>>,
    /// Set when bound beyond loopback; every request must then carry it.
    pub token: Option<String>,
    pub config: RwLock<Config>,
    pub config_path: PathBuf,
    pub recents_path: PathBuf,
    /// Render slots: a crafted file can take minutes to render, and a page
    /// can ask for many such renders at once.
    pub renders: Arc<Semaphore>,
    pub events: broadcast::Sender<Event>,
}

impl AppState {
    /// Clones the `Arc` out, so the lock is released before any `.await`.
    pub fn workspace(&self) -> Result<Arc<Workspace>, ApiError> {
        let workspace = self.workspace.read().unwrap().clone();
        workspace.ok_or_else(|| ApiError::Conflict("no workspace is open".to_owned()))
    }

    /// The check and the store share one write lock, so two tabs that open
    /// a workspace at the same time cannot both succeed.
    pub fn open_workspace(&self, path: &Path) -> Result<(), OpenError> {
        let mut slot = self.workspace.write().unwrap();
        if slot.is_some() {
            return Err(OpenError::AlreadyOpen);
        }
        let mut workspace = Workspace::open(path)?;
        match watch::start(&workspace.root, self.events.clone()) {
            Ok(watcher) => workspace.watcher = Some(watcher),
            Err(error) => tracing::warn!("live updates are off: {error}"),
        }
        let opened = workspace.path();
        *slot = Some(Arc::new(workspace));
        drop(slot);
        self.remember(opened);
        Ok(())
    }

    /// Recents are a convenience: a file that cannot be read or saved only
    /// gives a warning.
    pub fn recents(&self) -> Recents {
        config::load(&self.recents_path).unwrap_or_else(|error| {
            tracing::warn!("recents ignored: {error}");
            Recents::default()
        })
    }

    fn remember(&self, path: PathBuf) {
        let mut recents = self.recents();
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("the clock is after 1970")
            .as_secs();
        recents.add(path, now);
        if let Err(error) = config::save(&recents, &self.recents_path) {
            tracing::warn!("could not save the recents: {error}");
        }
    }
}

pub async fn run(args: Args) -> Result<(), Box<dyn std::error::Error>> {
    let config_path = config::config_file().ok_or("set HOME or XDG_CONFIG_HOME: no home folder")?;
    let config = config::load(&config_path)?;
    let recents_path =
        config::recents_file().ok_or("set HOME or XDG_STATE_HOME: no home folder")?;
    let listener = bind_first_free(args.host, args.port, PORT_ATTEMPTS).await?;
    let token = if args.host.is_loopback() {
        None
    } else {
        Some(new_token()?)
    };
    let app_state = AppState {
        addr: listener.local_addr()?,
        workspace: RwLock::new(None),
        token,
        config: RwLock::new(config),
        config_path,
        recents_path,
        renders: Arc::new(Semaphore::new(RENDER_SLOTS)),
        events: broadcast::channel(EVENT_CAPACITY).0,
    };
    if let Some(path) = &args.path {
        app_state
            .open_workspace(path)
            .map_err(|error| format!("{}: {error}", path.display()))?;
    }
    let state = Arc::new(app_state);

    let token = state.token.as_deref();
    println!("mdame on {}", page_url(state.addr, token));
    if let Err(error) = open::that_detached(page_url(browser_addr(state.addr), token)) {
        tracing::warn!("could not open the browser: {error}");
    }
    axum::serve(listener, server::router(state)).await?;
    Ok(())
}

async fn bind_first_free(ip: IpAddr, first: u16, attempts: usize) -> io::Result<TcpListener> {
    for port in (first..=u16::MAX).take(attempts) {
        match TcpListener::bind((ip, port)).await {
            Ok(listener) => return Ok(listener),
            Err(e) if e.kind() == ErrorKind::AddrInUse => continue,
            Err(e) => return Err(e),
        }
    }
    Err(io::Error::new(
        ErrorKind::AddrInUse,
        format!("no free port in the {attempts} ports from {first}"),
    ))
}

fn page_url(addr: SocketAddr, token: Option<&str>) -> String {
    match token {
        Some(token) => format!("http://{addr}/?t={token}"),
        None => format!("http://{addr}/"),
    }
}

/// 0.0.0.0 and :: are not addresses to connect to, and some browsers refuse
/// them, so the browser on this machine goes through loopback instead.
fn browser_addr(addr: SocketAddr) -> SocketAddr {
    let loopback: IpAddr = match addr.ip() {
        ip if !ip.is_unspecified() => return addr,
        IpAddr::V4(_) => Ipv4Addr::LOCALHOST.into(),
        IpAddr::V6(_) => Ipv6Addr::LOCALHOST.into(),
    };
    SocketAddr::new(loopback, addr.port())
}

fn new_token() -> Result<String, getrandom::Error> {
    let mut bytes = [0u8; 16];
    getrandom::fill(&mut bytes)?;
    Ok(hex(&bytes))
}

pub fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn page_url_carries_the_token() {
        let addr = "192.168.1.5:4891".parse().unwrap();
        assert_eq!(page_url(addr, None), "http://192.168.1.5:4891/");
        assert_eq!(
            page_url(addr, Some("abc")),
            "http://192.168.1.5:4891/?t=abc"
        );
    }

    #[test]
    fn browser_goes_through_loopback_when_bound_to_all_interfaces() {
        let cases = [
            ("0.0.0.0:4891", "127.0.0.1:4891"),
            ("[::]:4891", "[::1]:4891"),
            ("192.168.1.5:4891", "192.168.1.5:4891"),
        ];
        for (bound, expected) in cases {
            let bound: SocketAddr = bound.parse().unwrap();
            assert_eq!(browser_addr(bound).to_string(), expected);
        }
    }

    #[test]
    fn args_are_consistent() {
        use clap::CommandFactory;
        Args::command().debug_assert();
    }

    #[test]
    fn tokens_are_32_hex_digits_and_differ() {
        let first = new_token().unwrap();
        assert_eq!(first.len(), 32);
        assert!(first.bytes().all(|byte| byte.is_ascii_hexdigit()));
        assert_ne!(first, new_token().unwrap());
    }

    const LOCALHOST: IpAddr = IpAddr::V4(Ipv4Addr::LOCALHOST);

    /// Holds a port that the OS picked as free, so the test knows it is busy.
    async fn busy_port() -> (TcpListener, u16) {
        let listener = TcpListener::bind((LOCALHOST, 0)).await.unwrap();
        let port = listener.local_addr().unwrap().port();
        (listener, port)
    }

    #[tokio::test]
    async fn busy_port_falls_back_to_a_later_one() {
        let (_held, busy) = busy_port().await;
        let listener = bind_first_free(LOCALHOST, busy, 10).await.unwrap();
        let port = listener.local_addr().unwrap().port();
        assert!(port > busy && port < busy + 10, "got {port}, busy {busy}");
    }

    #[tokio::test]
    async fn all_ports_busy_is_an_error() {
        let (_held, busy) = busy_port().await;
        let error = bind_first_free(LOCALHOST, busy, 1).await.unwrap_err();
        assert_eq!(error.kind(), ErrorKind::AddrInUse);
    }
}
