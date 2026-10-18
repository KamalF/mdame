use std::borrow::Cow;

use ammonia::{Builder, Url, UrlRelative, UrlRelativeEvaluate};
use comrak::{Options, markdown_to_html};

/// Only used to resolve relative URLs; it never leaves `render.rs`.
const ORIGIN: &str = "http://mdame.invalid";

/// Markdown to sanitized HTML, with the extensions that the spec lists.
/// `path` is the file's workspace-relative path: relative URLs resolve
/// against its folder.
pub fn markdown(path: &str, text: &str) -> String {
    let html = markdown_to_html(&blank_toml_front_matter(text), &options());
    sanitizer(RawUrls::new(path)).clean(&html).to_string()
}

/// Turns a relative URL into a `/raw/…` path from the workspace root.
/// `/x` means the workspace root, as on GitHub, and `..` stops at the root.
struct RawUrls {
    folder: Url,
}

impl RawUrls {
    fn new(path: &str) -> Self {
        let folder = path.rsplit_once('/').map_or("", |(folder, _)| folder);
        let mut url = Url::parse(ORIGIN).expect("ORIGIN is a valid URL");
        // `set_path` escapes spaces, `?` and `#`, but not `%`.
        url.set_path(&format!("{}/", folder.replace('%', "%25")));
        Self { folder: url }
    }
}

impl UrlRelativeEvaluate<'static> for RawUrls {
    fn evaluate<'u>(&self, url: &'u str) -> Option<Cow<'u, str>> {
        if url.starts_with('#') {
            return Some(Cow::Borrowed(url));
        }
        let resolved = self.folder.join(url).ok()?;
        match resolved.as_str().strip_prefix(ORIGIN) {
            Some(rest) => Some(Cow::Owned(format!("/raw{rest}"))),
            // `//host/x` names another host.
            None => Some(Cow::Borrowed(url)),
        }
    }
}

/// The ammonia defaults, widened for what comrak writes.
fn sanitizer(raw_urls: RawUrls) -> Builder<'static> {
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
        .link_rel(None)
        .url_relative(UrlRelative::Custom(Box::new(raw_urls)));
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

    fn raw(path: &str, url: &str) -> Option<String> {
        RawUrls::new(path).evaluate(url).map(Cow::into_owned)
    }

    #[test]
    fn relative_urls_resolve_against_the_folder() {
        let cases = [
            ("a.md", "b.png", "/raw/b.png"),
            ("docs/a.md", "b.png", "/raw/docs/b.png"),
            ("docs/a.md", "./img/b.png", "/raw/docs/img/b.png"),
            ("docs/deep/a.md", "../b.md#usage", "/raw/docs/b.md#usage"),
            ("docs/a.md", "/b.png", "/raw/b.png"),
            ("docs/a.md", "../../../b.png", "/raw/b.png"),
            ("docs/a.md", "b.png?v=2", "/raw/docs/b.png?v=2"),
            ("docs/a.md", "my%20b.png", "/raw/docs/my%20b.png"),
            ("my docs/a.md", "b.png", "/raw/my%20docs/b.png"),
            ("100%/a.md", "b.png", "/raw/100%25/b.png"),
            ("a#1?/a.md", "b.png", "/raw/a%231%3F/b.png"),
        ];
        for (path, url, expected) in cases {
            assert_eq!(raw(path, url).as_deref(), Some(expected), "{path} {url}");
        }
    }

    #[test]
    fn fragments_and_other_hosts_are_kept() {
        for url in ["#install", "#fn-1", "//example.com/b.png"] {
            assert_eq!(raw("docs/a.md", url).as_deref(), Some(url));
        }
    }

    #[test]
    fn front_matter_keeps_the_line_numbers() {
        for fence in ["+++", "---"] {
            let html = markdown("a.md", &format!("{fence}\ntitle: A\n{fence}\n# A\n"));
            assert!(html.contains("data-sourcepos=\"4:1-4:3\""), "{html}");
        }
    }
}
