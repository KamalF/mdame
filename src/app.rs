use std::fs::{self, OpenOptions};
use std::io::{self, ErrorKind, Write};
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};

use clap::Parser;
use tokio::net::TcpListener;
use tokio::sync::broadcast;

use crate::config::{self, Config, Recents};
use crate::error::{ApiError, io_message};
use crate::server;
use crate::watch::{self, EVENT_CAPACITY, Event};
use crate::workspace::Workspace;

const PORT_ATTEMPTS: usize = 10;

#[derive(Parser)]
#[command(version)]
pub struct Args {
    /// Port to listen on; if it is in use, the next free one is taken
    #[arg(short, long, default_value_t = 4891)]
    pub port: u16,

    /// Address to listen on
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
    /// Every request must carry it. `None` turns the check off: tests of
    /// other rules use that.
    pub token: Option<String>,
    pub config: RwLock<Config>,
    pub config_path: PathBuf,
    /// The recents, the token, and the history root in `state` mode are
    /// below it.
    pub state_dir: PathBuf,
    pub events: broadcast::Sender<Event>,
}

impl AppState {
    /// Clones the `Arc` out, so the lock is released before any `.await`.
    pub fn workspace(&self) -> Result<Arc<Workspace>, ApiError> {
        let workspace = self.workspace.read().unwrap().clone();
        workspace.ok_or_else(|| ApiError::Conflict("no workspace is open".to_owned()))
    }

    /// The watcher starts before the lock is taken: its first walk reads the
    /// whole folder, and every request waits for the lock. The store checks
    /// again, so two tabs that open a workspace at the same time cannot both
    /// succeed.
    pub fn open_workspace(&self, path: &Path) -> Result<(), OpenError> {
        if self.workspace.read().unwrap().is_some() {
            return Err(OpenError::AlreadyOpen);
        }
        let mut workspace = Workspace::open(path)?;
        match watch::start(&workspace.root, self.events.clone()) {
            Ok(watcher) => workspace.watcher = Some(watcher),
            Err(error) => tracing::warn!("live updates are off: {error}"),
        }
        let opened = workspace.path();
        let root = workspace.root.display().to_string();
        let mut slot = self.workspace.write().unwrap();
        if slot.is_some() {
            return Err(OpenError::AlreadyOpen);
        }
        *slot = Some(Arc::new(workspace));
        drop(slot);
        // Other tabs still show the picker. At start no tab is connected.
        let _ = self.events.send(Event::Workspace { root });
        self.remember(opened);
        Ok(())
    }

