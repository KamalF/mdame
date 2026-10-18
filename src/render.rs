use std::borrow::Cow;

use ammonia::Builder;
use comrak::{Options, markdown_to_html};

/// Markdown to sanitized HTML, with the extensions that the spec lists.
pub fn markdown(text: &str) -> String {
    let html = markdown_to_html(&blank_toml_front_matter(text), &options());
    sanitizer().clean(&html).to_string()
}

/// The ammonia defaults, widened for what comrak writes.
fn sanitizer() -> Builder<'static> {
    let mut builder = Builder::default();
    builder
        .add_generic_attributes(["class", "id", "aria-label", "data-sourcepos"])
        .add_tag_attributes("a", ["data-footnote-ref", "data-footnote-backref"])
        .add_tag_attributes("a", ["data-footnote-backref-idx", "data-heading-content"])
        .add_tags(["section"])
        .add_tag_attributes("section", ["data-footnotes"])
        // Task lists. Any other input becomes a checkbox too.
        .add_tags(["input"])
        .add_tag_attributes("input", ["checked", "disabled"])
        .set_tag_attribute_value("input", "type", "checkbox")
        // No `target` is allowed, and the page sends `Referrer-Policy:
        // no-referrer`, so `rel="noopener noreferrer"` adds nothing.
        .link_rel(None);
    builder
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
