mod common;

use std::fs;

use common::get_json;
use mdame::workspace::Workspace;
use tokio::sync::broadcast;

#[tokio::test]
async fn state_gives_the_workspace_and_its_start_file() {
    let dir = tempfile::tempdir().unwrap();
    let file = dir.path().join("a.md");
    fs::write(&file, "").unwrap();
    let workspace = Workspace::open(&file).unwrap();
    let state = common::on(workspace, broadcast::channel(1).0);

    let body = get_json(state, "/api/state").await.1;
    let root = dir.path().canonicalize().unwrap();
    assert_eq!(body["workspace"]["root"], root.display().to_string());
    assert_eq!(body["workspace"]["start"], "a.md");
}
