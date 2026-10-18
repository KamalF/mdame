use std::fs;

use mdame::render;

fn fixture(name: &str) -> String {
    fs::read_to_string(format!(
        "{}/tests/fixtures/{name}",
        env!("CARGO_MANIFEST_DIR")
    ))
    .unwrap()
}

#[test]
fn gfm() {
    insta::assert_snapshot!(render::markdown("gfm.md", &fixture("gfm.md")));
}

#[test]
fn footnotes_and_in_page_links() {
    insta::assert_snapshot!(render::markdown("links.md", &fixture("links.md")));
}

#[test]
fn alerts() {
    insta::assert_snapshot!(render::markdown("alerts.md", &fixture("alerts.md")));
}

#[test]
fn yaml_front_matter_is_hidden() {
    insta::assert_snapshot!(render::markdown(
        "front-matter-yaml.md",
        &fixture("front-matter-yaml.md")
    ));
}

#[test]
fn toml_front_matter_is_hidden() {
    insta::assert_snapshot!(render::markdown(
        "front-matter-toml.md",
        &fixture("front-matter-toml.md")
    ));
}

#[test]
fn hostile_html_is_inert() {
    insta::assert_snapshot!(render::markdown("hostile.md", &fixture("hostile.md")));
}

#[test]
fn relative_urls_point_to_raw() {
    let text = fixture("relative-urls.md");
    insta::assert_snapshot!(render::markdown("notes/today.md", &text));
}
