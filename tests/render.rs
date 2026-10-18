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
    insta::assert_snapshot!(render::markdown(&fixture("gfm.md")));
}

#[test]
fn footnotes_and_in_page_links() {
    insta::assert_snapshot!(render::markdown(&fixture("links.md")));
}

#[test]
fn alerts() {
    insta::assert_snapshot!(render::markdown(&fixture("alerts.md")));
}

#[test]
fn yaml_front_matter_is_hidden() {
    insta::assert_snapshot!(render::markdown(&fixture("front-matter-yaml.md")));
}

#[test]
fn toml_front_matter_is_hidden() {
    insta::assert_snapshot!(render::markdown(&fixture("front-matter-toml.md")));
}
