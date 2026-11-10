use std::fs;
use std::io::{self, ErrorKind};
use std::path::Path;

/// In the order of the theme menu. `web/themes` holds each one's CSS.
pub const BUILT_INS: [&str; 8] = [
    "light",
    "dark",
    "catppuccin-latte",
    "catppuccin-frappe",
    "catppuccin-macchiato",
    "catppuccin-mocha",
    "minimal-light",
    "minimal-dark",
];

/// The name in `<name>.css`, if it names a file of the themes folder: a `/`,
/// which the address can carry as `%2F`, or a leading dot names another one.
pub fn theme_name(file: &str) -> Option<&str> {
    let name = file.strip_suffix(".css")?;
    let plain = !name.is_empty() && !name.starts_with('.') && !name.contains('/');
    plain.then_some(name)
}

/// The built-ins, then the user themes in `dir` by name. A user theme with a
/// built-in's name overrides it, so it shows once. A link counts: dotfile
/// managers make them.
pub fn list(dir: &Path) -> Vec<String> {
    let entries = fs::read_dir(dir)
        .into_iter()
        .flatten()
        .filter_map(Result::ok);
    let mut names: Vec<String> = entries
        .filter(|entry| entry.path().is_file())
        .filter_map(|entry| {
            let file = entry.file_name().into_string().ok()?;
            theme_name(&file).map(str::to_owned)
        })
        .filter(|name| !BUILT_INS.contains(&name.as_str()))
        .collect();
    names.sort();
    BUILT_INS
        .iter()
        .map(|name| name.to_string())
        .chain(names)
        .collect()
}

/// The user theme `file` of `dir`, if there is one. `file` must have passed
/// `theme_name`.
pub fn read(dir: &Path, file: &str) -> io::Result<Option<Vec<u8>>> {
    let path = dir.join(file);
    // A FIFO would block the read.
    if !path.is_file() {
        return Ok(None);
    }
    match fs::read(path) {
        Ok(css) => Ok(Some(css)),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error),
    }
}
