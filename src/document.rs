use std::io::{self, ErrorKind};
use std::time::UNIX_EPOCH;

use cap_std::fs::{Dir, Metadata};
use serde::Serialize;

use crate::render::{self, Family};

/// Bigger files are not rendered: the page would freeze. The editor can
/// still open them.
pub const RENDER_LIMIT: u64 = 1024 * 1024;

#[derive(Debug, Serialize)]
pub struct View {
    pub html: String,
    pub family: Family,
    pub modified: u64,
    pub size: u64,
    pub too_large: bool,
}

/// The rendered file at `path`, relative to the workspace root.
pub fn view(dir: &Dir, path: &str) -> io::Result<View> {
    let family = Family::of(path)
        .ok_or_else(|| io::Error::new(ErrorKind::NotFound, "not a viewable file"))?;
    let metadata = dir.metadata(path)?;
    if !metadata.is_file() {
        return Err(io::Error::new(ErrorKind::NotFound, "not a file"));
    }
    let size = metadata.len();
    let too_large = size > RENDER_LIMIT && family != Family::Image;
    let html = if too_large {
        "<p class=\"mdame-notice\">This file is over 1 MB, too large to show. \
         Open it in the editor.</p>"
            .to_owned()
    } else if family == Family::Image {
        render::file(family, path, "")
    } else {
        let bytes = dir.read(path)?;
        render::file(family, path, &String::from_utf8_lossy(&bytes))
    };
    Ok(View {
        html,
        family,
        modified: modified_secs(&metadata).unwrap_or(0),
        size,
        too_large,
    })
}

/// Unix seconds, or `None` where the OS gives no modified time.
pub fn modified_secs(metadata: &Metadata) -> Option<u64> {
    let modified = metadata.modified().ok()?.into_std();
    Some(modified.duration_since(UNIX_EPOCH).ok()?.as_secs())
}
