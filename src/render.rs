use std::borrow::Cow;
use std::path::Path;

use ammonia::{Builder, Url, UrlRelative, UrlRelativeEvaluate};
use comrak::{Options, markdown_to_html};
use serde::Serialize;

/// How a file is shown. Files with no family stay out of the tree.
#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Family {
    Markdown,
    Text,
    Data,
    Table,
    Diagram,
    Image,
}

impl Family {
    pub fn of(path: &str) -> Option<Self> {
        let extension = extension(path)?;
        Some(match extension.as_str() {
            "md" | "markdown" => Self::Markdown,
            "txt" => Self::Text,
            "json" | "yaml" | "yml" | "toml" | "graphql" | "gql" => Self::Data,
            "csv" => Self::Table,
            "mmd" => Self::Diagram,
            _ if image_type(&extension).is_some() => Self::Image,
            _ => return None,
        })
    }
}

/// The type `/raw` serves a file with: images keep theirs, anything else is
/// plain text, so that no workspace file becomes a page on mdame's origin.
pub fn raw_type(path: &str) -> &'static str {
    extension(path)
        .and_then(|extension| image_type(&extension))
        .unwrap_or("text/plain; charset=utf-8")
}

fn image_type(extension: &str) -> Option<&'static str> {
    Some(match extension {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "webp" => "image/webp",
        _ => return None,
    })
}

fn extension(path: &str) -> Option<String> {
    Some(Path::new(path).extension()?.to_str()?.to_ascii_lowercase())
}

/// Only used to resolve relative URLs; it never leaves `render.rs`.
const ORIGIN: &str = "http://mdame.invalid";

/// The HTML for a file of the workspace. `path` is relative to the root.
/// An image is not read: its `text` is ignored.
pub fn file(family: Family, path: &str, text: &str) -> String {
    match family {
        Family::Markdown => markdown(path, text),
        Family::Text | Family::Data => format!(
            "<pre><code class=\"language-{}\">{}</code></pre>",
            escape(&extension(path).unwrap_or_default()),
            escape(text)
        ),
        Family::Table => table(text),
        Family::Diagram => format!("<pre class=\"mermaid\">{}</pre>", escape(text)),
        Family::Image => {
            let name = path.rsplit_once('/').map_or(path, |(_, name)| name);
            format!(
                "<img src=\"/raw{}\" alt=\"{}\">",
                workspace_url(path).path(),
                escape(name)
            )
        }
    }
}

/// Markdown to sanitized HTML, with the extensions that the spec lists.
/// Relative URLs resolve against the folder of `path`.
fn markdown(path: &str, text: &str) -> String {
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
        // `docs/a.md` gives `docs/`, with the slash that `join` needs.
        let folder = path.rfind('/').map_or("", |slash| &path[..=slash]);
        Self {
            folder: workspace_url(folder),
        }
    }
}

/// `path` under `ORIGIN`, each part percent-encoded.
fn workspace_url(path: &str) -> Url {
    let mut url = Url::parse(ORIGIN).expect("ORIGIN is a valid URL");
    url.path_segments_mut()
        .expect("ORIGIN can have a path")
        .clear()
        .extend(path.split('/'));
    url
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
        .add_tag_attributes(
            "a",
            [
                "data-footnote-ref",
                "data-footnote-backref",
                "data-footnote-backref-idx",
                "data-heading-content",
            ],
        )
        .add_tags(["section"])
        .add_tag_attributes("section", ["data-footnotes"])
        // Task lists. Any other input becomes a checkbox too.
        .add_tags(["input"])
        .add_tag_attributes("input", ["checked", "disabled"])
        .set_tag_attribute_value("input", "type", "checkbox")
        // No `target` is allowed, and the page sends `Referrer-Policy:
        // no-referrer`, so `rel="noopener noreferrer"` adds nothing.
        .link_rel(None)
        .url_relative(UrlRelative::Custom(Box::new(raw_urls)))
        .attribute_filter(no_app_names);
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

/// The first row is the header. Rows may have different lengths.
fn table(text: &str) -> String {
    let mut rows = csv::ReaderBuilder::new()
        .has_headers(false)
        .flexible(true)
        .from_reader(text.as_bytes())
        .into_records()
        .filter_map(Result::ok);
    let mut html = String::from("<table>\n");
    if let Some(header) = rows.next() {
        html += "<thead>\n";
        push_row(&mut html, "th", &header);
        html += "</thead>\n";
    }
    html += "<tbody>\n";
    for row in rows {
        push_row(&mut html, "td", &row);
    }
    html += "</tbody>\n</table>\n";
    html
}

fn push_row(html: &mut String, cell: &str, row: &csv::StringRecord) {
    *html += "<tr>";
    for field in row {
        *html += &format!("<{cell}>{}</{cell}>", escape(field));
    }
    *html += "</tr>\n";
}

fn escape(text: &str) -> String {
    let mut escaped = String::with_capacity(text.len());
    comrak::html::escape(&mut escaped, text).expect("writing to a String cannot fail");
    escaped
}

/// Drops the `mdame-` ids and classes that the app keeps for itself: a
/// heading "mdame content" would otherwise get the layout of
/// `#mdame-content`.
fn no_app_names<'u>(_element: &str, attribute: &str, value: &'u str) -> Option<Cow<'u, str>> {
    match attribute {
        "id" if value.starts_with("mdame-") => None,
        "class" if value.contains("mdame-") => Some(Cow::Owned(
            value
                .split_whitespace()
                .filter(|name| !name.starts_with("mdame-"))
                .collect::<Vec<_>>()
                .join(" "),
        )),
        _ => Some(Cow::Borrowed(value)),
    }
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
    fn app_ids_and_classes_are_dropped() {
        let html = markdown(
            "a.md",
            "## mdame content\n\n<div class=\"note mdame-backdrop\">x</div>\n",
        );
        assert!(!html.contains("id=\"mdame-"), "{html}");
        assert!(html.contains("class=\"note\""), "{html}");
    }

    #[test]
    fn family_from_the_extension() {
        assert_eq!(Family::of("README.MD"), Some(Family::Markdown));
        assert_eq!(Family::of("docs/data.yml"), Some(Family::Data));
        assert_eq!(Family::of("logo.svg"), Some(Family::Image));
        for path in ["Makefile", "a.rs", ".md", "md"] {
            assert_eq!(Family::of(path), None, "{path}");
        }
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
    fn front_matter_is_hidden_and_keeps_the_line_numbers() {
        for fence in ["+++", "---"] {
            let html = markdown("a.md", &format!("{fence}\ntitle: A\n{fence}\n# A\n"));
            assert!(!html.contains("title"), "{html}");
            assert!(html.contains("data-sourcepos=\"4:1-4:3\""), "{html}");
        }
    }
}
