use serde::Serialize;

use crate::document;
use crate::render::Family;
use crate::tree::{self, Kind, Node};
use crate::workspace::Workspace;

const MAX_FILES: usize = 50;
const MAX_MATCHES: usize = 20;
/// Lines shown before and after each match.
const CONTEXT: usize = 2;
/// Longer lines are cut, in characters: a minified file can hold a line of
/// megabytes.
const MAX_LINE: usize = 200;
/// Characters kept before the first match of a line that is cut.
const BEFORE_MATCH: usize = 50;

#[derive(Debug, Serialize)]
pub struct Results {
    pub files: Vec<FileMatches>,
    /// More files match than `files` holds.
    pub more: bool,
}

#[derive(Debug, Serialize)]
pub struct FileMatches {
    pub path: String,
    pub modified: u64,
    /// The matching lines and the lines around them, in order. Where the
    /// numbers jump, lines were left out.
    pub lines: Vec<Line>,
    /// The file has more matches than `lines` holds.
    pub more: bool,
}

#[derive(Debug, PartialEq, Serialize)]
pub struct Line {
    /// From 1.
    pub number: usize,
    /// Cut to `MAX_LINE` characters around the first match, with `…` where
    /// text was left out.
    pub text: String,
    pub matched: bool,
}

/// The files that the tree shows and hold `phrase`, newest first. The case
/// counts only if `phrase` has an uppercase letter, as in `rg -S`.
pub fn search(workspace: &Workspace, phrase: &str) -> Results {
    let mut files = Vec::new();
    collect(tree::build(workspace), &mut files);
    files.sort_by(|a, b| {
        b.modified
            .cmp(&a.modified)
            .then_with(|| a.path.cmp(&b.path))
    });
    let mut results = Results {
        files: Vec::new(),
        more: false,
    };
    for file in files {
        if file.family == Some(Family::Image) {
            continue;
        }
        // Too large, not UTF-8, or gone since the walk.
        let Ok(text) = document::text(&workspace.dir, &file.path) else {
            continue;
        };
        let Some((lines, more)) = matching_lines(&text, phrase) else {
            continue;
        };
        if results.files.len() == MAX_FILES {
            results.more = true;
            break;
        }
        results.files.push(FileMatches {
            path: file.path,
            modified: file.modified,
            lines,
            more,
        });
    }
    results
}

fn collect(node: Node, files: &mut Vec<Node>) {
    match node.kind {
        Kind::File => files.push(node),
        Kind::Dir => {
            for child in node.children {
                collect(child, files);
            }
        }
    }
}

/// The first `MAX_MATCHES` lines of `text` that hold `phrase`, each with
/// `CONTEXT` lines around it, as `rg -S -m20 -C2` prints them: context
/// that overlaps is printed once. Also whether more lines match. `None`
/// when no line matches.
fn matching_lines(text: &str, phrase: &str) -> Option<(Vec<Line>, bool)> {
    let lowered = !phrase.chars().any(char::is_uppercase);
    let lowercase;
    let (haystack, needle) = if lowered {
        lowercase = text.to_lowercase();
        (lowercase.as_str(), phrase.to_lowercase())
    } else {
        (text, phrase.to_owned())
    };
    // Most files do not match: they are not split into lines.
    if !haystack.contains(&needle) {
        return None;
    }
    // Lowercasing keeps each line break, so the lines of `haystack` pair
    // with those of `text`.
    let mut hits: Vec<usize> = haystack
        .lines()
        .enumerate()
        .filter(|(_, line)| line.contains(&needle))
        .map(|(index, _)| index)
        .take(MAX_MATCHES + 1)
        .collect();
    if hits.is_empty() {
        return None;
    }
    let more = hits.len() > MAX_MATCHES;
    hits.truncate(MAX_MATCHES);
    let all: Vec<&str> = text.lines().collect();
    let searched: Vec<&str> = haystack.lines().collect();
    let mut lines = Vec::new();
    // The first line that is not printed yet.
    let mut next = 0;
    for &hit in &hits {
        let start = hit.saturating_sub(CONTEXT).max(next);
        let end = (hit + CONTEXT + 1).min(all.len());
        for (offset, text) in all[start..end].iter().enumerate() {
            let index = start + offset;
            let matched = hits.binary_search(&index).is_ok();
            let text = if text.len() > MAX_LINE {
                let at = if matched {
                    first_match(text, searched[index], &needle, lowered)
                } else {
                    0
                };
                cut(text, at)
            } else {
                (*text).to_owned()
            };
            lines.push(Line {
                number: index + 1,
                text,
                matched,
            });
        }
        next = end;
    }
    Some((lines, more))
}

