mod common;

use std::fs::{self, Permissions};
use std::os::unix::fs::PermissionsExt;
use std::path::Path;

use axum::http::{Method, StatusCode};
use axum::response::Response;
use common::{HOST, JSON, etag, etag_of, send_body, status_and_json};
use mdame::app::AppState;
use mdame::document::version;
use serde_json::json;

/// Saves `content` to `path`, with `If-Match` when `if_match` is given.
async fn put(state: AppState, path: &str, if_match: Option<&str>, content: &str) -> Response {
    let uri = format!("/api/file?path={path}");
    let body = json!({ "content": content }).to_string();
    let mut headers = vec![HOST, JSON];
    if let Some(tag) = if_match {
        headers.push(("if-match", tag));
    }
    send_body(state, Method::PUT, &uri, &headers, &body).await
}

fn workspace(dir: &Path) -> AppState {
    common::workspace(dir, &[("a.md", b"old\n")])
}

fn read(dir: &Path, path: &str) -> String {
    fs::read_to_string(dir.join("ws").join(path)).unwrap()
}

fn snapshots(dir: &Path, path: &str) -> Vec<String> {
    let folder = dir.join("ws/.mdame/history").join(path);
    let Ok(entries) = fs::read_dir(folder) else {
        return Vec::new();
    };
    entries
        .map(|entry| fs::read_to_string(entry.unwrap().path()).unwrap())
        .collect()
}

#[tokio::test]
async fn save_writes_the_content_when_the_version_matches() {
    let dir = tempfile::tempdir().unwrap();
    let response = put(
        workspace(dir.path()),
        "a.md",
        Some(&etag(b"old\n")),
        "new\n",
    )
    .await;

    assert_eq!(etag_of(&response), etag(b"new\n"));
    let (status, saved) = status_and_json(response).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(read(dir.path(), "a.md"), "new\n");
    assert!(saved["modified"].as_u64().unwrap() > 0);
}

#[tokio::test]
async fn save_snapshots_the_old_content_first() {
    let dir = tempfile::tempdir().unwrap();
    put(
        workspace(dir.path()),
        "a.md",
        Some(&etag(b"old\n")),
        "new\n",
    )
    .await;

    assert_eq!(snapshots(dir.path(), "a.md"), ["old\n"]);
}

#[tokio::test]
async fn the_snapshot_is_named_by_the_time_of_the_save() {
    let dir = tempfile::tempdir().unwrap();
    let before = now_ms();
    put(
        workspace(dir.path()),
        "a.md",
        Some(&etag(b"old\n")),
        "new\n",
    )
    .await;
    let after = now_ms();

    let folder = dir.path().join("ws/.mdame/history/a.md");
    let name = fs::read_dir(folder)
        .unwrap()
        .next()
        .unwrap()
        .unwrap()
        .file_name();
    let ms: u128 = name
        .to_str()
        .unwrap()
        .strip_suffix(".md")
        .unwrap()
        .parse()
        .unwrap();
    assert!(
        (before..=after).contains(&ms),
        "{ms} not in {before}..={after}"
    );
}

fn now_ms() -> u128 {
    std::time::UNIX_EPOCH.elapsed().unwrap().as_millis()
}

#[tokio::test]
async fn save_of_an_empty_file_makes_no_snapshot() {
    let dir = tempfile::tempdir().unwrap();
    let state = common::workspace(dir.path(), &[("a.md", b"")]);
    let response = put(state, "a.md", Some(&etag(b"")), "new\n").await;

    assert_eq!(response.status(), StatusCode::OK);
    assert!(!dir.path().join("ws/.mdame").exists());
}

#[tokio::test]
async fn save_of_the_text_on_disk_writes_nothing() {
    let dir = tempfile::tempdir().unwrap();
    let state = workspace(dir.path());
    let file = fs::File::options()
        .write(true)
        .open(dir.path().join("ws/a.md"))
        .unwrap();
    let long_ago = std::time::UNIX_EPOCH + std::time::Duration::from_secs(1_000_000);
    file.set_modified(long_ago).unwrap();
    let response = put(state, "a.md", Some(&etag(b"old\n")), "old\n").await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(etag_of(&response), etag(b"old\n"));
    let modified = fs::metadata(dir.path().join("ws/a.md")).unwrap().modified();
    assert_eq!(modified.unwrap(), long_ago);
    assert!(!dir.path().join("ws/.mdame").exists());
}

#[tokio::test]
async fn save_writes_the_file_in_place() {
    let dir = tempfile::tempdir().unwrap();
    let state = common::workspace(dir.path(), &[("a.md", b"a longer text\n")]);
    let file = dir.path().join("ws/a.md");
    fs::set_permissions(&file, Permissions::from_mode(0o600)).unwrap();
    fs::hard_link(&file, dir.path().join("link.md")).unwrap();
    let response = put(state, "a.md", Some(&etag(b"a longer text\n")), "short\n").await;

    assert_eq!(response.status(), StatusCode::OK);
    let link = fs::read_to_string(dir.path().join("link.md")).unwrap();
    assert_eq!(link, "short\n");
    let mode = fs::metadata(&file).unwrap().permissions().mode();
    assert_eq!(mode & 0o777, 0o600);
}

