use std::borrow::Cow;

use comrak::{Options, markdown_to_html};

/// Markdown to HTML, with the extensions that the spec lists. Raw HTML
/// passes through: the sanitizer decides what stays.
pub fn markdown(text: &str) -> String {
    markdown_to_html(&blank_toml_front_matter(text), &options())
}

fn options() -> Options<'static> {
    let mut options = Options::default();
    let extension = &mut options.extension;
    extension.table = true;
    extension.strikethrough = true;
    extension.autolink = true;
    extension.tasklist = true;
    extension.footnotes = true;
    extension.alerts = true;
    extension.front_matter_delimiter = Some("---".to_owned());
    // An empty prefix keeps the ids that table-of-contents links expect.
    extension.header_id_prefix = Some(String::new());
    options.render.r#unsafe = true;
    options.render.sourcepos = true;
    options
}

/// comrak knows one front matter delimiter, so a leading `+++` block is
/// replaced here. Blank lines, not nothing: the line numbers in
/// `data-sourcepos` must still match the file for scroll sync.
fn blank_toml_front_matter(text: &str) -> Cow<'_, str> {
    let mut end = 0;
    for (index, line) in text.split_inclusive('\n').enumerate() {
        end += line.len();
        let fence = line.trim_end() == "+++";
        if index == 0 && !fence {
            break;
        }
        if index > 0 && fence {
            return Cow::Owned("\n".repeat(index + 1) + &text[end..]);
        }
    }
    // No closing `+++`: the block is not front matter.
    Cow::Borrowed(text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn toml_front_matter_becomes_blank_lines() {
        let text = "+++\ntitle = \"A\"\n+++\n# A\n";
        assert_eq!(blank_toml_front_matter(text), "\n\n\n# A\n");
    }

    #[test]
    fn text_without_toml_front_matter_is_kept() {
        for text in ["", "# A\n", "+++\nnot closed\n", "a\n+++\nb\n+++\n"] {
            assert!(
                matches!(blank_toml_front_matter(text), Cow::Borrowed(_)),
                "{text:?}"
            );
        }
    }

    #[test]
    fn front_matter_keeps_the_line_numbers() {
        for fence in ["+++", "---"] {
            let html = markdown(&format!("{fence}\ntitle: A\n{fence}\n# A\n"));
            assert!(html.contains("data-sourcepos=\"4:1-4:3\""), "{html}");
        }
    }
}
