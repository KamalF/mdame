# Changelog

## 0.2.1 - 2026-11-11

### Fixed

- On macOS, a folder deleted outside mdame now leaves the tree at once.
- On a large folder, live updates start at once: 0.8 s for 15,000 folders,
  instead of 12 s.
- A change to a `.gitignore` or `.ignore` updates the tree: the folders and
  files that it hides leave it without a reload of the page.
- On Linux, when another program renames the file open in the editor, the
  editor follows it, with your unsaved edits and the undo history.
- Ctrl+S with no edit no longer rewrites the file. In a file with mixed line
  breaks, it changed the line breaks.
- The editor no longer misses a change on disk that comes while it opens the
  file. The next save said that the file changed on disk.
- After mdame came back, one failed check could make the page refuse each
  action with "Try again once mdame is back". The page now checks again.
- A reload shows your theme at once, without a flash of the system's theme.
- Copy content works in Safari.
- A crafted table of 256 KB no longer takes 72 s to render: comrak 0.59
  renders it in 2 s.
- The watcher no longer follows symlinks to check folders: a link to a hung
  network mount could stop live updates.

### Changed

- Cargo builds mdame with Rust 1.91 or later.

## 0.2.0 - 2026-11-11

### Added

- The arrow keys move in the sidebar tree: ↑ and ↓ between the rows, → and
  ← to open and close a folder. In the empty filter, ↓ goes to the tree.
- Diff mode shows the revision and the text side by side. The button is in
  the header of the revisions panel.
- View options has a Font choice: Mono shows the content in IBM Plex Mono.
- Wide tables, code blocks, Mermaid diagrams and images grow past the text
  column, and the text keeps its width.
- The Catppuccin themes, Latte, Frappé, Macchiato and Mocha, and the Minimal
  themes, light and dark, are built in.
- Paste or drop an image into the editor of a markdown file: mdame saves it
  beside the file, and links it at the cursor.
- Ctrl+P prints the file alone, in the Light theme.
- The status bar shows the words of a markdown file, and its reading time.

### Fixed

- The focused row of the sidebar tree is easy to see: its focus ring showed
  only its four corners.

## 0.1.1 - 2026-11-10

### Fixed

- On macOS, live updates now see a deleted file, a renamed file and a save
  through a temporary file. The tab still does not follow a renamed file, and a
  deleted folder stays in the tree until you reload the page.
- A `.gitignore` or `.ignore` that is a FIFO, a link to a device such as
  `/dev/zero`, or a file over 16 KiB, no longer makes mdame hang or run out of
  memory. mdame leaves out the folder that holds it, with a warning. Past
  1 MiB of ignore files in all, it also leaves out the folders that hold the
  rest. If such a file is in the folder that mdame opens, or in a folder above
  it, the tree is empty.
- The search panel cuts a line over 200 characters around its match. A
  minified file no longer makes a search answer of tens of MB.

### Security

- If the folder that mdame opens is hidden or in a hidden folder, such as
  `~/.claude` or a worktree in `.claude/worktrees/`, the tree and the editor
  take markdown only, as they do in hidden folders below it. mdame does not
  open a folder in `.git` or `.mdame`.
- The API and the raw files answer only the mdame page itself, an address
  that you type, and programs such as curl. A request that a browser sends for
  another page gets 403, such as for an image on a page of another local
  server.

### Added

- A favicon.
- `rust-version`: on an older Rust, Cargo says that mdame needs Rust 1.89.

### Release

- The binaries are stripped of their symbols, which makes them about 30%
  smaller.
- Each archive has an attestation of its build, which
  `gh attestation verify` checks.
- The archives carry `NOTICE`, and the licence texts of the Rust crates in
  `THIRD-PARTY-LICENSES-RUST.txt`.

## 0.1.0 - 2026-11-08

The first release: a markdown viewer and editor in the browser, beside the
terminal. The page updates when a file changes on disk, and marks the blocks
that changed since you last saw them. The editor keeps revisions. The status
bar lists the files that changed, such as the plan that an agent writes. A
search panel, an outline, and light, dark and user themes. On Linux and macOS;
on macOS, live updates have known issues.
