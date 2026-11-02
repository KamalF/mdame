use std::ffi::OsString;
use std::fs::{self, File};
use std::io::{self, ErrorKind, Write};
use std::os::unix::fs::{DirBuilderExt, PermissionsExt};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize, de::DeserializeOwned};

use crate::error::io_message;

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Config {
    pub theme: Option<String>,
    pub snapshots_per_file: Option<usize>,
    /// `None` until the first-start dialog has asked.
    pub history: Option<HistoryMode>,
}

impl Config {
    pub fn snapshots_per_file(&self) -> usize {
        self.snapshots_per_file.unwrap_or(20)
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HistoryMode {
    #[default]
    Workspace,
    State,
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("{path}: {}", io_message(.source))]
    Io { path: PathBuf, source: io::Error },
    #[error("{path}: {source}")]
    Parse {
        path: PathBuf,
        source: toml::de::Error,
    },
    #[error("{path}: {source}")]
    Serialize {
        path: PathBuf,
        source: toml::ser::Error,
    },
}

/// A missing file gives the default value.
pub fn load<T: DeserializeOwned + Default>(path: &Path) -> Result<T, ConfigError> {
    let text = match fs::read_to_string(path) {
        Ok(text) => text,
        Err(e) if e.kind() == ErrorKind::NotFound => return Ok(T::default()),
        Err(source) => return Err(io_error(path, source)),
    };
    toml::from_str(&text).map_err(|source| ConfigError::Parse {
        path: path.to_owned(),
        source,
    })
}

/// Writes a temporary file, then renames it over `path`: a reader, or a
/// second mdame on the same file, never sees a half-written file.
pub fn save<T: Serialize>(value: &T, path: &Path) -> Result<(), ConfigError> {
    let text = toml::to_string(value).map_err(|source| ConfigError::Serialize {
        path: path.to_owned(),
        source,
    })?;
    // The pid keeps two mdame from writing the same temporary file.
    let mut tmp = path.as_os_str().to_owned();
    tmp.push(format!(".{}.tmp", std::process::id()));
    let tmp = PathBuf::from(tmp);

    let write = || -> io::Result<()> {
        if let Some(dir) = path.parent() {
            fs::create_dir_all(dir)?;
        }
        let mut file = File::create(&tmp)?;
        file.write_all(text.as_bytes())?;
        file.sync_all()?;
        fs::rename(&tmp, path)
    };
    write().map_err(|source| {
        let _ = fs::remove_file(&tmp);
        io_error(path, source)
    })
}

fn io_error(path: &Path, source: io::Error) -> ConfigError {
    ConfigError::Io {
        path: path.to_owned(),
        source,
    }
}

pub fn config_file() -> Option<PathBuf> {
    let dir = app_dir(
        std::env::var_os("XDG_CONFIG_HOME"),
        std::env::home_dir(),
        ".config",
    )?;
    Some(dir.join("config.toml"))
}

/// Makes `path` a folder that only the owner can list, even if it was not:
/// the history in `state` mode follows the workspace's file names.
pub fn private_folder(path: &Path) -> io::Result<()> {
    fs::DirBuilder::new()
        .recursive(true)
        .mode(0o700)
        .create(path)?;
    fs::set_permissions(path, fs::Permissions::from_mode(0o700))
}

pub fn state_dir() -> Option<PathBuf> {
    app_dir(
        std::env::var_os("XDG_STATE_HOME"),
        std::env::home_dir(),
        ".local/state",
    )
}

/// The XDG spec says to ignore a relative or empty value, and fall back.
fn app_dir(xdg: Option<OsString>, home: Option<PathBuf>, fallback: &str) -> Option<PathBuf> {
    let base = xdg
        .map(PathBuf::from)
        .filter(|dir| dir.is_absolute())
        .or_else(|| home.map(|home| home.join(fallback)))?;
    Some(base.join("mdame"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_state_folder_is_private_even_if_it_was_not() {
        let dir = tempfile::tempdir().unwrap();
        let state = dir.path().join("state/mdame");
        private_folder(&state).unwrap();
        fs::set_permissions(&state, fs::Permissions::from_mode(0o755)).unwrap();
        private_folder(&state).unwrap();

        let mode = fs::metadata(&state).unwrap().permissions().mode();
        assert_eq!(mode & 0o777, 0o700);
    }

    #[test]
    fn missing_file_is_the_default() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("missing.toml");
        assert_eq!(load::<Config>(&path).unwrap(), Config::default());
    }

    #[test]
    fn unreadable_file_is_an_error() {
        let dir = tempfile::tempdir().unwrap();
        assert!(load::<Config>(dir.path()).is_err());
    }

    #[test]
    fn reads_config() {
        let dir = tempfile::tempdir().unwrap();
        let config_path = dir.path().join("config.toml");
        fs::write(&config_path, "theme = \"dark\"\nhistory = \"state\"\n").unwrap();

        let config: Config = load(&config_path).unwrap();
        assert_eq!(config.theme.as_deref(), Some("dark"));
        assert_eq!(config.history, Some(HistoryMode::State));
        assert_eq!(config.snapshots_per_file, None);
    }

    #[test]
    fn save_then_load_gives_the_same_value() {
        let dir = tempfile::tempdir().unwrap();
        let config_path = dir.path().join("config/mdame/config.toml");
        let config = Config {
            theme: Some("light".into()),
            snapshots_per_file: Some(5),
            history: Some(HistoryMode::Workspace),
        };
        save(&config, &config_path).unwrap();
        assert_eq!(load::<Config>(&config_path).unwrap(), config);

        let names: Vec<_> = fs::read_dir(config_path.parent().unwrap())
            .unwrap()
            .map(|entry| entry.unwrap().file_name())
            .collect();
        assert_eq!(names, ["config.toml"], "no temporary file left");
    }

    #[test]
    fn unknown_config_key_is_an_error() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.toml");
        fs::write(&path, "snapshot_per_file = 5\n").unwrap();
        let error = load::<Config>(&path).unwrap_err();
        assert!(matches!(error, ConfigError::Parse { .. }));
    }

    #[test]
    fn bad_toml_names_the_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.toml");
        fs::write(&path, "history = 3").unwrap();
        let error = load::<Config>(&path).unwrap_err();
        assert!(matches!(error, ConfigError::Parse { .. }));
        assert!(error.to_string().starts_with(&path.display().to_string()));
    }

    #[test]
    fn xdg_dir_wins_unless_relative_or_empty() {
        let home = Some(PathBuf::from("/home/me"));
        let cases = [
            (Some("/xdg"), "/xdg/mdame"),
            (Some("relative"), "/home/me/.config/mdame"),
            (Some(""), "/home/me/.config/mdame"),
            (None, "/home/me/.config/mdame"),
        ];
        for (xdg, expected) in cases {
            let dir = app_dir(xdg.map(OsString::from), home.clone(), ".config");
            assert_eq!(dir, Some(PathBuf::from(expected)), "XDG value {xdg:?}");
        }
        assert_eq!(app_dir(None, None, ".config"), None);
    }
}
