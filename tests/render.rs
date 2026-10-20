use std::fs;

use mdame::render::{self, Family};

fn fixture(name: &str) -> String {
    fs::read_to_string(format!(
        "{}/tests/fixtures/{name}",
        env!("CARGO_MANIFEST_DIR")
    ))
    .unwrap()
}

fn markdown(name: &str) -> String {
    render::file(Family::Markdown, name, &fixture(name))
}

#[test]
fn gfm() {
    insta::assert_snapshot!(markdown("gfm.md"));
}

#[test]
fn footnotes_and_in_page_links() {
    insta::assert_snapshot!(markdown("links.md"));
}

#[test]
fn alerts() {
    insta::assert_snapshot!(markdown("alerts.md"));
}

#[test]
fn hostile_html_is_inert() {
    let html = markdown("hostile.md");
    // The snapshot alone could be accepted with a hole in it.
    let lower = html.to_lowercase();
    for tag in [
        "<script", "<iframe", "<object", "<embed", "<style", "<form", "<svg", "<math", "<base",
        "<meta", "<link",
    ] {
        assert!(!lower.contains(tag), "{tag} in {html}");
    }
    for attribute in ["style=", "javascript:", "data:"] {
        assert!(!lower.contains(attribute), "{attribute} in {html}");
    }
    let handler = lower.match_indices(" on").any(|(at, _)| {
        let rest = &lower[at + 3..];
        let name = rest.trim_start_matches(|c: char| c.is_ascii_alphabetic());
        name.len() < rest.len() && name.starts_with('=')
    });
    assert!(!handler, "event handler in {html}");
    insta::assert_snapshot!(html);
}

#[test]
fn relative_urls_point_to_raw() {
    let text = fixture("relative-urls.md");
    insta::assert_snapshot!(render::file(Family::Markdown, "notes/today.md", &text));
}

#[test]
fn data_and_text_are_escaped_code() {
    let json = render::file(Family::Data, "data.JSON", &fixture("data.json"));
    let text = render::file(Family::Text, "notes.txt", "a < b & \"c\"\n");
    insta::assert_snapshot!(format!("{json}\n{text}"));
}

#[test]
fn mermaid_is_escaped() {
    insta::assert_snapshot!(render::file(
        Family::Diagram,
        "flow.mmd",
        &fixture("flow.mmd")
    ));
}

#[test]
fn csv_is_a_table() {
    insta::assert_snapshot!(render::file(Family::Table, "t.csv", &fixture("table.csv")));
}

#[test]
fn image_points_to_raw() {
    let html = render::file(Family::Image, "img/a b#1%.png", "");
    assert_eq!(
        html,
        r#"<img src="/raw/img/a%20b%231%25.png" alt="a b#1%.png">"#
    );
}