#[tokio::test]
async fn save_with_a_stale_version_is_refused_and_writes_nothing() {
    let dir = tempfile::tempdir().unwrap();
    let response = put(
        workspace(dir.path()),
        "a.md",
        Some(&etag(b"older\n")),
        "new\n",
    )
    .await;

    let (status, error) = status_and_json(response).await;
    assert_eq!(status, StatusCode::PRECONDITION_FAILED);
    assert_eq!(error["error"]["message"], "a.md: the file changed on disk");
    assert_eq!(read(dir.path(), "a.md"), "old\n");
    assert!(!dir.path().join("ws/.mdame").exists());
}

#[tokio::test]
async fn save_without_if_match_is_refused() {
    let dir = tempfile::tempdir().unwrap();
    let response = put(workspace(dir.path()), "a.md", None, "new\n").await;

    assert_eq!(response.status(), StatusCode::PRECONDITION_REQUIRED);
    assert_eq!(read(dir.path(), "a.md"), "old\n");
}

#[tokio::test]
async fn if_match_must_be_one_strong_etag() {
    let dir = tempfile::tempdir().unwrap();
    let hash = version(b"old\n");
    let forms = [
        "*".to_owned(),
        hash.clone(),
        format!("W/\"{hash}\""),
        format!("\"other\", \"{hash}\""),
    ];
    for form in forms {
        let response = put(workspace(dir.path()), "a.md", Some(&form), "new\n").await;

        assert_eq!(response.status(), StatusCode::PRECONDITION_FAILED, "{form}");
        assert_eq!(read(dir.path(), "a.md"), "old\n", "{form}");
    }
}

#[tokio::test]
async fn if_match_sent_twice_never_matches() {
    let dir = tempfile::tempdir().unwrap();
    let uri = "/api/file?path=a.md";
    let body = json!({ "content": "new\n" }).to_string();
    let (good, other) = (etag(b"old\n"), etag(b"other\n"));
    let headers = [HOST, JSON, ("if-match", &good), ("if-match", &other)];
    let response = send_body(workspace(dir.path()), Method::PUT, uri, &headers, &body).await;

    assert_eq!(response.status(), StatusCode::PRECONDITION_FAILED);
    assert_eq!(read(dir.path(), "a.md"), "old\n");
}

#[tokio::test]
async fn save_of_a_file_that_mdame_may_not_write_leaves_no_snapshot() {
    let dir = tempfile::tempdir().unwrap();
    let state = workspace(dir.path());
    fs::set_permissions(dir.path().join("ws/a.md"), Permissions::from_mode(0o444)).unwrap();
    let response = put(state, "a.md", Some(&etag(b"old\n")), "new\n").await;

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    assert_eq!(read(dir.path(), "a.md"), "old\n");
    assert!(snapshots(dir.path(), "a.md").is_empty());
}

#[tokio::test]
async fn save_without_a_writable_history_folder_writes_nothing() {
    // A read-only history folder, and one that cannot be created.
    let setups: [fn(&Path); 2] = [
        |ws| {
            let history = ws.join(".mdame/history");
            fs::create_dir_all(&history).unwrap();
            fs::set_permissions(&history, Permissions::from_mode(0o555)).unwrap();
        },
        |ws| fs::write(ws.join(".mdame"), "").unwrap(),
    ];
    for (n, setup) in setups.into_iter().enumerate() {
        let dir = tempfile::tempdir().unwrap();
        let state = workspace(dir.path());
        setup(&dir.path().join("ws"));
        let response = put(state, "a.md", Some(&etag(b"old\n")), "new\n").await;

        let (status, error) = status_and_json(response).await;
        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR, "setup {n}");
        let message = error["error"]["message"].as_str().unwrap();
        assert!(message.contains("history folder"), "{message}");
        assert_eq!(read(dir.path(), "a.md"), "old\n", "setup {n}");
    }
}

#[tokio::test]
async fn save_of_a_deleted_file_is_refused() {
    let dir = tempfile::tempdir().unwrap();
    let state = workspace(dir.path());
    fs::remove_file(dir.path().join("ws/a.md")).unwrap();
    let response = put(state, "a.md", Some(&etag(b"old\n")), "new\n").await;

    assert_eq!(response.status(), StatusCode::PRECONDITION_FAILED);
    assert!(!dir.path().join("ws/a.md").exists());
}

#[tokio::test]
async fn save_takes_content_up_to_the_edit_limit() {
    let dir = tempfile::tempdir().unwrap();
    // The spec's limit, not the constant: a test must fail if the constant moves.
    let limit = 8 * 1024 * 1024;
    let content = "a".repeat(limit);
    let response = put(
        workspace(dir.path()),
        "a.md",
        Some(&etag(b"old\n")),
        &content,
    )
    .await;
    assert_eq!(response.status(), StatusCode::OK);

    let if_match = etag(content.as_bytes());
    // No files given: `a.md` keeps the content of the first save.
    let state = common::workspace(dir.path(), &[]);
    let response = put(state, "a.md", Some(&if_match), &"a".repeat(limit + 1)).await;
    assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(read(dir.path(), "a.md").len(), limit);
}