    /// Recents are a convenience: a file that cannot be read or saved only
    /// gives a warning.
    pub fn recents(&self) -> Recents {
        config::load(&self.recents_path()).unwrap_or_else(|error| {
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
        // Only the owner may list it.
        if let Err(error) = config::private_folder(&self.state_dir) {
            tracing::warn!(
                "recents not saved: {}: {}",
                self.state_dir.display(),
                io_message(&error)
            );
            return;
        }
        if let Err(error) = config::save(&recents, &self.recents_path()) {
            tracing::warn!("could not save the recents: {error}");
        }
    }

    fn recents_path(&self) -> PathBuf {
        self.state_dir.join("recents.toml")
    }
}

pub async fn run(args: Args) -> Result<(), Box<dyn std::error::Error>> {
    let config_path = config::config_file().ok_or("set HOME or XDG_CONFIG_HOME: no home folder")?;
    let config = config::load(&config_path)?;
    let state_dir = config::state_dir().ok_or("set HOME or XDG_STATE_HOME: no home folder")?;
    let listener = bind_first_free(args.host, args.port, PORT_ATTEMPTS).await?;
    // On loopback, the token is kept, so that tabs and bookmarks survive a
    // restart. Beyond, its URL goes to other devices: it lasts one run.
    let token_file = args.host.is_loopback().then(|| state_dir.join("token"));
    let kept = token_file.as_deref().and_then(|path| {
        kept_token(&state_dir, path)
            .inspect_err(|error| {
                let path = path.display();
                tracing::warn!("the token lasts one run: {path}: {}", io_message(error));
            })
            .ok()
    });
    let token = match kept {
        Some(token) => token,
        None => new_token()?,
    };
    let app_state = AppState {
        addr: listener.local_addr()?,
        workspace: RwLock::new(None),
        token: Some(token.clone()),
        config: RwLock::new(config),
        config_path,
        state_dir,
        events: broadcast::channel(EVENT_CAPACITY).0,
    };
    if let Some(path) = &args.path {
        app_state
            .open_workspace(path)
            .map_err(|error| format!("{}: {error}", path.display()))?;
    }
    let state = Arc::new(app_state);

    println!("mdame on {}", page_url(state.addr, &token));
    if let Err(error) = open::that_detached(page_url(browser_addr(state.addr), &token)) {
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

fn page_url(addr: SocketAddr, token: &str) -> String {
    format!("http://{addr}/?t={token}")
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

/// Loopback needs the token too: a program in a sandbox that shares the
/// network, such as a coding agent, could otherwise write any file through
/// mdame. The token is kept in `path`, which only the owner can read, so
/// that tabs keep their cookie when mdame restarts. Deleting the file locks
/// every browser out.
fn kept_token(state_dir: &Path, path: &Path) -> io::Result<String> {
    match fs::read_to_string(path) {
        Ok(_) if fs::metadata(path)?.permissions().mode() & 0o077 != 0 => {
            // Others may have read it already: only a new token is safe.
            return Err(io::Error::new(
                ErrorKind::PermissionDenied,
                "delete this file, then start mdame again: others can read it",
            ));
        }
        Ok(token) => return checked_token(token),
        Err(error) if error.kind() != ErrorKind::NotFound => return Err(error),
        Err(_) => {}
    }
    config::private_folder(state_dir)?;
    let token = new_token().map_err(io::Error::other)?;
    // Written in full under another name, then linked: another start, or
    // the next one after a power cut, never reads a partial file.
    // A random name, not the token: others may list the folder.
    let temp = path.with_extension(new_token().map_err(io::Error::other)?);
    let linked = OpenOptions::new()
        .write(true)
        .create_new(true)
        // 0600 from the start: a chmod after the write would leave a moment
        // when others can read it.
        .mode(0o600)
        .open(&temp)
        .and_then(|mut file| {
            file.write_all(token.as_bytes())?;
            file.sync_all()
        })
        .and_then(|()| fs::hard_link(&temp, path));
    let _ = fs::remove_file(&temp);
    match linked {
        Ok(()) => Ok(token),
        // Another start made it first.
        Err(error) if error.kind() == ErrorKind::AlreadyExists => {
            checked_token(fs::read_to_string(path)?)
        }
        Err(error) => Err(error),
    }
}

fn checked_token(token: String) -> io::Result<String> {
    if token.len() == 32 && token.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        Ok(token)
    } else {
        Err(io::Error::new(
            ErrorKind::InvalidData,
            "delete this file, then start mdame again: it holds no token",
        ))
    }
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
        assert_eq!(page_url(addr, "abc"), "http://192.168.1.5:4891/?t=abc");
    }

    #[test]
    fn the_token_is_kept_for_the_next_start() {
        let dir = tempfile::tempdir().unwrap();
        let state = dir.path().join("state");
        let path = state.join("token");
        let first = kept_token(&state, &path).unwrap();

        assert_eq!(kept_token(&state, &path).unwrap(), first);
        let mode = fs::metadata(&path).unwrap().permissions().mode();
        assert_eq!(mode & 0o777, 0o600);
        let mode = fs::metadata(&state).unwrap().permissions().mode();
        assert_eq!(mode & 0o777, 0o700);
    }

    #[test]
    fn two_starts_at_once_get_the_same_token() {
        for _ in 0..100 {
            let dir = tempfile::tempdir().unwrap();
            let path = dir.path().join("token");
            let barrier = std::sync::Barrier::new(2);
            let tokens = std::thread::scope(|scope| {
                let starts = [(); 2].map(|()| {
                    scope.spawn(|| {
                        barrier.wait();
                        kept_token(dir.path(), &path).unwrap()
                    })
                });
                starts.map(|start| start.join().unwrap())
            });
            assert_eq!(tokens[0], tokens[1]);
        }
    }

    #[test]
    fn a_token_file_that_others_can_read_is_refused() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("token");
        kept_token(dir.path(), &path).unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).unwrap();

        let error = kept_token(dir.path(), &path).unwrap_err();
        assert_eq!(error.kind(), ErrorKind::PermissionDenied);
    }

    #[test]
    fn a_token_file_with_no_token_is_refused() {
        let cases = ["", "secret", "0123456789abcdef0123456789abcdeg"];
        for content in cases {
            let dir = tempfile::tempdir().unwrap();
            let path = dir.path().join("token");
            fs::write(&path, content).unwrap();
            fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();

            let error = kept_token(dir.path(), &path).unwrap_err();
            assert_eq!(error.kind(), ErrorKind::InvalidData, "{content}");
        }
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
    async fn other_bind_error_stops_the_fallback() {
        // TEST-NET-1: no machine has this address.
        let foreign = IpAddr::V4(Ipv4Addr::new(192, 0, 2, 1));
        let error = bind_first_free(foreign, 4891, 10).await.unwrap_err();
        assert_eq!(error.kind(), ErrorKind::AddrNotAvailable);
    }

    #[tokio::test]
    async fn all_ports_busy_is_an_error() {
        let (_held, busy) = busy_port().await;
        let error = bind_first_free(LOCALHOST, busy, 1).await.unwrap_err();
        assert_eq!(error.kind(), ErrorKind::AddrInUse);
    }
}
