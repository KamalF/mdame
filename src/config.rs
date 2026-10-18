use std::ffi::OsString;
use std::fs::{self, File};
use std::io::{self, ErrorKind, Write};
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

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HistoryMode {
    Workspace,
    State,
}

#[derive(Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct Recents {
    #[serde(default, rename = "recent")]
    pub entries: Vec<Recent>,
}

const MAX_RECENTS: usize = 25;

impl Recents {
    pub fn add(&mut self, path: PathBuf, now_secs: u64) {
        self.entries.retain(|entry| entry.path != path);
        self.entries.insert(
            0,
            Recent {
                path,
                last_opened_secs: now_secs,
            },
        );
        self.entries.truncate(MAX_RECENTS);
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Recent {
    pub path: PathBuf,
    pub last_opened_secs: u64,
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

pub fn state_dir() -> Option<PathBuf> {
    app_dir(
        std::env::var_os("XDG_STATE_HOME"),
        std::env::home_dir(),
        ".local/state",
    )
}

pub fn recents_file() -> Option<PathBuf> {
    Some(state_dir()?.join("recents.toml"))
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
    fn missing_file_is_the_default() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("missing.toml");
        assert_eq!(load::<Config>(&path).unwrap(), Config::default());
        assert_eq!(load::<Recents>(&path).unwrap(), Recents::default());
    }

    #[test]
    fn reads_config_and_recents() {
        let dir = tempfile::tempdir().unwrap();
        let config_path = dir.path().join("config.toml");
        fs::write(&config_path, "theme = \"dark\"\nhistory = \"state\"\n").unwrap();
        let recents_path = dir.path().join("recents.toml");
        let recents_text = r#"
            [[recent]]
            path = "/Users/me/notes"
            last_opened_secs = 1771273728
        "#;
        fs::write(&recents_path, recents_text).unwrap();

        let config: Config = load(&config_path).unwrap();
        assert_eq!(config.theme.as_deref(), Some("dark"));
        assert_eq!(config.history, Some(HistoryMode::State));
        assert_eq!(config.snapshots_per_file, None);
        let recents: Recents = load(&recents_path).unwrap();
        assert_eq!(
            recents.entries,
            [Recent {
                path: "/Users/me/notes".into(),
                last_opened_secs: 1771273728,
            }]
        );
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

        let recents_path = dir.path().join("state/mdame/recents.toml");
        let recents = Recents {
            entries: vec![Recent {
                path: "/tmp/a.md".into(),
                last_opened_secs: 1,
            }],
        };
        save(&recents, &recents_path).unwrap();
        assert_eq!(load::<Recents>(&recents_path).unwrap(), recents);

        let names: Vec<_> = fs::read_dir(config_path.parent().unwrap())
            .unwrap()
            .map(|entry| entry.unwrap().file_name())
            .collect();
        assert_eq!(names, ["config.toml"], "no temporary file left");
    }

    fn paths(recents: &Recents) -> Vec<&str> {
        recents
            .entries
            .iter()
            .map(|entry| entry.path.to_str().unwrap())
            .collect()
    }

    #[test]
    fn add_puts_the_path_first() {
        let mut recents = Recents::default();
        recents.add("/a".into(), 1);
        recents.add("/b.md".into(), 2);
        assert_eq!(paths(&recents), ["/b.md", "/a"]);
    }

    #[test]
    fn add_again_moves_the_path_first_with_the_new_time() {
        let mut recents = Recents::default();
        recents.add("/a".into(), 1);
        recents.add("/b".into(), 2);
        recents.add("/a".into(), 3);
        assert_eq!(paths(&recents), ["/a", "/b"]);
        assert_eq!(recents.entries[0].last_opened_secs, 3);
    }

    #[test]
    fn add_keeps_the_newest_25() {
        let mut recents = Recents::default();
        for i in 0..30 {
            recents.add(format!("/{i}").into(), i);
        }
        assert_eq!(recents.entries.len(), 25);
        assert_eq!(recents.entries[0].path, PathBuf::from("/29"));
        assert_eq!(recents.entries[24].path, PathBuf::from("/5"));
    }

    #[test]
    fn path_that_is_not_utf8_is_an_error() {
        use std::os::unix::ffi::OsStrExt;
        let dir = tempfile::tempdir().unwrap();
        let recents = Recents {
            entries: vec![Recent {
                path: std::ffi::OsStr::from_bytes(b"/a\xff").into(),
                last_opened_secs: 1,
            }],
        };

        let error = save(&recents, &dir.path().join("recents.toml")).unwrap_err();
        assert!(matches!(error, ConfigError::Serialize { .. }));
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
