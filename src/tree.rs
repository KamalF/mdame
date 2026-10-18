use std::fs;
use std::path::Path;

use serde::Serialize;

use crate::workspace::expand_home;

const MAX_SUGGESTIONS: usize = 50;

#[derive(Debug, PartialEq, Serialize)]
pub struct Suggestion {
    /// The prefix as typed, completed with the entry's name.
    pub path: String,
    pub dir: bool,
}

/// Entries of the folder that `prefix` names, whose name starts with the
/// text after its last `/`. Hidden entries show once that text starts with
/// a dot.
pub fn complete(prefix: &str, home: Option<&Path>) -> Vec<Suggestion> {
    let Some(slash) = prefix.rfind('/') else {
        return Vec::new();
    };
    let (typed_dir, partial) = prefix.split_at(slash + 1);
    let dir = expand_home(typed_dir, home);
    if dir.is_relative() {
        return Vec::new();
    }
    let Ok(entries) = fs::read_dir(&dir) else {
        return Vec::new();
    };

    let partial_lower = partial.to_lowercase();
    let mut suggestions: Vec<Suggestion> = entries
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let name = entry.file_name().into_string().ok()?;
            let shown = !name.starts_with('.') || partial.starts_with('.');
            if !shown || !name.to_lowercase().starts_with(&partial_lower) {
                return None;
            }
            // file_type needs no extra syscall, but does not follow links:
            // a link to a folder must still complete as a folder.
            let file_type = entry.file_type().ok()?;
            let dir = file_type.is_dir() || (file_type.is_symlink() && entry.path().is_dir());
            let slash = if dir { "/" } else { "" };
            Some(Suggestion {
                path: format!("{typed_dir}{name}{slash}"),
                dir,
            })
        })
        .collect();
    suggestions.sort_by(|a, b| b.dir.cmp(&a.dir).then_with(|| a.path.cmp(&b.path)));
    suggestions.truncate(MAX_SUGGESTIONS);
    suggestions
}

#[cfg(test)]
mod tests {
    use super::*;

    fn home() -> tempfile::TempDir {
        let home = tempfile::tempdir().unwrap();
        for dir in ["notes", "Archive", ".config"] {
            fs::create_dir(home.path().join(dir)).unwrap();
        }
        for file in ["notes.md", "todo.md", ".hidden.md"] {
            fs::write(home.path().join(file), "").unwrap();
        }
        home
    }

    fn paths(prefix: &str, home: &Path) -> Vec<String> {
        complete(prefix, Some(home))
            .into_iter()
            .map(|suggestion| suggestion.path)
            .collect()
    }

    #[test]
    fn folders_first_with_a_slash() {
        let home = home();
        assert_eq!(
            paths("~/", home.path()),
            ["~/Archive/", "~/notes/", "~/notes.md", "~/todo.md"]
        );
    }

    #[test]
    fn matches_the_last_part_in_any_case() {
        let home = home();
        assert_eq!(paths("~/NO", home.path()), ["~/notes/", "~/notes.md"]);
        assert_eq!(paths("~/a", home.path()), ["~/Archive/"]);
    }

    #[test]
    fn hidden_entries_need_a_dot() {
        let home = home();
        assert_eq!(paths("~/.", home.path()), ["~/.config/", "~/.hidden.md"]);
    }

    #[test]
    fn keeps_an_absolute_prefix_as_typed() {
        let home = home();
        let prefix = format!("{}/t", home.path().display());
        let expected = format!("{}/todo.md", home.path().display());
        assert_eq!(paths(&prefix, home.path()), [expected]);
    }

    #[test]
    fn link_to_a_folder_completes_as_a_folder() {
        let home = home();
        std::os::unix::fs::symlink(home.path().join("notes"), home.path().join("link")).unwrap();
        assert_eq!(paths("~/li", home.path()), ["~/link/"]);
    }

    #[test]
    fn nothing_for_relative_empty_or_missing() {
        let home = home();
        for prefix in ["", "~", "notes/", "~/missing/", "~/todo.md/"] {
            assert_eq!(paths(prefix, home.path()), Vec::<String>::new(), "{prefix}");
        }
    }
}
