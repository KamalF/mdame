mod common;

use std::fs;
use std::path::Path;

use axum::http::StatusCode;
use common::get_json;
use mdame::app::AppState;
use serde_json::Value;

async fn get_file(state: AppState, path: &str) -> (StatusCode, Value) {
    get_json(state, &format!("/api/file?path={path}")).await
}

fn workspace(dir: &Path) -> AppState {
    common::workspace(dir, &[("docs/a.md", b"# Title\n")])
}

#[tokio::test]
async fn markdown_file_is_rendered() {
    let dir = common::tempdir();
    let (status, body) = get_file(workspace(dir.path()), "docs/a.md").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["family"], "markdown");
    assert_eq!(body["size"], 8);
    assert_eq!(body["too_large"], false);
    assert_eq!(body["editable"], true);
    assert!(body["modified"].as_u64().unwrap() > 0);
    assert!(
        body["html"]
            .as_str()
            .unwrap()
            .starts_with("<h1 id=\"title\"")
    );
}

#[tokio::test]
async fn file_returns_the_source_that_it_rendered() {
    let dir = common::tempdir();
    let files: [(&str, &[u8]); 2] = [("a.md", b"# A\n\ntext\n"), ("latin1.md", b"caf\xe9\n")];
    for (path, source) in [("a.md", "# A\n\ntext\n"), ("latin1.md", "caf\u{fffd}\n")] {
        let (status, body) = get_file(common::workspace(dir.path(), &files), path).await;
        assert_eq!(status, StatusCode::OK, "{path}");
        assert_eq!(body["source"], source, "{path}");
    }
}

#[tokio::test]
async fn an_image_and_a_large_file_have_no_source() {
    let dir = common::tempdir();
    workspace(dir.path());
    fs::write(dir.path().join("ws/a.png"), b"\x89PNG").unwrap();
    fs::write(dir.path().join("ws/big.md"), "a".repeat(1024 * 1024 + 1)).unwrap();
    for path in ["a.png", "big.md"] {
        let (status, body) = get_file(workspace(dir.path()), path).await;
        assert_eq!(status, StatusCode::OK, "{path}");
        // `body["source"]` is null for a missing key too.
        assert_eq!(body.get("source"), Some(&Value::Null), "{path}");
    }
}

#[tokio::test]
async fn file_over_1_mb_is_not_rendered() {
    let dir = common::tempdir();
    workspace(dir.path());
    fs::write(dir.path().join("ws/limit.txt"), "a".repeat(1024 * 1024)).unwrap();
    fs::write(dir.path().join("ws/big.txt"), "a".repeat(1024 * 1024 + 1)).unwrap();

    let (status, body) = get_file(workspace(dir.path()), "limit.txt").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["too_large"], false);
    let (status, body) = get_file(workspace(dir.path()), "big.txt").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["too_large"], true);
    assert!(body["html"].as_str().unwrap().contains("over 1 MB"));
}

#[tokio::test]
async fn the_editor_is_offered_up_to_the_edit_limit() {
    let dir = common::tempdir();
    workspace(dir.path());
    // The spec's limit, not the constant: a test must fail if the constant moves.
    let limit = 8 * 1024 * 1024;
    fs::write(dir.path().join("ws/limit.txt"), "a".repeat(limit)).unwrap();
    fs::write(dir.path().join("ws/huge.txt"), "a".repeat(limit + 1)).unwrap();

    let (_, body) = get_file(workspace(dir.path()), "limit.txt").await;
    let html = body["html"].as_str().unwrap();
    assert!(html.contains("Open it in the editor"), "{html}");
    assert_eq!(body["editable"], true);
    let (_, body) = get_file(workspace(dir.path()), "huge.txt").await;
    let html = body["html"].as_str().unwrap();
    assert!(html.contains("too large to show or to edit"), "{html}");
    assert_eq!(body["editable"], false);
}

#[tokio::test]
async fn hidden_markdown_is_offered_to_the_editor() {
    let dir = common::tempdir();
    let cases = [
        (".todo.md", true),
        ("notes/.drafts/a.md", true),
        (".claude/settings.json", false),
        (".git/a.md", false),
    ];
    for (path, editable) in cases {
        let state = common::workspace(dir.path(), &[(path, b"{}\n")]);
        let (status, body) = get_file(state, path).await;
        assert_eq!(status, StatusCode::OK, "{path}");
        assert_eq!(body["editable"], editable, "{path}");
    }
}

#[tokio::test]
async fn image_is_not_read() {
    let dir = common::tempdir();
    let state = workspace(dir.path());
    fs::write(dir.path().join("ws/big.png"), vec![0; 1024 * 1024 + 1]).unwrap();
    let (status, body) = get_file(state, "big.png").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["too_large"], false);
    assert_eq!(body["editable"], false);
    assert_eq!(body["html"], r#"<img src="/raw/big.png" alt="big.png">"#);
}

#[tokio::test]
async fn missing_files_and_folders_are_not_found() {
    let dir = common::tempdir();
    for path in ["nothing.md", "nothing.pdf", "docs"] {
        let (status, body) = get_file(workspace(dir.path()), path).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{path}");
        assert_eq!(body["error"]["code"], "not_found", "{path}");
    }
}

#[tokio::test]
async fn file_of_unknown_type_is_not_viewable() {
    let dir = common::tempdir();
    let state = workspace(dir.path());
    fs::write(dir.path().join("ws/Makefile"), "").unwrap();
    let (status, body) = get_file(state, "Makefile").await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"]["code"], "not_viewable");
}

#[tokio::test]
async fn unreadable_file_is_not_called_outside() {
    use std::os::unix::fs::PermissionsExt;
    let dir = common::tempdir();
    let state = workspace(dir.path());
    let locked = dir.path().join("ws/docs/a.md");
    fs::set_permissions(&locked, fs::Permissions::from_mode(0o000)).unwrap();
    if fs::read(&locked).is_ok() {
        // Root reads it anyway: nothing to test.
        return;
    }
    let (status, body) = get_file(state, "docs/a.md").await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["error"]["message"], "no permission to open this file");
}