/// The character of `line` where `needle` first appears in `searched`, the
/// line as searched. When `lowered`, `searched` is the lowercase of `line`,
/// and a letter can grow there: `İ` becomes `i̇`, two characters.
fn first_match(line: &str, searched: &str, needle: &str, lowered: bool) -> usize {
    let offset = searched.find(needle).unwrap_or(0);
    if !lowered {
        return line[..offset].chars().count();
    }
    let mut bytes = 0;
    line.chars()
        .take_while(|letter| {
            bytes += letter.to_lowercase().map(char::len_utf8).sum::<usize>();
            bytes <= offset
        })
        .count()
}

/// `line` cut to `MAX_LINE` characters around the character `at`, with `…`
/// where text was left out.
fn cut(line: &str, at: usize) -> String {
    let count = line.chars().count();
    if count <= MAX_LINE {
        return line.to_owned();
    }
    let start = at.saturating_sub(BEFORE_MATCH).min(count - MAX_LINE);
    let kept: String = line.chars().skip(start).take(MAX_LINE).collect();
    let before = if start > 0 { "…" } else { "" };
    let after = if start + MAX_LINE < count { "…" } else { "" };
    format!("{before}{kept}{after}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;
    use std::time::{Duration, UNIX_EPOCH};

    fn write(root: &Path, path: &str, text: &str, seconds: u64) {
        let path = root.join(path);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, text).unwrap();
        let file = fs::File::options().write(true).open(&path).unwrap();
        file.set_modified(UNIX_EPOCH + Duration::from_secs(seconds))
            .unwrap();
    }

    fn found(root: &Path, phrase: &str) -> Vec<String> {
        let workspace = Workspace::open(root).unwrap();
        search(&workspace, phrase)
            .files
            .into_iter()
            .map(|file| file.path)
            .collect()
    }

    fn line(number: usize, text: &str, matched: bool) -> Line {
        Line {
            number,
            text: text.to_owned(),
            matched,
        }
    }

    #[test]
    fn a_phrase_matches_in_any_case() {
        let root = crate::workspace::tempdir();
        write(root.path(), "a.md", "The Retry Budget\n", 1);
        write(root.path(), "b.md", "retry, then budget\n", 2);

        assert_eq!(found(root.path(), "retry budget"), ["a.md"]);
    }

    #[test]
    fn an_uppercase_letter_makes_the_case_count() {
        let root = crate::workspace::tempdir();
        write(root.path(), "a.md", "the retry\n", 1);
        write(root.path(), "b.md", "the Retry\n", 2);

        assert_eq!(found(root.path(), "Retry"), ["b.md"]);
    }

    #[test]
    fn search_reads_what_the_tree_shows() {
        let root = crate::workspace::tempdir();
        fs::write(root.path().join(".gitignore"), "drafts/\n").unwrap();
        write(root.path(), "drafts/a.md", "needle\n", 1);
        write(root.path(), ".claude/plans/b.md", "needle\n", 2);
        write(root.path(), ".claude/settings.json", "needle\n", 3);
        write(root.path(), ".git/c.md", "needle\n", 4);
        write(root.path(), "notes.txt", "needle\n", 5);

        assert_eq!(
            found(root.path(), "needle"),
            ["notes.txt", ".claude/plans/b.md"]
        );
    }

    #[test]
    fn images_and_files_over_1_mb_are_skipped() {
        let root = crate::workspace::tempdir();
        write(root.path(), "a.svg", "<svg><text>needle</text></svg>\n", 1);
        // The spec's limit, not the constant.
        let limit = 1024 * 1024;
        let at_limit = format!("needle\n{}", "a".repeat(limit - 7));
        write(root.path(), "limit.md", &at_limit, 2);
        write(root.path(), "big.md", &format!("{at_limit}a"), 3);

        assert_eq!(found(root.path(), "needle"), ["limit.md"]);
    }

    #[test]
    fn a_file_that_is_not_utf8_is_skipped() {
        let root = crate::workspace::tempdir();
        write(root.path(), "a.md", "needle\n", 1);
        fs::write(root.path().join("latin1.md"), b"needle caf\xe9\n").unwrap();

        assert_eq!(found(root.path(), "needle"), ["a.md"]);
    }

    #[test]
    fn newest_files_come_first() {
        let root = crate::workspace::tempdir();
        write(root.path(), "old.md", "needle\n", 1);
        write(root.path(), "new.md", "needle\n", 3);
        write(root.path(), "docs/middle.md", "needle\n", 2);

        assert_eq!(
            found(root.path(), "needle"),
            ["new.md", "docs/middle.md", "old.md"]
        );
    }

    #[test]
    fn results_stop_at_50_files_and_20_matches_per_file() {
        let root = crate::workspace::tempdir();
        let text = "needle\n".repeat(21);
        for index in 0..51 {
            write(root.path(), &format!("{index:02}.md"), &text, index);
        }
        let workspace = Workspace::open(root.path()).unwrap();
        let results = search(&workspace, "needle");

        assert_eq!(results.files.len(), 50);
        assert!(results.more);
        let lines = &results.files[0].lines;
        assert_eq!(lines.iter().filter(|line| line.matched).count(), 20);
        // The 21st line is printed as the context of the 20th.
        assert_eq!(lines.last().unwrap(), &line(21, "needle", false));
        assert!(results.files[0].more);
        let (_, more) = matching_lines(&"needle\n".repeat(20), "needle").unwrap();
        assert!(!more);

        fs::remove_file(root.path().join("00.md")).unwrap();
        assert!(!search(&workspace, "needle").more);
    }

    #[test]
    fn context_lines_are_merged_where_they_overlap() {
        let text = "1\n2\nneedle 3\n4\nneedle 5\n6\n7\n8\n9\n10\nneedle 11\n";
        let (lines, _) = matching_lines(text, "needle").unwrap();
        let numbers: Vec<usize> = lines.iter().map(|line| line.number).collect();

        assert_eq!(numbers, [1, 2, 3, 4, 5, 6, 7, 9, 10, 11]);
        assert_eq!(lines[2], line(3, "needle 3", true));
        assert_eq!(lines[3], line(4, "4", false));
    }

    #[test]
    fn a_long_line_is_cut_around_the_match() {
        let (a, b) = ("a".repeat(1000), "b".repeat(1000));
        let text = format!("{a}needle{b}\n{b}\n{a}needle\n");
        let (lines, _) = matching_lines(&text, "needle").unwrap();

        let after = MAX_LINE - BEFORE_MATCH - "needle".len();
        let around = format!("…{}needle{}…", &a[..BEFORE_MATCH], &b[..after]);
        assert_eq!(lines[0], line(1, &around, true));
        assert_eq!(lines[1], line(2, &format!("{}…", &b[..MAX_LINE]), false));
        let at_the_end = format!("…{}needle", &a[..MAX_LINE - "needle".len()]);
        assert_eq!(lines[2], line(3, &at_the_end, true));
    }

    #[test]
    fn a_cut_keeps_the_match_after_letters_that_lowercase_longer() {
        let dotted = "İ".repeat(1000);
        for phrase in ["needle", "Needle"] {
            let text = format!("{dotted}Needle{}", "b".repeat(1000));
            let (lines, _) = matching_lines(&text, phrase).unwrap();
            let start = format!("…{}Needle", "İ".repeat(BEFORE_MATCH));
            assert!(lines[0].text.starts_with(&start), "{phrase}");
        }
    }
}
