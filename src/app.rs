use std::fs::{self, OpenOptions};
use std::io::{self, ErrorKind, Write};
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, PoisonError};
use std::time::{Duration, Instant};

use clap::Parser;
use tokio::net::TcpListener;
use tokio::sync::broadcast;

use crate::config::{self, Config};
use crate::error::io_message;
use crate::server;
use crate::watch::{self, EVENT_CAPACITY, Event};
use crate::workspace::Workspace;

const PORT_ATTEMPTS: usize = 10;

/// The browser uses the code of the URL that mdame opens at once.
pub const OPENED_CODE_LIFE: Duration = Duration::from_secs(60);
/// A person may open the URL that mdame prints later.
pub const PRINTED_CODE_LIFE: Duration = Duration::from_secs(600);

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

    /// Print the URL and open no browser
    #[arg(long)]
    pub no_open: bool,

    /// Folder or file to open
    #[arg(default_value = ".")]
    pub path: PathBuf,
}

/// Stands for the token in a URL that mdame opens or prints, once and for
/// a short time: other accounts can read a browser's command line with
/// `ps`, and a click on a printed URL may start one.
pub struct OpenCode {
    pub code: String,
    pub made: Instant,
    pub life: Duration,
    /// A code leaves the address once used: a second use is a theft.
    pub used: bool,
}

impl OpenCode {
    pub fn new(code: String, life: Duration) -> OpenCode {
        OpenCode {
            code,
            made: Instant::now(),
            life,
            used: false,
        }
    }
}

/// The token and its codes, under one lock: a theft replaces the token
/// while requests check it.
#[derive(Default)]
pub struct Access {
    /// Every request must carry it. `None` turns the check off: tests of
    /// other rules use that.
    pub token: Option<String>,
    pub open_codes: Vec<OpenCode>,
}

pub struct AppState {
    pub addr: SocketAddr,
    pub workspace: Workspace,
    pub access: Mutex<Access>,
    /// Where the token is kept, on loopback: a new one goes there too.
    pub token_file: Option<PathBuf>,
    pub config: Config,
    pub themes_dir: PathBuf,
    pub events: broadcast::Sender<Event>,
}

impl AppState {
    /// Whether `token` is still the current one: a theft replaces it.
    pub fn is_current(&self, token: Option<&str>) -> bool {
        let access = self.access.lock().unwrap_or_else(PoisonError::into_inner);
        access.token.as_deref() == token
    }
}

/// Opens `path` and watches it. Without the watcher, mdame still serves the
/// files, with no live updates.
pub fn open_workspace(path: &Path, events: broadcast::Sender<Event>) -> io::Result<Workspace> {
    let mut workspace = Workspace::open(path)?;
    match watch::start(&workspace.root, events) {
        Ok(watcher) => workspace.watcher = Some(watcher),
        Err(error) => tracing::warn!("live updates are off: {error}"),
    }
    Ok(workspace)
}

