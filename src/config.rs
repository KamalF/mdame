use std::ffi::OsString;
use std::fs;
use std::io::{self, ErrorKind};
use std::os::unix::fs::{DirBuilderExt, PermissionsExt};
use std::path::{Path, PathBuf};

use serde::Deserialize;

use crate::error::io_message;

#[derive(Debug, Default, PartialEq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Config {
    pub snapshots_per_file: Option<usize>,
}

impl Config {
    pub fn snapshots_per_file(&self) -> usize {
        self.snapshots_per_file.unwrap_or(20)
    }
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
}

/// A missing file gives the default config.
pub fn load(path: &Path) -> Result<Config, ConfigError> {
    let text = match fs::read_to_string(path) {
        Ok(text) => text,
        Err(e) if e.kind() == ErrorKind::NotFound => return Ok(Config::default()),
        Err(source) => {
            return Err(ConfigError::Io {
                path: path.to_owned(),
                source,
            });
        }
    };
    toml::from_str(&text).map_err(|source| ConfigError::Parse {
        path: path.to_owned(),
        source,
    })
}

pub fn config_file() -> Option<PathBuf> {
    let dir = app_dir(
        std::env::var_os("XDG_CONFIG_HOME"),
        std::env::home_dir(),
        ".config",
    )?;
    Some(dir.join("config.toml"))
}

/// Makes `path` a folder that only the owner can list, even if it was not.
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
        assert_eq!(load(&path).unwrap(), Config::default());
    }

    #[test]
    fn unreadable_file_is_an_error() {
        let dir = tempfile::tempdir().unwrap();
        assert!(load(dir.path()).is_err());
    }

    #[test]
    fn reads_config() {
        let dir = tempfile::tempdir().unwrap();
        let config_path = dir.path().join("config.toml");
        fs::write(&config_path, "snapshots_per_file = 5\n").unwrap();

        assert_eq!(load(&config_path).unwrap().snapshots_per_file, Some(5));
    }

    #[test]
    fn a_config_that_sets_theme_stops_mdame() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.toml");
        fs::write(&path, "theme = \"dark\"\n").unwrap();
        assert!(matches!(load(&path), Err(ConfigError::Parse { .. })));
    }

    #[test]
    fn unknown_config_key_is_an_error() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.toml");
        fs::write(&path, "snapshot_per_file = 5\n").unwrap();
        let error = load(&path).unwrap_err();
        assert!(matches!(error, ConfigError::Parse { .. }));
    }

    #[test]
    fn bad_toml_names_the_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.toml");
        fs::write(&path, "snapshots_per_file = \"many\"").unwrap();
        let error = load(&path).unwrap_err();
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