pub async fn run(args: Args) -> Result<(), Box<dyn std::error::Error>> {
    let config_dir = config::config_dir().ok_or("set HOME or XDG_CONFIG_HOME: no home folder")?;
    let config = config::load(&config_dir.join("config.toml"))?;
    let state_dir = config::state_dir().ok_or("set HOME or XDG_STATE_HOME: no home folder")?;
    let listener = bind_first_free(args.host, args.port, PORT_ATTEMPTS).await?;
    let addr = listener.local_addr()?;
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
    let events = broadcast::channel(EVENT_CAPACITY).0;
    let workspace = open_workspace(&args.path, events.clone())
        .map_err(|error| format!("{}: {}", args.path.display(), io_message(&error)))?;
    // After the open: the watcher's first walk of a large folder can take
    // longer than a code lives.
    let (opened, printed) = (new_token()?, new_token()?);
    let state = Arc::new(AppState {
        addr,
        workspace,
        // Every field named: a lost token line must not compile.
        access: Mutex::new(Access {
            token: Some(token.clone()),
            open_codes: vec![
                OpenCode::new(opened.clone(), OPENED_CODE_LIFE),
                OpenCode::new(printed.clone(), PRINTED_CODE_LIFE),
            ],
        }),
        token_file,
        config,
        themes_dir: config_dir.join("themes"),
        events,
    });

    print_urls(addr, &printed, &token);
    let linux = cfg!(target_os = "linux");
    if args.no_open {
        // The printed URL is enough.
    } else if has_display(linux, |name| std::env::var_os(name).is_some()) {
        if let Err(error) = open::that_detached(code_url(addr, &opened)) {
            tracing::warn!("could not open the browser: {error}");
        }
    } else {
        tracing::info!("no display: open the URL above in a browser");
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

/// Without a display, as over SSH, no browser comes: the opened code would
/// only wait on a command line that other accounts can read. Only Linux
/// tells it by these variables.
fn has_display(linux: bool, is_set: impl Fn(&str) -> bool) -> bool {
    !linux || is_set("DISPLAY") || is_set("WAYLAND_DISPLAY")
}

/// The URL with an open code, for the browser on this machine.
fn code_url(addr: SocketAddr, code: &str) -> String {
    format!("http://{}/?c={code}", browser_addr(addr))
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

/// Prints the URLs of mdame, at start and after a theft. Not println: a
/// closed stdout must not stop the server.
pub(crate) fn print_urls(addr: SocketAddr, code: &str, token: &str) {
    let mut out = io::stdout();
    let _ = writeln!(out, "mdame on {}", printed_url(addr, code, token));
    if let Some(url) = other_devices_url(addr, token) {
        let _ = writeln!(out, "on another device: {url}");
    }
}

/// The URL that mdame prints. Where this machine can use it, it carries a
/// one-time code: a click on the URL in a terminal may put it on a command
/// line. Otherwise other devices need the token itself.
fn printed_url(addr: SocketAddr, code: &str, token: &str) -> String {
    if addr.ip().is_loopback() || addr.ip().is_unspecified() {
        code_url(addr, code)
    } else {
        format!("http://{addr}/?t={token}")
    }
}

/// On 0.0.0.0 and ::, which name no address that another device can use,
/// the URL for other devices. It names no host, so that no click puts the
/// token on a command line.
fn other_devices_url(addr: SocketAddr, token: &str) -> Option<String> {
    let port = addr.port();
    addr.ip()
        .is_unspecified()
        .then(|| format!("http://<this machine>:{port}/?t={token}"))
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
    match write_token(path, &token, |temp, path| fs::hard_link(temp, path)) {
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

/// Writes `token` in full under another name, then `place`s it at `path`:
/// another start, or the next one after a power cut, never reads a partial
/// file.
pub(crate) fn write_token(
    path: &Path,
    token: &str,
    place: fn(&Path, &Path) -> io::Result<()>,
) -> io::Result<()> {
    // A random name, not the token: others may list the folder.
    let temp = path.with_extension(new_token().map_err(io::Error::other)?);
    let written = OpenOptions::new()
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
        .and_then(|()| place(&temp, path));
    let _ = fs::remove_file(&temp);
    written
}

pub(crate) fn new_token() -> Result<String, getrandom::Error> {
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
    fn a_new_token_replaces_the_kept_one() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("token");
        kept_token(dir.path(), &path).unwrap();

        let token = new_token().unwrap();
        write_token(&path, &token, |temp, path| fs::rename(temp, path)).unwrap();
        assert_eq!(kept_token(dir.path(), &path).unwrap(), token);
        let mode = fs::metadata(&path).unwrap().permissions().mode();
        assert_eq!(mode & 0o777, 0o600);
    }

    #[test]
    fn the_opened_url_has_a_code_and_goes_through_loopback() {
        let cases = [
            ("127.0.0.1:4891", "http://127.0.0.1:4891/?c=x"),
            ("0.0.0.0:4891", "http://127.0.0.1:4891/?c=x"),
            ("[::]:4891", "http://[::1]:4891/?c=x"),
            ("192.168.1.5:4891", "http://192.168.1.5:4891/?c=x"),
        ];
        for (bound, expected) in cases {
            let bound: SocketAddr = bound.parse().unwrap();
            assert_eq!(code_url(bound, "x"), expected, "{bound}");
        }
    }

    #[test]
    fn the_printed_url_has_a_code_where_this_machine_uses_it() {
        let cases = [
            ("127.0.0.1:4891", "http://127.0.0.1:4891/?c=code"),
            ("[::1]:4891", "http://[::1]:4891/?c=code"),
            ("0.0.0.0:4891", "http://127.0.0.1:4891/?c=code"),
            ("192.168.1.5:4891", "http://192.168.1.5:4891/?t=token"),
        ];
        for (bound, expected) in cases {
            let bound: SocketAddr = bound.parse().unwrap();
            let printed = printed_url(bound, "code", "token");
            assert_eq!(printed, expected, "{bound}");
        }
    }

    #[test]
    fn other_devices_get_the_token_where_the_address_names_no_device() {
        let cases = [
            ("0.0.0.0:4891", Some("http://<this machine>:4891/?t=token")),
            ("[::]:4891", Some("http://<this machine>:4891/?t=token")),
            ("127.0.0.1:4891", None),
            ("192.168.1.5:4891", None),
        ];
        for (bound, expected) in cases {
            let bound: SocketAddr = bound.parse().unwrap();
            let url = other_devices_url(bound, "token");
            assert_eq!(url.as_deref(), expected, "{bound}");
        }
    }

    #[test]
    fn a_browser_opens_only_with_a_display_on_linux() {
        let cases = [
            (true, &[][..], false),
            (true, &["DISPLAY"][..], true),
            (true, &["WAYLAND_DISPLAY"][..], true),
            (false, &[][..], true),
        ];
        for (linux, set, expected) in cases {
            let display = has_display(linux, |name| set.contains(&name));
            assert_eq!(display, expected, "linux {linux}, {set:?}");
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
