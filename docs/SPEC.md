# mdame — spec

Architecture, API, protocol and library choices signed off by the owner on 14 October 2026.

## How to use this document

This is the spec for mdame, a from-scratch rebuild of mdlive as a local markdown viewer and editor served to the browser by a Rust binary. It records what was decided, why, and what is still open. It is the source of truth: update it in the same commit as any decision change.

The owner wants to own the architecture and the design, and to use the build as a Rust learning exercise. Work goes in this order:

1. **Architecture review with the owner.** Done 14 October 2026; see the review log at the end.
2. **Design work with the owner.** The Front end and design section is a brief, not a design. Explore it together before building UI.
3. **Build milestone by milestone.** Each milestone ends with something usable and a short review.

Throughout, the owner writes or closely reviews the Rust. The session explains idioms, proposes structure and reviews code rather than producing large unreviewed changes.

| Area | Status |
| --- | --- |
| Feature scope | Decided by the owner; Later items open |
| Architecture, API, protocol | Signed off 14 October 2026 |
| Library choices | Signed off 14 October 2026 |
| Security model | Signed off 15 October 2026; security reviews continue during the build |
| Visual design and interaction | Wireframes signed off 15 October 2026, to adjust during testing; themes open |

## Context

The rebuild replaces [bearded-giant/mdlive](https://github.com/bearded-giant/mdlive) v2.3.13 with a smaller app built from specialised, well-tested libraries. mdlive is itself a fork of Jose Fernandez's [mdserve](https://github.com/jfernandez/mdserve). Both are MIT licensed: keep their copyright notices in any file that copies code from them, and credit both in the README.

**What mdlive is today.** An axum server that renders markdown to HTML, keeps every file pre-rendered in memory behind one mutex, watches the folder with `notify`, and tells browsers to reload over a WebSocket. Around 12,600 lines excluding tests:

| Part | Lines |
| --- | --- |
| Rust server, 15 files | 4,608 |
| CSS inside `templates/main.html` | about 2,600 |
| JS and markup inside `templates/main.html` | about 4,560 |
| Tauri desktop app | 810 |

**Why rebuild rather than patch.** The owner opened two issues: [#14](https://github.com/bearded-giant/mdlive/issues/14), CodeMirror 6 in the editor, and [#15](https://github.com/bearded-giant/mdlive/issues/15), user themes from a config file or `--css` flag. Neither fits the current shape:

- The whole UI is one 7,161-line MiniJinja template with no build step, so an ES-module library like CodeMirror 6 has no place to go.
- Themes are five hard-coded CSS blocks, plus a hard-coded list in JS for the Mermaid theme.
- View mode renders in Rust (`markdown` crate) while the editor preview renders with marked.js in the browser, so the preview can disagree with the view.
- Any file change sends one global Reload, and every tab does a full page load.
- Launching has up to five fallback paths across three process models (one-shot server, daemon, Tauri app with a server per window) plus a launchd service.

**Security finding in the current code.** The router adds `CorsLayer::permissive()` to every route and never checks the `Origin` or `Host` header. From reading the code, not testing, any website open in the browser could call the local API while mdlive runs: list folders via `/api/workspace/browse`, switch workspace, read, save or delete files. The rebuild must not repeat this; see Security. If the owner confirms it, a private GitHub security advisory to upstream is preferable to a public issue.

## Goals, non-goals and principles

The goal is a local markdown workspace in the browser that the owner fully understands, with a real editor and their own themes, at a fraction of the current size.

**Goals**

- Read and edit a folder of markdown and text files in the browser, with live updates when files change on disk, for example while an AI agent writes them.
- One markdown renderer, in Rust, so the view and the editor preview always match.
- CodeMirror 6 editor with markdown highlighting (issue #14).
- Themes as plain CSS files, including user themes from a config folder (issue #15).
- Safe by default: no other website and no other device can touch files unless the owner allows it.
- A codebase small enough to read in an afternoon.

**Non-goals for v1**

- Desktop app, menus or native windows. The browser is the app.
- Tabs for several open files.
- Multi-user editing or conflict resolution beyond a "changed on disk" notice.
- A documentation-site generator, plugins or extensions.
- Windows support is welcome but not a target. Linux and macOS are, with CI on both (macOS since 29 October 2026).

**Principles**

- **One thing, one library.** Prefer a focused, well-tested crate or package over custom code; write custom code only where a library would be heavier than the feature.
- **Server owns files, browser owns presentation.** The server reads, writes, renders and watches; the browser lays out, edits and themes.
- **Patch, don't reload.** File changes update only what changed, keeping scroll and state.
- **Every feature earns its code.** If a feature needs a new subsystem, it goes to Later.
- **Learning first.** Code is idiomatic and explained; no clever abstractions the owner hasn't chosen.

## Feature scope

v1 is the owner's Keep list from the feature checklist, plus a few nearly free items promoted from Later and a few simplifications agreed afterwards.

### v1

**Launching.** `mdame` with no path starts at the workspace picker. `mdame <file>` and `mdame <folder>` start the same server with that workspace already open; a file opens its folder, with that file shown first. One workspace per launch. Flags: `-H` bind address, `-p` port with fallback to the next free one, `--no-open`, `-v` verbose logging. Opens the browser on start. Ships as a single binary with all assets embedded.

**Viewing.** GitHub-flavoured markdown, raw HTML (sanitized), front matter hidden, highlighted code blocks with a copy button, Mermaid in fenced blocks and `.mmd` files, images from the workspace, text, JSON, YAML and TOML shown highlighted, GraphQL as plain text, CSV as a table, a 1 MB render guard, a not-found page and an empty-workspace page. Find in page uses the browser's own Cmd/Ctrl+F.

**Live updates.** Content updates in place when a file changes, new and removed files and folders show in the sidebar, editors' save-by-rename is handled, images refresh, scroll position is kept, the current view follows a rename, and the editor shows a "changed on disk" notice.

**Sidebar.** Collapsible folder tree with remembered open folders, drag to resize, hide/show with `b`, fuzzy filter with `/`, sort by name or modified in either direction, current file highlighted, file-type icons. Row hover buttons: new file in this folder, copy path.

**Status bar actions.** Edit, copy raw content, copy path, revisions.

**Editor.** CodeMirror 6 with markdown highlighting, opened with `e`. Split view with draggable divider, show/hide preview, line numbers, scroll sync, Cmd/Ctrl+S and a Save button, Esc to close, Cmd/Ctrl+B and I, Tab inserts two spaces, unsaved dot and leave-page warning, last-modified time in the status bar.

**Revisions.** Snapshot on every save that changes the file. `h` or `r` from view or editor opens the editor in diff mode: an inline diff against a revision picked from a list, then restore (snapshots the current version first, so it is undoable). Automatic pruning to the last N snapshots per file.

**Workspaces.** Picker page, shown when `mdame` starts without a path: a path field that autocompletes folders, with recent workspaces as suggestions.

**Look and feel.** Theme picker with built-in light and dark themes plus any user theme in `~/.config/mdame/themes/`, content width and font size presets, a shortcut help dialog (`?`), status bar (workspace, file, edit mode, version, file actions), dialogs on the native `<dialog>` element. A one-time dialog on first start asks where to keep revision history (see On-disk formats).

**Agent workflow.** Added on 29 October 2026, so that v1 is ready for a Show HN:

- The tree shows the markdown in the folders where agents write: `.claude`, `.kiro`, `.cursor` and `.github`. They are view-only: the editor still refuses hidden files, and `.git` and `.mdame` stay out.
- Handoff: `mdame <file>` in a workspace that a running mdame already serves opens that file in its tab and exits, so an agent or a second terminal reuses one tab. An advisory lock file that holds the port (`File::try_lock`, released by the OS on exit) finds the running mdame; where it lives is decided in milestone 9.
- What changed: after a change on disk, the blocks that changed glow for a moment, and diff mode can compare the text with the version shown when the file was opened. The glow comes from a diff of the source lines, mapped to blocks through `data-sourcepos`.
- Full-text search: the sidebar filter also searches the contents of the files.
- Copy as quote: a selection in the view copies as a markdown quote with `path:line`, ready to paste into the agent.
- Clickable task lists: a click on a checkbox in the view ticks it in the file, through the same save and `If-Match`.
- A `CLAUDE.md` / `AGENTS.md` snippet and a one-file skill tell an agent to run `mdame <file>` after it writes a plan.

**Distribution.** Release binaries for Linux and macOS through cargo-dist: an install script, a Homebrew tap and an npm wrapper. A public GitHub repository, and the crate on crates.io.

### Later, by cost

The small items form milestone 11, after v1. The medium and large ones wait.

| Item | Cost | Notes |
| --- | --- | --- |
| About dialog | Small | One dialog; the shortcut help moved to v1 |
| Custom key bindings | Small | A `[keys]` table in `config.toml` mapping action names to keys, sent in `/api/state`; `keys.ts` builds its map from it with the defaults as fallback. Two actions on one key stop mdame at start |
| Alternative built-in themes: Catppuccin (Latte, Frappé, Macchiato, Mocha) and Minimal | Small | Extra CSS files. Catppuccin from its official palette and style guide, with `subtext1` as muted text in Latte (5.53:1; `subtext0` fails at 4.37). Minimal from its default HSL formulas, with Primer's code colours since it has none; its default accent needs checking as link text. Both MIT |
| New file with `n`, new-file editor | Small | Reuses the folder hover action |
| Side-by-side diff in diff mode | Small | `MergeView` from `@codemirror/merge`, already a dependency, as a toggle beside the inline diff, remembered in `localStorage`. It needs width: with the sidebar open, each pane gets about 370 px on a 1280 px window |
| Mono toggle | Small | Content in `--font-mono` at `--content-width-mono`; out of v1 on 29 October 2026 |
| Toasts | Small | At the bottom of the page, once a feature needs them; out of v1 on 29 October 2026 |
| Vim key bindings in the editor, as a toggle | Small | `@replit/codemirror-vim`; the choice lives in `localStorage` |
| Print stylesheet | Small | Ctrl+P prints the content alone, without the sidebar and the status bar; the browser can print to PDF |
| Word count and reading time in the status bar | Small | For the open file |
| Read-only mode, `--read-only` | Small | The write routes (save, create, restore) answer 403, and `/api/state` tells the page to hide the editor. For a LAN share, or a folder that you only watch |
| File operations: new folder, rename, move, delete with confirmation | Medium | Server side is simple with cap-std; UI needs a menu |
| Right-click menu on tree and page | Medium | Do together with file operations |
| Switch workspace without restarting (`o` key, `/open?path=`) | Medium | Swap the workspace under the write lock, drop the old watcher, tell every tab; the owner expects to want it |
| `-j` hand off to a running instance | Medium | Probe the default port, POST a workspace switch; needs workspace switching first |
| launchd service (`mdame service …`) | Medium | macOS only, a plist template |
| Paste or drop an image into the editor | Medium | The image is saved in the workspace and linked at the cursor. A new upload route, with the limits of the other writes; where the image goes is decided then |
| Tabs: open files, reorder, close, overflow, unsaved markers, restore per workspace | Large | The most tangled part of the old UI; needs a design first |

### Dropped

- Desktop app and everything in it: native windows, menus, session restore, update checks, CLI installer.
- Opening in the desktop app by default, and the `-b` flag.
- Claude Code plugin.
- The filesystem browser modal; replaced by path autocomplete.
- Sort by created date; unreliable on Linux.
- Deleting a single revision; replaced by pruning.
- Restoring a revision into the editor; restore writes the file.
- The custom find bar; the browser's find and CodeMirror search cover it.

### Inconsistencies resolved

| Checklist conflict | Resolution |
| --- | --- |
| Save shortcut marked Later, but editor, unsaved dot and snapshots kept | Cmd/Ctrl+S and a Save button are in v1 |
| "New file in folder" and copy actions kept, right-click menu Later | Hover buttons on tree rows; file actions in the status bar |
| Single binary dropped | Kept: rust-embed gives it free, and dropping it makes installing harder |
| Find bar kept | The browser's find; no custom code |
| `-H` kept | A URL token is required, on loopback too |
| "Renamed file follows open tabs" without tabs | The current view follows a rename |
| Five themes Later, theme picker kept | Picker ships with light, dark and user themes |
| Single-file and folder mode Later, daemon kept | Same code path as starting at the picker, with the workspace preloaded, so in v1 |

## Architecture

One Rust process serves one workspace at a time to any number of browser tabs. It owns every file operation and all rendering; the browser lays out, edits and themes.

```
browser tabs ──HTTP /api, /raw, /assets──►┌─────────────┐
     ▲                                     │ guard       │ Origin, Host, token
     │                                     ├─────────────┤
     │                                     │ handlers    │ thin: api/*.rs
     │                                     ├─────────────┤
     │                                     │ core        │ document, render, history, tree, config
     │                                     ├─────────────┤
     │                                     │ cap-std Dir │──► workspace files on disk
     │                                     └─────────────┘          │
     │                                                              │ inotify
     └──── /ws events ◄── broadcast ◄── watch.rs ◄── debouncer ◄────┘
```

Every request passes the guard before reaching a handler. Handlers stay thin and call core modules, and every file access goes through the workspace's cap-std `Dir`. File changes travel the other way: notify events go through the debouncer in `watch.rs`, then out to every tab over the WebSocket.

**Process model.** `mdame` with no path starts at the picker; with a path, it starts with that workspace open. There is no daemon handoff, port file, launchd service or desktop app in v1. If the port is busy, try the next ones and print the URL actually used; the browser opens on that URL once the port is bound.

**Two launches on one workspace.** Allowed in v1. Each runs on its own port and sees the other's saves as changes on disk, and the save check works across them because it compares content, not process state. Shared writes are made safe instead of locked: `config.toml` and `recents.toml` are written to a temporary file and renamed over the original, snapshots are created with `create_new`, and pruning ignores snapshots that are already gone. A lost recent entry is acceptable. Detecting the second launch is a Later item.

**Viewing a file.** The browser asks `GET /api/file?path=…`; the server reads the file through the `Dir`, renders it with comrak, sanitizes it with ammonia and returns HTML with source positions. The browser morphs it into the content area, highlights new code blocks with Lezer and runs Mermaid on new diagrams.

**When a file changes on disk.** The debouncer reports the path; `watch.rs` sends `changed`; tabs showing that file refetch and morph, keeping scroll. The tree refetches only on create, remove or rename, and on a change to a file of the tree while it is sorted by date.

**Saving.** The editor loads its text with `GET /api/source`, which returns the content and its `ETag` (a content hash) in one response. It saves with `PUT /api/file` and `If-Match` set to that ETag. If the content on disk changed since, the server answers 412, and the editor checks the file on disk as after a `changed` event. Otherwise `history.rs` snapshots the old content, the new content is written, and the watcher's own event updates other tabs.

After a `changed` event or a 412, the editor fetches the file again and compares it with its own text:

- If the file has the editor's version, nothing changes. After a 412, the status bar says "Save again": the file was replaced during the save, so the save did not happen.
- If the file has a new version and the editor has no unsaved edits, the editor reloads it without a notice. Only the changed lines change, so the cursor and the scroll stay. Ctrl+Z undoes the reload.
- If the file has a new version and the editor has unsaved edits, a notice says that the file changed on disk. Reload replaces the edits with the file on disk, and Ctrl+Z brings them back. Overwrite saves the editor's text over the file, and the snapshot keeps the text that was on disk.
- If the file is gone, a notice says so. Recreate creates the file again and saves the editor's text into it.

## Libraries

Each part of the app maps to one focused library; custom code is limited to snapshot storage, scroll sync, toasts, port fallback, config and state paths, the keyboard map, rendered-markdown CSS and the code-highlighting glue. Versions and facts were checked on crates.io, docs.rs, the npm registry and each repo on 14 October 2026; pin whatever is current when the project starts.

### Rust

| Crate | Version | Job | Considered and rejected |
| --- | --- | --- | --- |
| axum + tokio | 0.8.9; 1.53 | HTTP and WebSocket server (`ws` feature); the guard is `middleware::from_fn_with_state` | none smaller worth the trade |
| rust-embed | 8.13 | Embed `web/dist` in release builds, read from disk on each request in debug (unless the `debug-embed` feature is on); its per-file SHA-256 gives `/assets` ETags | memory-serve (small user base), axum-embed (no release since 2023) |
| notify-debouncer-full | 0.7 | Debounced file events with rename pairing | raw `notify` with custom handling (what mdlive does), notify-debouncer-mini (loses rename info). Rename pairing on inotify is not explicitly documented: the ported mdlive watcher tests are the proof. 0.8 is in release candidate. |
| ignore | 0.4.33 | Walk the workspace, respecting `.gitignore` and hidden files; `follow_links` stays false | walkdir (no ignore rules) |
| cap-std | 4.0.3 | Confine every file operation to the workspace directory | `canonicalize` + `starts_with` checks |
| comrak | 0.56 | Markdown to HTML: GFM, footnotes, alerts, front matter, heading ids, `sourcepos`. About one breaking minor a month: pin it and update deliberately | `markdown` crate (fewer options), pulldown-cmark (fewer extensions) |
| ammonia | 4.2.4 | Sanitize rendered HTML: keep markup, strip scripts and handlers | none |
| csv | 1.4 | CSV to table | a hand-written split (breaks on quoted fields and newlines) |
| clap | 4.6 | CLI flags (derive) | hand parsing (teaches little, no `--help`) |
| serde, serde_json, toml | 1.0.229; 1.0.154; 1.1 | Config and JSON API | none |
| open | 5.4 | Open the browser | custom per-OS commands |
| tracing, tracing-subscriber | 0.1.44; 0.3.23 | Logging and timing spans; `-v` sets debug level | log + env_logger (no spans, while axum and tower speak tracing), println |
| thiserror | 2.0 | Typed API errors | none |
| getrandom | 0.4.3 | Secure random bytes from the OS for the token and its codes | rand (far more than the one call that mdame needs), reading `/dev/urandom` (no Windows) |

Written ourselves instead of a crate:

- **Config and state paths.** `$XDG_CONFIG_HOME` or `~/.config`, and `$XDG_STATE_HOME` or `~/.local/state`, each joined with `mdame`. About 10 lines; replaces etcetera.
- **Errors in `main`.** `app::run` returns `Result<(), Box<dyn std::error::Error>>`; `main` prints the error and exits with a failure code. Replaces anyhow.

Dev dependencies: tempfile, [insta](https://crates.io/crates/insta) for snapshot tests of rendered HTML (`cargo-insta` comes from the mise registry), `tower::ServiceExt::oneshot` for route tests, and [tokio-tungstenite](https://crates.io/crates/tokio-tungstenite) with `futures-util` (the version axum already uses) as the WebSocket client of the `/ws` tests.

### Browser

| Package | Version | Job | Considered and rejected |
| --- | --- | --- | --- |
| Bun (package manager and bundler); esbuild as fallback bundler | 1.4.3; esbuild 0.28.2 | Install browser packages from `bun.lock`, bundle `web/src` into `web/dist` | npm and Node (Node not wanted; dependency install scripts on by default); hand-vendored ES modules (CDN builds duplicate `@codemirror/state`); no framework toolchain |
| typescript, @types/bun | 7.0.2; 1.4.3 | Check the types of the browser code (`tsc --noEmit`, in `mise run lint`) and of its tests | JSDoc types in plain JavaScript (weaker checks, noisier code) |
| codemirror, @codemirror/lang-markdown, @codemirror/language-data, @codemirror/search | 6.0.2; 6.5.2; 6.5.2; 6.7.2 | Editor, markdown and fenced-code highlighting, search; language-data loads each language on demand | textarea (current), Monaco (heavy) |
| @codemirror/merge | 6.12 | Inline diff against a revision in the editor (`unifiedMergeView`) | diff2html, server-side diff with `similar` |
| @lezer/highlight | 1.2.5 | Code highlighting in rendered views with the editor's own parsers (`highlightCode`, `classHighlighter`) | highlight.js (a second grammar set and class names), shiki (heavier), syntect on the server (theme mapping work) |
| mermaid | 12.2 | Diagrams; an ESM entry of 31 KB plus 104 lazy chunks (about 5.4 MB, embedded), loaded only when a page has one | none exists |
| idiomorph | 0.8 | Patch new HTML into the page in place (0BSD) | morphdom (equivalent), full reload (current) |
| @leeoniya/ufuzzy | 1.0.19 | Sidebar fuzzy filter, with its `highlight` helper | fuse.js (bigger) |

Written ourselves instead of a package:

- **Keyboard map** in `keys.ts`. About 30 lines implementing the rules of the Keyboard section; replaces tinykeys.
- **`web/styles/content.css`** for rendered markdown. It uses the theme contract's variables directly; replaces github-markdown-css, whose 234 variables follow the OS colour scheme rather than the theme picker.

Icons: Lucide, copied in as SVG files, only the icons used. Lucide is ISC, and its Feather-derived icons are MIT; the README names both licences.

Theme colours: copied from `@primer/primitives` (MIT) for the built-ins, and later from Catppuccin and Minimal (both MIT). No package is installed; the README credits each.

No UI framework: plain ES modules, written in TypeScript. Revisit Preact only if tabs make state sprawl.

**TypeScript.** The browser code is TypeScript with `strict` on, plus `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` and `noImplicitReturns`; `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` stay off, as they add noise for little safety here. Bun strips the types when it bundles, so no compile step is added; `tsc --noEmit` checks them in `mise run lint`, and `@types/bun` types `bun test`. Chosen over plain JavaScript because type errors show before the code reaches the browser.

Rejected for this design: marked, markdown-it, micromark (rendering is in Rust), diff2html and `similar` (the merge view draws diffs in the browser), gray_matter, interprocess, tower-livereload (full-page reloads only), portpicker and single-instance (unmaintained).

## Repository layout and modules

One Cargo package (no Cargo workspace), one `web/` folder for the front end, and a small number of modules with one job each.

```
mdame/
  Cargo.toml
  mise.toml             tools (rust, bun, cargo-insta) and tasks: web, dev, fmt, lint, test, check-dist
  package.json          browser dependencies (no scripts beyond our own)
  bun.lock              committed text lockfile
  bunfig.toml           linker = "hoisted"
  src/
    main.rs             thin: clap, tracing setup, then mdame::app::run(args)
    lib.rs              declares the modules, so tests/ can use them
    app.rs              AppState, startup, port fallback, open browser
    server.rs           router, security guard layer, static assets
    error.rs            ApiError (thiserror) → status code + JSON body
    config.rs           config.toml (settings), recents.toml; config, state and themes dirs
    workspace.rs        Workspace: root, cap-std Dir, starting file; open
    tree.rs             ignore walker → tree JSON; folder autocomplete
    watch.rs            debouncer → relative-path events → broadcast
    render.rs           comrak, ammonia, per-type rendering, size guard
    document.rs         read, save (with snapshot), raw bytes for images
    history.rs          snapshots, listing, pruning, restore
    ws.rs               WebSocket: forward events to clients
    api.rs              declares the route-group modules below
    api/                files.rs, history.rs, workspace.rs: one per route group
  web/
    index.html
    notices.ts          writes the licence texts of the bundled packages
    src/                main.ts, api.ts, live.ts, sidebar.ts, view.ts,
                        editor.ts, revisions.ts, picker.ts, dialogs.ts,
                        toast.ts, theme.ts, keys.ts, codehl.ts
    styles/             base.css, layout.css, components.css, content.css
    themes/             light.css, dark.css
    dist/               bundle output, embedded by rust-embed (committed)
  node_modules/         installed by bun ci (git-ignored)
  tests/                route and watcher integration tests; fixtures/
  docs/SPEC.md          this document
  LICENSE, README.md, CLAUDE.md
```

**Library plus thin binary.** Integration tests in `tests/` are separate crates and can only use what `lib.rs` exports, so the modules live in the library and `main.rs` only parses flags, sets up tracing and calls `mdame::app::run`.

**Naming.** The core file module is `document.rs`, so it never collides with the handler file `api/files.rs`. Module folders use the `api.rs` + `api/` form, not `mod.rs`.

**Shared state.** The router holds `Arc<AppState>`, and axum hands every handler a clone of that `Arc`: one pointer copy, no data copied. `AppState` itself cannot be cloned, because `RwLock` is not `Clone`. It holds:

- `config: RwLock<Config>`.
- `workspace: RwLock<Option<Arc<Workspace>>>`; `None` means the picker is shown. It is a `std::sync` lock, read only through `AppState::workspace() -> Result<Arc<Workspace>, ApiError>`, which clones the `Arc` out and drops the guard at once, never across an `.await`. Chosen over `OnceLock` and `tokio::sync::watch` because it supports Later workspace switching unchanged.
- `events: broadcast::Sender<Event>` for WebSocket clients.
- `access: Mutex<Access>`: the token and its open codes (the opened and the printed one), under one lock, so that a request decides from one view of them. A `None` token turns the check off for tests of other rules.
- `token_file: Option<PathBuf>`: where the token is kept, on loopback (see Token).

**Opening a workspace.** Once per launch: from the command line at start, or from the picker. Build the `Workspace` (open the `Dir`, start the watcher), store it, and send `workspace` to all clients. A second `POST /api/workspace` gets 409. Switching to another workspace is a Later item; it will reuse the same route, lock and event.

**No render cache.** Render on each request; comrak is fast enough for files under the 1 MB guard, and this removes the old app's global mutex problem. Render time is logged at debug level (`-v`), and milestone 4 times the 1 MB fixture. The editor preview is the heavier load, and a cache cannot help it. Add a cache keyed by path and content only if the numbers ask for it.

**Watcher threading.** The debouncer calls back on its own OS thread. Forward its results into a tokio `mpsc` channel with `blocking_send`; a tokio task turns them into `Event`s with workspace-relative paths, skips `.mdame/`, and sends them on the broadcast channel. Each WebSocket connection subscribes its own receiver, so a slow tab never slows the watcher or the other tabs. The debounce is 200 ms. If the watch cannot start, for example at the inotify watch limit, mdame logs a warning and runs without live updates. A folder it cannot read, or one deleted while the watch starts, is skipped with a warning: notify stops a recursive watch at the first such folder, so the folders on the path down to it are watched one by one, and a folder created later on that path is not watched until mdame restarts. The debouncer releases each path's events on its own, so a file deleted and written again with a gap can arrive as `removed`, then `created`.

**Bursts and lag.** The broadcast channel holds 256 events (`EVENT_CAPACITY`). When one debounced batch holds more than 100 events (`BURST_THRESHOLD`), for example after a `git checkout`, and not counting reads (inotify reports each open, and mdame's own tree walk opens every folder), `watch.rs` sends a single `resync` instead of the individual events. A tab whose receiver still returns `Lagged` also gets `resync`. Both numbers are named constants to tune later.

## HTTP API and WebSocket protocol

The browser is a single page that talks JSON to `/api`, gets raw workspace files from `/raw`, and listens on `/ws`. Every `path` is relative to the workspace root, uses forward slashes, and is resolved through cap-std, so `..` and absolute paths fail with 403.

### Routes

| Method and path | Purpose | Returns |
| --- | --- | --- |
| `GET /`, `/view/*`, `/edit/*` | The single page; the browser routes from the URL | `index.html` |
| `GET /assets/*` | Bundled JS and CSS | embedded files, with ETag |
| `GET /themes/{name}.css` | Built-in or user theme | CSS |
| `GET /raw/*path` | Workspace images, and other files as plain text | images with their type, anything else as `text/plain`; always sandboxed (see Security); 413 over 64 MB, since the file is read whole |
| `GET /api/state` | Workspace as `{root, start}` (or none), version, theme list, `needs_setup`, `home` (to show paths as `~/…`) | JSON |
| `GET /api/tree` | Nested folder tree. Only viewable files (see Rendering); folders with none are left out. `.gitignore` rules apply even outside a git repository. A folder's `modified` is that of its newest file; a file has a `family` (`markdown`, `text`, `data`, `table`, `diagram`, `image`) that picks its icon and its rendering. 409 when no workspace is open | `{name, path, kind, family, modified, children}` |
| `GET /api/file?path=` | Rendered file: `html`, `family`, `modified`, `size`, `too_large`, and `editable`, whether the page offers the editor. 404 `not_found` for a missing file; 404 `not_viewable` for a file that exists with no family, so the page can offer the raw file | JSON |
| `GET /api/source?path=` | Editor source, in one request: text and its version together; 413 over 8 MB, and 404 `not_viewable` for a file that the editor may not open (below) or that is not UTF-8 | `{content, modified}` with `ETag: "<content hash>"` |
| `PUT /api/file?path=` | Save `{content}` with `If-Match: "<hash>"`; snapshots first; 404 `not_viewable` for a file that the editor may not open; 413 over 8 MB | `{modified}` and the new `ETag`; 412 if the content changed on disk since, or if `If-Match` is anything but one strong `ETag` (`*` and lists included); 428 without `If-Match` |
| `POST /api/file` | Create `{path}`, empty; 409 if it exists, 400 for a type that the editor cannot open or that the tree hides, 404 naming the folder when its folder is missing. Folders are never created | 201, `{modified}` and the `ETag` of the empty content |
| `POST /api/render` | Editor preview `{path, content}` | `{html}` |
| `GET /api/history?path=` | Revisions of a file that the editor may open, newest first. The `id` is the snapshot's name, and `time` is the Unix milliseconds of that name. A file that mdame never saved over gives `[]`, and the request creates no folder | `[{id, time, size}]` |
| `GET /api/history/view?path=&id=` | A revision's text, for the merge view. 404 `not_found` for an `id` that is not the name of a revision of this file; 404 `not_viewable` for a revision that is not UTF-8 | `{content}` |
| `POST /api/history/restore` | `{path, id}`: saves the revision over the file, as `PUT /api/file` does. The current content becomes a revision first, so the restore can be undone. It needs no `If-Match`. 404 for a deleted file, or for an `id` that names no revision; 412 if another program writes the file during the restore | `{modified}` and the new `ETag` |
| `GET /api/recents` | Recent workspaces, newest first; an unreadable file gives `[]` | `[{path, last_opened_secs}]` |
| `POST /api/workspace` | Open `{path}`, a file or folder, when none is open (409 otherwise). `~` and `~/` name the home folder; a relative path gets 400 | new state |
| `PUT /api/settings` | Save settings chosen in the page, such as `{history}` from the first-start dialog | new state |
| `GET /api/complete?prefix=` | Folder and file suggestions for the picker: entries of the typed folder that start with the last part, in any case; folders first, ending with `/`; hidden ones once the last part starts with `.`; at most 50 | `[{path, dir}]` |
| `GET /ws` | WebSocket upgrade | events |

Errors share one shape, `{"error":{"code":"not_found","message":"…"}}`, with status 400, 403, 404, 409, 412, 413, 428 or 500. `ApiError` in `error.rs` maps each variant to one status.

**Save conflicts use a content version, not the modified time.** Modified times can miss two quick writes (a coarse kernel clock, FAT's 2-second resolution, seconds in JSON), and loading the source and its time in two requests could mismatch. The server hashes the content with `std::hash::DefaultHasher`. It already reads the old content to snapshot it, so the check costs nothing. The hash only has to match within one running server: `DefaultHasher` output may change between Rust releases, which at worst gives one spurious notice after an upgrade. A write in place by another program between the check and the server's own write is accepted: that text is lost, and the snapshot holds the content from before it. A new file renamed over the path in that time is seen just before the write, and the save gets 412. Saves within one mdame run one at a time, so two saves from the same version cannot both pass the check. Milestone 6 builds the check first as JSON fields (`version` and `base_version`, 409), then refactors it to `ETag`, `If-Match` and 412 as a learning step.

### WebSocket

Server to client only, JSON with a `type` field. The upgrade request passes the guard like any other: browsers always send `Origin` on a WebSocket handshake, so another site cannot connect. The server subscribes before the upgrade completes, and reads the socket only to notice a closed tab.

| Event | Fields | Browser reaction |
| --- | --- | --- |
| `changed` | `path` | If it is the open file or a folder holding it: refetch and morph; in the editor, compare the file with the editor's text (see Saving) |
| `created` | `path` | Refetch the tree; if it is the open file or a folder holding it, refetch the file too: a save through a temporary file and a rename arrives as `created` |
| `removed` | `path` | Refetch the tree; if it was the open file or a folder holding it, refetch the file, which shows not-found unless it is already back |
| `renamed` | `from`, `to` | Refetch the tree; if `from` was open, or a folder holding it, and the open file is gone, navigate to its new path (an editor that renames the file to a backup writes it again); if `to` is the open file or a folder holding it, refetch the file |
| `workspace` | `root` | Sent when a workspace opens: a tab still at the picker reloads the state and shows the workspace, at its start file when mdame was given one |
| `resync` | none | Sent after a burst or when the client lagged behind the broadcast; refetch everything visible |

Events go out as the watcher reports them, with no merging: a file deleted and written again arrives as `removed` then `created`, and an Emacs save as `renamed` to the backup then `created`. These can also be a folder swapped for another, so the browser tells them apart itself: on `removed` it asks for the open file again, and it follows a rename only when the open file is gone. The watcher does not follow symlinked folders: one that points out of the workspace would leak outside names in its events. notify still watches a folder that is replaced by a link right after its creation, so outside names can come through in that rare case. mdame accepts this: the names reach only your own page. Events carry no folder flag: notify reports a move out of the workspace with no file or folder kind, and the browser matches the open file by path prefix instead. Decided on 18 October 2026.

A new receiver only sees events sent after it subscribed, so the client waits for the socket to open (or fail) before its first request, reconnects with backoff (500 ms, doubling up to 10 s), and refetches what is visible after each reconnection. From a lost connection until `GET /api/state` shows the same workspace again, the page sends no other request: a mdame started meanwhile on another folder would take its writes into its own files. If the workspace changed, the page reloads. After any event, the browser gives each workspace `<img>` on screen a new `?v=<time>` query, so that it reloads. Later renders keep that version, so that a morph cannot restore the old URL.

## Rendering

All rendering happens in `render.rs`: one function takes a path and its contents and returns sanitized HTML. The view, the editor preview and revision views all call it, so they cannot disagree.

### By file type

| Extensions | Output |
| --- | --- |
| `.md`, `.markdown` | comrak, then ammonia |
| `.csv` | `<table>`, first row as header; rows may have different lengths |
| `.json`, `.yaml`, `.yml`, `.toml`, `.graphql`, `.gql`, `.txt` | `<pre><code class="language-…">`, escaped, with the lowercased extension as the language; Lezer colours it in the browser, and an unknown language (`txt`, and GraphQL, which language-data lacks) stays plain text |
| `.mmd` | `<pre class="mermaid">`, escaped |
| `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp` | `<img src="/raw/…">` |
| anything else | Not listed in the tree in v1 |

ammonia's parser slows down with the square of the nesting depth. A crafted file, such as 1 MB of `>`, can then render for hours and keep one core busy until mdame restarts. mdame accepts this risk: the file must be in a folder that you opened. A depth check and a limit of two renders at a time were removed on 20 October 2026, to keep the code simple. App ids and classes (`mdame-…`) are removed from rendered content.

Files over 1 MB return `too_large: true` and a short notice instead of HTML; up to 8 MB, they can still be opened in the editor. Images are never read, so the limit does not apply to them. Measured on 18 October 2026, release build: a 1 MB file of dense markdown (headings, lists, tables, links, code, raw HTML on every few lines) renders in 0.9 s, 0.2 s in comrak and 0.7 s in ammonia; 1 MB of plain prose takes 0.09 s. A debug build is about ten times slower.

### comrak options

- Extensions: tables, strikethrough, autolinks, task lists, footnotes, GitHub alerts (`extension.alerts`), and front matter with `---` as the delimiter (`extension.front_matter_delimiter`).
- Heading ids on, with no prefix: `extension.header_id_prefix = Some("".into())`, so table-of-contents links such as `#install` work.
- TOML front matter (`+++`) is not a comrak option: strip a leading `+++` block in `render.rs` before parsing.
- `options.render.r#unsafe = true` so raw HTML passes through to ammonia, which decides what stays. The field is named `unsafe`, a Rust keyword, so it is written as a raw identifier.
- `render.sourcepos = true`: each block carries `data-sourcepos="start:col-end:col"`, used for scroll sync.
- Fenced code keeps `class="language-…"`; the browser highlights it with the matching Lezer parser and turns `language-mermaid` blocks into diagrams.

### Sanitizing with ammonia

Start from `ammonia::Builder::default()` and widen it just enough:

- Allow `class` and `id` on all elements (highlighting, alerts, footnotes, heading ids) and `data-sourcepos`. Content ids stay unprefixed so footnote and heading links work. Collisions with the UI are avoided from the app's side: every app id starts with `mdame-`, and app code never reads elements through `window.<id>` named globals (DOM clobbering).
- Allow `input` with `checked` and `disabled` for task lists; `type="checkbox"` is forced, so any other input becomes a checkbox.
- Allow `section` and the `data-footnote*`, `data-heading-content` and `aria-label` attributes that comrak writes for footnotes and heading anchors.
- No `rel="noopener noreferrer"` on links (`link_rel(None)`): `target` is not allowed, and the page sends `Referrer-Policy: no-referrer`.
- Rewrite relative URLs with `UrlRelative::Custom`: resolve against the file's folder and prefix `/raw/`. Images then load from `/raw/…`; the page turns links to `/raw/…` into links to `/view/…` (ammonia cannot tell a link from an image when it rewrites URLs), so they open in the app, also in a new tab. A file of another type gets a page with a link to the raw file. A URL that starts with `/` resolves from the workspace root, as on GitHub, and `..` stops at the root. `//host/…` URLs are kept.
- Leave fragment-only links (`#install`, `#fn-1`) unchanged. ammonia passes them to the custom evaluator too, so the evaluator returns any URL starting with `#` as it is.
- Scripts, `on*` handlers, `javascript:` URLs, `<iframe>`, `<object>` and `<style>` are removed.

Insta snapshot tests pin the output of a fixture file for each type, including one for footnotes and in-page links.

### Editor preview and scroll sync

The editor posts its text to `POST /api/render` about 150 ms after typing stops. A tab runs one render at a time, and the newest text waits for it. The server cannot stop a render, and a crafted file can take an hour: without this rule, each typing pause could keep one more core busy. The preview morphs the result in with idiomorph, so scroll and Mermaid output survive.

Scroll sync maps the editor's top visible line to the rendered block whose `data-sourcepos` start line is the largest one not past it, and interpolates towards the next block. The reverse direction uses the same table. Expect around 50 lines of JS, kept free of DOM access so `bun test` can cover it.

### Code highlighting in rendered views

`web/src/codehl.ts` finds `code.language-x` blocks, matches `x` with `LanguageDescription.matchLanguageName` from `@codemirror/language-data`, awaits the language's `load()`, parses the text and writes spans with `highlightCode` and `classHighlighter`. These emit the same `tok-*` classes as the editor, so one set of theme colours serves both. Milestone 4 checks every listed type, in particular GraphQL and the languages that come through legacy modes.

### Themes in rendered content

A theme file sets the CSS variables used by `content.css` and the code colours, which apply to both the editor and rendered code. Its `color-scheme` also picks Mermaid's theme when the browser initialises Mermaid: `dark` for a dark scheme, `default` otherwise.

## Security

Only the mdame page itself, in a browser that holds the token, can reach the API; file access never leaves the workspace; workspace content never runs as script on mdame's origin. Build the guard in milestone 1, before any route that touches files.

The guard trusts origins, not code: any script running on a page at mdame's origin passes it. So the rule underneath every row below is that untrusted content never becomes a page on mdame's origin.

| Threat | Defence |
| --- | --- |
| A website in another tab calls the local API | No CORS layer at all. A middleware rejects any request whose `Origin` header is present and not mdame's own origin, and rejects WebSocket upgrades the same way. |
| DNS rebinding: a hostile domain resolving to 127.0.0.1 | The same middleware rejects requests whose `Host` is not `localhost`, `127.0.0.1`, `[::1]` or the bound address, with the right port. If mdame is bound to all interfaces (`0.0.0.0` or `::`), any `Host` with the right port passes, because the browser can name the machine by any address or hostname. The token is then the defence: a rebinding page has neither the token nor the cookie. |
| Another device on the network, or another program on this machine | A random token (see Token). The first request that carries it sets an HttpOnly, SameSite=Strict cookie with a Max-Age of 400 days, the most that browsers keep. Every later request needs that cookie or the token in the query. The cookie name contains the port, so that two mdame on one machine do not overwrite each other's cookie. The token is compared in constant time. mdame opens the browser at `http://127.0.0.1:<port>/?c=<code>`, and prints a URL with a second code. A code stands for the token once: other accounts can read the browser's command line with `ps`, and a click on a printed URL in a terminal may start a browser too. The opened code works within a minute, the printed one within ten. A code that works answers with the cookie and a redirect to the same page without the code, so a reload never sends it again. A code that comes back was used by someone else first. mdame then makes a new token, keeps it, prints a new URL with a new code, and closes the WebSockets of the old token. Without a display, as over SSH, mdame opens no browser. Beyond loopback, other devices need the token, so mdame prints `http://<address>:<port>/?t=<token>`. Open it on another device: a click on it here puts the token on a command line. On 0.0.0.0 and ::, which name no address that another device can use, mdame prints the URL with a code for this machine. A second line, `http://<this machine>:<port>/?t=<token>`, is for other devices. On a machine with other accounts, mount `/proc` with `hidepid=invisible`, so that they cannot read command lines at all. |
| A program on this machine that is built to attack mdame | Out of scope. Such a program can take the port while mdame is stopped, and then get the cookie and the unsaved text of the open tabs. It can also serve a page on another port of 127.0.0.1: if the browser opens it, it gets the cookie, since browsers send cookies to every port of a host. If you suspect it, delete the token file: every browser then needs the URL that mdame prints. |
| Path traversal or symlink escape | All workspace file access goes through a cap-std `Dir` opened on the root. No `std::fs` call takes a client-supplied path. |
| Symlinks inside the workspace | Symlinked files that resolve inside the root open normally; a symlink with an absolute target is always an error in cap-std, even one pointing inside. The tree walker does not descend into symlinked directories in v1. |
| Script in a markdown file, possibly agent-written | ammonia strips scripts, handlers and `javascript:` URLs before HTML leaves the server. |
| A workspace `.html` or `.svg` opened through `/raw` runs script on mdame's origin, which passes the guard | Two layers. `/raw` serves images with their own type and everything else as `text/plain; charset=utf-8`, so no page exists. Every file that `/raw` serves also carries `Content-Security-Policy: sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'` and `X-Content-Type-Options: nosniff`: a sandboxed document gets an opaque origin, so its requests carry `Origin: null` (rejected by the guard) and no cookie. |
| Mermaid diagram text, possibly agent-written | `mermaid.initialize` sets `securityLevel: 'strict'` explicitly (also Mermaid's default), never `'loose'`. |
| Further defence for the page | `Content-Security-Policy: default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; frame-src 'none'; object-src 'none'; frame-ancestors 'none'` (Mermaid needs inline styles; `default-src` does not cover framing, so another site could otherwise load the page in an iframe and trick clicks; the page itself needs no frame and no object), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`. Remote `https:` images are allowed so README badges show, as on GitHub; scripts, styles and connections stay `'self'`. `/api` and `/raw` answers carry `Cache-Control: no-store`: a file may be private, and the browser's cache outlives the tab. |
| JSON endpoints called by plain HTML forms | Handlers that change state accept only `application/json`, which a form cannot send without triggering the Origin check. |

The workspace picker and `/api/complete` list paths outside the workspace by design. They sit behind the same guard and only reveal names, not contents.

**Programs on this machine.** Any program on the machine can reach the loopback port, even one in a sandbox that cannot write the files itself: a Flatpak app with network access, a container on the host network, a coding agent. Without the token, such a program could write any file through mdame, and open any folder while the picker shows. The token stops it only if the sandbox also keeps it from reading the token. Coding-agent sandboxes often limit writes but not reads. Deny the agent reads of mdame's state folder, which holds the token, and of the browser profile, whose cookies hold it too. Also give it a PID namespace of its own, which hides your other processes from it. The code in the URL that mdame opens is on the browser launcher's command line for a moment, and `hidepid` hides only the processes of other accounts. The editor's routes also open, save and create only the text types that the view shows, and no hidden file or file in a hidden folder, such as `.git`, `.mdame` or `.claude`, through a symbolic link either (a hard link is the same file under a second name, which mdame cannot tell from the first): a leaked token cannot rewrite `.git/config`, an agent's settings, a `Makefile` or a snapshot. It can still rewrite a data file that runs commands, such as `package.json` or `mise.toml`. The picker also refuses to open a hidden folder as the workspace; the command line still may.

Tests cover each row: a request with a foreign `Origin`, a wrong `Host`, a missing token, on loopback too, a `../` path, a symlink pointing out of the workspace, an in-workspace symlinked file, and an `.html` and an `.svg` under `/raw` returning `sandbox` (and `text/plain` for the `.html`). The guard rows land in milestone 1, the rest with their routes.

## On-disk formats

mdame keeps its own files and imports nothing from mdlive, so it starts with no revisions or recents. The layouts follow mdlive v2.3.13, checked against `handlers/api.rs` and `config.rs`, except where noted.

**Revision snapshots.** Before a save overwrites a file, its previous content is copied to `<history root>/<relative path>/<unix milliseconds>.<original extension>`. Example: saving `api/rate-limiting.md` writes `api/rate-limiting.md/1771271566123.md` under the history root. The relative path is where the file really is: a link or a `..` in the path asked does not split the revisions of one file. The snapshot is opened with `OpenOptions::create_new`, so it never overwrites one that exists; on `AlreadyExists`, add 1 ms and retry. Its mode is 0600, since the file it copies may be private. After the save writes the file, mdame keeps the newest 20 snapshots of that file (`snapshots_per_file`), by the time in their name, and deletes the rest. A name dated after now, from a clock that was ahead, counts as the oldest: the list shows it last, and pruning deletes it first. Pruning always keeps the snapshot that the save just made, unless `snapshots_per_file` is 0: after a collision, its name can be ahead of the clock. Pruning waits for the write: with `snapshots_per_file = 0`, the snapshot still covers a crash during the write. It ignores snapshots already gone, and deletes no folder, no link, and no file whose name is not a snapshot's. A link at `.mdame` or `.mdame/history` stops the save: pruning through it could delete files of the workspace. If it fails, mdame logs a warning, and the save still succeeds. A test checks that two quick saves give two snapshots. An empty file gets no snapshot: writing over it loses nothing. A save of the text already on disk writes nothing and makes no snapshot, so a habit of pressing Ctrl+S does not push the real revisions out.

**History location.** The global `history` setting in `config.toml` picks the history root:

- `workspace` (default): `<workspace>/.mdame/history/`. When mdame creates `.mdame/`, it makes it 0700, since its folders follow the workspace's file names, and it writes `.mdame/.gitignore` containing `*`, so git, the `ignore` walker, ripgrep and agents skip it with no change to the user's own `.gitignore`.
- `state`: `~/.local/state/mdame/<encoded path>/history/`, where the encoded path is the workspace's absolute path with every non-alphanumeric character replaced by `-` (Claude Code's convention, for example `-home-kamal-dev-github-mdame`). Nothing is created in the workspace. Two paths can encode the same (`/a/b-c`, `/a-b/c`); accepted, and they share one history. When a workspace opens in `state` mode, mdame warns if a recent workspace encodes the same. Renaming a folder orphans its history.
- Switching mode does not move old snapshots; the README says so.

**First start.** While `history` is missing from `config.toml`, `GET /api/state` returns `needs_setup: true` and the page shows a native `<dialog>` explaining both choices, with `workspace` preselected. Continue or Esc saves the choice through `PUT /api/settings`, which takes the write lock on `config` and writes `config.toml` with a temporary file and a rename. The server treats a missing field as `workspace`.

**Watcher and tree.** `.mdame/` is never shown in the tree and its events are ignored, so snapshots never trigger `changed`.

**Config.** `~/.config/mdame/config.toml` (or under `$XDG_CONFIG_HOME`) holds what the user chooses. mdame writes it only when a setting is saved from the page, with a temporary file and a rename. If the file is not valid, or has an unknown key such as a misspelled one, mdame stops at start with the error: a later save would otherwise replace the user's settings with the defaults. All fields are optional:

```toml
snapshots_per_file = 20
history = "workspace"     # or "state"; asked on first start
```

**Recents.** `~/.local/state/mdame/recents.toml` (or under `$XDG_STATE_HOME`) holds what mdame remembers: up to 25 workspaces, written with a temporary file and a rename. They are state, not config: opening a workspace never rewrites `config.toml`, so a dotfiles repo that tracks `~/.config` stays clean.

```toml
[[recent]]
path = "/Users/me/notes"
last_opened_secs = 1771273728
```

mdlive's `last_workspaces` and `last_browse_dir` are not carried over.

**Token.** On loopback, mdame keeps the token in `<state folder>/token`, mode 0600, so that the cookie of a tab or a bookmark still works after a restart. The first start makes the file. A token file that others can read, or that holds no token, gives a warning, and the token then lasts one run: delete the file to fix it. Deleting the file also locks every browser out, from the next start on. Beyond loopback, the token is new at each start, since its URL goes to other devices. mdame makes the state folder 0700 before it writes the token, the recents or a `state`-mode snapshot there: the token opens mdame, the recents name the opened folders, and the history follows the workspace's file names. If it cannot, the token lasts one run, the recents are not saved, and a `state`-mode save fails.

**User themes.** Any `~/.config/mdame/themes/<name>.css` appears in the theme picker as `<name>`, after the built-ins. A user file with a built-in's name overrides it.

**Browser-only preferences** such as sidebar width and open folders live in `localStorage` (see Front end). `.mdlive/tabs.json` belongs to the Later tabs feature.

## Front end and design

The front end is a small single-page app in TypeScript ES modules, bundled into `web/dist` (see Tooling). This section fixes the structure and the theme contract and records the owner's design decisions. The wireframes are in [mdame wireframes](https://claude.ai/artifact/N8wsSPTuHm3gvC3PnnWxwj).

### Structure

- `main.ts` reads `/api/state`, routes on the URL (`/` picker, `/view/<path>`, `/edit/<path>`), wires the WebSocket, and shows the first-start dialog when `needs_setup` is true.
- `api.ts` is the only module that calls `fetch`; it turns error bodies into exceptions with a code.
- Each screen module exports `mount(el, params)` and `unmount()`; state lives in plain objects, and changes re-render or morph only the affected region.
- Preferences that belong to one browser (sidebar width, open folders, preview visibility, split position, theme) go in `localStorage`, wrapped in try/catch, with every key prefixed `mdame:` so they never meet mdlive's keys on the same port.
- App element ids start with `mdame-`; no code reads elements through `window.<id>` globals.
- Logic with no DOM access (scroll-sync mapping, key rules, error mapping) lives in its own functions so `bun test` can cover it.

### Screens and regions

| Screen | Contents |
| --- | --- |
| Picker | Path field with autocomplete, recent workspaces with a filter, error line |
| View | Sidebar (filter, sort, tree), rendered content, status bar (path, modified time, actions) |
| Editor | Same frame; content area splits into CodeMirror and preview, with a divider; status bar gains unsaved dot and Save |
| Revisions | Inline diff in the editor (CodeMirror merge view) against a revision picked from a list, with Restore |
| Empty and not found | One line saying what happened and one action |
| Dialogs | Native `<dialog>` for confirm, name input, the first-start history choice and the shortcut help. Toasts are a Later item |

### Keyboard

| Key | Action |
| --- | --- |
| `e` | Edit current file |
| `Esc` | Close editor, panel or dialog |
| `Cmd/Ctrl+S` | Save |
| `Cmd/Ctrl+B`, `Cmd/Ctrl+I` | Bold, italic in the editor |
| `b` | Hide or show sidebar |
| `/` | Focus the sidebar filter |
| `h`, `r` | Revisions (diff in the editor) |

Shortcuts are ignored while typing in an input or CodeMirror, and when a modifier other than the listed ones is held. `keys.ts` implements this as one `keydown` listener and a map from key to handler. Esc and Cmd/Ctrl+S have their own listeners, since they must work inside CodeMirror: CodeMirror uses Esc first, to clear a selection or to close its search panel or completion list. Otherwise Esc closes the revisions panel first, then the editor, unless a dialog or the sidebar overlay is open. Cmd/Ctrl+S saves from anywhere on the page.

### Theme contract

A theme is one CSS file that sets variables on `:root` and nothing else. The app's own CSS, including `content.css`, uses only these variables, so any theme works with any version of the layout.

- **Surfaces and text:** `--bg`, `--bg-raised`, `--bg-sunken`, `--fg`, `--fg-muted`, `--border`, `--selection`.
- **Meaning:** `--accent`, `--accent-fg`, `--danger`, `--warning`, `--success`.
- **Type:** `--font-ui`, `--font-content`, `--font-mono`, `--content-width`, `--content-width-mono`. `--content-width-mono` is for the mono toggle, a Later item.
- **Code colours**, for the editor and rendered code alike through Lezer's `tok-*` classes: `--code-bg`, `--hl-keyword`, `--hl-string`, `--hl-number`, `--hl-comment`, `--hl-title`, `--hl-type`, `--hl-attr`, `--hl-meta`.
- `color-scheme: light` or `dark`, a standard CSS property. mdame loads the built-in theme of that scheme first, then the theme over it, so a user theme may set only the variables that it changes. Browsers also draw scrollbars and form controls to match.

The diff's added and removed lines mix `--success` and `--danger` into the background, so themes set no diff colours. Shadows and backdrops stay translucent black, outside the contract.

The list was fixed on 28 October 2026. Milestone 8 documents it in `web/themes/README.md` with a commented template, because that file is what issue #15 users will copy.

### Design decisions

- Overall feel: a mix. Compact chrome, like a quiet tool next to a terminal, around a reading-first content column (measure and type).
- Sidebar: docked on wide windows, an overlay below about 900 px (opened with `b`). Width 180–480 px, default 260 px. Details decided on 18 October 2026:
  - At first load, only the folders on the path to the current file are open. Open folders are remembered per workspace (the `localStorage` key holds the root).
  - One sort button cycles name A→Z, name Z→A, newest first, oldest first; its icon shows the current order. Folders always come first, and a folder's date is its newest file. The choice is remembered.
  - Clicking a file goes to `/view/<path>`. Icons: one per family (markdown and text, image, CSV, data files, Mermaid).
  - The filter matches file names with `@leeoniya/ufuzzy` and shows a flat list, matched letters in bold, folder in grey. ↑↓ choose (no row is highlighted until then), Enter opens the chosen result or else the first one (unlike the picker, a wrong open here costs one click), Esc clears the field and then leaves it.
  - Hover action in milestone 3: copy path. "New file in this folder" comes in milestone 6, with `POST /api/file`.
- File header: none. Path, modified time and the actions (edit, copy raw, copy path, revisions) live in the status bar; content starts at the top edge.
- Editor: preview on the right, 50/50 by default, draggable divider, scroll sync.
- Revisions: inline diff in the editor (CodeMirror merge view) against a revision picked from a list. `h` or `r` in view mode opens the editor in diff mode.
- Picker: one centred path field with autocomplete; recents appear as suggestions in its dropdown. Details decided on 18 October 2026:
  - An empty field lists the recents, newest first. While you type, the recents that contain the typed text come first, tagged "recent", then the `/api/complete` results; a path shows once.
  - Paths under the home folder show as `~/…`. Each row has an icon: folder, file, or recent.
  - No row is highlighted until you press ↑ or ↓, so Enter never opens a row you did not choose: Enter opens the highlighted row, or else the text in the field. Tab puts the highlighted row, or else the first row, in the field. Esc closes the list. Changed on 18 October 2026 from "the first row is highlighted": one open per launch makes a surprise open costly.
  - An error line under the field shows the API message until the next key press.
  - After an open, the page shows the workspace; with a starting file, the URL becomes `/view/<file>`.
- Typography: IBM Plex Sans for UI and content, IBM Plex Mono for code, content width 60ch. The mono toggle (Later) will set the content in Plex Mono at 72ch. Fonts are bundled as woff2 (OFL). Decided 28 October 2026.
- Theme picker: a theme button in the status bar opens a menu: System, Light, Dark, then the user themes. The choice lives in `localStorage`, per browser. Decided 28 October 2026.
- Icons: Lucide, only the icons used, bundled as SVG; tooltips give the label and shortcut.
- Motion: one transition. Panels and the sidebar overlay slide in over 150 ms; nothing moves under `prefers-reduced-motion`.
- Default theme: follow the system. Until the user picks a theme, the page uses the built-in light or dark theme according to `prefers-color-scheme`, and switches live when the OS does; a picked theme is stored and wins. Decided 15 October 2026.
- Built-in themes: GitHub Primer light and dark, from `@primer/primitives` (11.10.0 checked), copied into `web/themes/light.css` and `dark.css`. Chosen for the highest text and muted contrast of the families compared (body text 15.8:1 light, 17.4:1 dark; muted 6.1 and 6.5) and for the look most people know from rendered markdown. Primer has no number, type or attribute syntax colours, so mdame maps them: number uses constant, type and meta use variable, attribute uses entityTag. Decided 15 October 2026.
- Alternative themes come later (see Later): Catppuccin and Minimal, the latter with Primer's code colours.

Process: the low-fidelity wireframes of the picker, view and editor were signed off on 15 October 2026 and are adjusted during testing if needed; the theme pass comes in milestone 8, when every screen exists.

## Tooling

mise manages the repo. `mise.toml` pins the tools (Rust toolchain, Bun) and defines the tasks:

| Task | Does |
| --- | --- |
| `web` | `bun ci` (frozen lockfile), then bundle `web/src` into `web/dist`. `web/notices.ts` then writes `web/dist/THIRD-PARTY-LICENSES.txt` from the bundle's metafile: for each npm package in the bundle, its licence files, its NOTICE file, and its source URL. A package with no licence file stops the task |
| `dev` | The bundler in watch mode in the background, plus `cargo run`. The Rust server is restarted by hand and the browser refreshed by hand; in debug builds rust-embed reads `web/dist` from disk on each request |
| `fmt` | `cargo fmt` |
| `lint` | `cargo clippy -- -D warnings` |
| `test` | `cargo test` and `bun test` |
| `check-dist` | `mise run web`, then fails if `git status --porcelain -- web/dist` lists anything: a stale committed bundle. `git diff` alone misses new, untracked chunk files |

**No Node.** Bun is the package manager: `package.json`, a committed text `bun.lock`, and `bunfig.toml` with `linker = "hoisted"`, so there is one flat `node_modules/` (git-ignored) and a single copy of `@codemirror/state`, checked with `bun pm ls` (and `bun dedupe` if needed). Dependency install scripts stay off, which is Bun's default. `bun audit` and `bun outdated` cover maintenance; Renovate understands `bun.lock`.

**Bundler.** Bun's own bundler (`bun build`, ESM output, `--splitting` for Mermaid's and language-data's lazy chunks, `--minify`). Its output is reproducible, which `check-dist` depends on. Checked on 17 October 2026 with Bun 1.4.3: a test entry that imports codemirror, lang-markdown, language-data and Mermaid built 203 identical files (7.1 MB) in three directories, one of them installed fresh with `bun ci`. The output held no absolute paths, and `node_modules/` held one copy of `@codemirror/state`. If a later Bun breaks this, esbuild, installed through Bun as a devDependency, becomes the bundler, and only the `web` and `dev` tasks change.

**Users need only Rust.** `web/dist` is committed, so `cargo install mdame` never runs Bun or esbuild.

## What to reuse from mdlive

Reuse mdlive's tests, formats and a few small functions; replace everything else. Clone v2.3.13 next to the new repo for reference. Any copied code keeps the MIT notice of mdlive and mdserve.

| From mdlive | Use it as | Where it goes |
| --- | --- | --- |
| `tests/websocket_test.rs` | Specification for the watcher: vim-style rename saves, delete-then-create, folder moves | `tests/watch.rs`, ported to the new events |
| `tests/api_test.rs`, `tests/workspace_test.rs` | Cases for path validation, create and save, switching | route tests |
| `.mdlive/history` layout, prune-to-20 | Same layout under the history root, millisecond names, same default | `history.rs` |
| `config.toml` recents | `[[recent]]` entries with `path` and `last_opened_secs`, in `recents.toml` in the state folder | `config.rs` |
| `expand_path` in `handlers/workspace.rs` | `~` expansion for the picker | `workspace.rs` |
| `csv_to_html` in `state.rs` | Starting point for CSV tables | `render.rs` |
| The 1 MB guard and its message | Same limit | `render.rs` |
| Catppuccin and light/dark variables in `templates/main.html` | Not needed: the built-ins come from current Primer and Catppuccin from its official palette. mdlive's light and dark were an earlier Primer palette | — |
| Mermaid theme mapping in `templates/main.html` | Which themes need `dark` | theme files |
| `docs/images/*.png` | Visual reference of the old UI during design | not shipped |

**Not reused:** `templates/main.html` as code, the launcher and handoff logic in `main.rs` and `lib.rs`, `state.rs`'s pre-rendered cache and global mutex, path checks in `handlers/api.rs` (cap-std replaces them), `watcher.rs`'s event handling (the debouncer replaces it, its tests stay), and all of `src-tauri/`.

## Testing

Rust tests carry the weight. The front end gets `bun test` unit tests for its pure modules, plus a short manual checklist per milestone rather than a browser test suite in v1.

Each test states one rule, and its name is that rule. The rules are:

- **One home per rule.** A rule is tested at the lowest layer that sees it with the real parts: real files in a tempdir, the real router. No mocks. Higher layers test only the wiring: that a route calls the logic, and that each kind of error gets its status, once.
- **Overlap needs a reason.** Two tests of one rule are allowed only if they check different things, and a comment says what. Example: unit tests own the mapping of notify events; watcher tests prove that the OS sends those events.
- **A rule that holds for every route is one matrix test.** Routes × inputs → status. A new route adds a row, not new tests.
- **The oracle follows the input space.** Few inputs: a table of examples. Many inputs (paths, URLs, encodings): a property test, with `proptest` or `fast-check`. Large output: an insta snapshot, but never as the only check of a security rule.
- **Decisions live in pure functions.** The code that touches the DOM, the files or the network stays thin. Integration tests or the manual checklist cover it.
- **A test stays only if it can fail for a reason that no other test catches.** A bug fix adds a regression test only if no test caught the bug. Libraries are not tested, except for a non-obvious behaviour that mdame relies on.
- **Mutation testing measures the suite.** At the end of each milestone, `cargo mutants` runs. A surviving mutant is a rule with no test, or dead code.
- **The suite stays under 10 s.** Only the watcher and WebSocket tests depend on time.

| Layer | How | Covers |
| --- | --- | --- |
| Unit | `#[cfg(test)]` modules | tree building, path expansion, path encoding for the state folder, pruning, front matter stripping, port fallback |
| Rendering | insta snapshots of fixture files in `tests/fixtures/`, plus explicit checks for sanitizing | every file type, alerts, footnotes and in-page links, heading ids, task lists, sanitizing (a fixture full of hostile HTML), relative URL rewriting |
| Routes | build the router with a tempdir workspace, call it with `tower::ServiceExt::oneshot` | every route's success and error codes, the security rows as matrix tests, 412 on a stale save and 428 without `If-Match`, `/raw` headers |
| History | tempdir workspace and state folder | two quick saves give two snapshots, pruning, both history locations, `.mdame/.gitignore` |
| Watcher | real files in a tempdir, wait for events with a timeout | the cases ported from mdlive's `websocket_test.rs`, the burst rule |
| WebSocket | a test client against a bound server | events arrive with relative paths; `resync` after lag |
| Front-end unit | `bun test` on modules with no DOM | scroll-sync line-to-block mapping and interpolation, the key-map rules (ignore while typing, modifiers), API error mapping, what the page does for each live event |

Watcher tests are timing-sensitive: use generous timeouts (2 s) and assert on the set of events, not their exact order. CI on Linux runs `mise run fmt`, `lint`, `test` and `check-dist`.

## Build order

Ten milestones for v1, the version for a Show HN, then an eleventh, each ending in something the owner can run, with a review before the next starts. The wireframes were signed off on 15 October 2026.

1. **Skeleton.** clap flags, tracing, `AppState`, port fallback, security guard, rust-embed serving `web/dist`, `mise.toml` with tools and tasks, Bun install and the bundler reproducibility check (Bun, else esbuild), `open` on start, a page that shows `/api/state`.
   - Done when: guard tests pass (foreign Origin, wrong Host, missing token on 0.0.0.0), the bundler choice is settled, and `mdame` opens a page.
   - Rust focus: axum extractors and middleware, `Arc` state, `thiserror`.
2. **Workspaces.** Config read and write (atomic), recents, `POST /api/workspace`, `/api/complete`, `mdame <file>` and `<folder>`, picker screen, first-start history dialog (`needs_setup`, `PUT /api/settings`).
   - Done when: a folder opens from the picker and from the command line, recents persist, and the history choice is asked once.
   - Rust focus: cap-std `Dir`, shared state behind `RwLock`, serde.
3. **Sidebar.** `/api/tree` via the ignore walker; tree UI with open-folder memory, resize, hide, fuzzy filter, sort, icons, the copy-path hover action.
   - Done when: a repo with `node_modules` shows only tracked content and the filter finds files by fuzzy name.
4. **Viewing.** `render.rs` for every file type, ammonia rules, `/raw` with its headers, `/api/file`, Lezer highlighting with a fixture per listed type (check GraphQL and legacy-mode languages), Mermaid, copy buttons, not-found and empty pages, copy content and path. Time the 1 MB fixture.
   - Done when: insta snapshots cover each fixture and the hostile-HTML fixture renders inert.
5. **Live updates.** Debouncer, event mapping, burst rule, `/ws`, idiomorph patching, tree refresh, rename following, image refresh, `resync`.
   - Done when: the ported mdlive watcher cases pass and editing in vim updates the page without losing scroll.
   - Rust focus: threads to tokio channels, `broadcast` and lag handling.
6. **Editor.** CodeMirror setup, split and divider, `/api/source`, preview through `/api/render`, scroll sync, save with snapshot and the content-version check, keyboard map, unsaved guard, changed-on-disk notice, new file in folder.
   - Done when: a save made while the file changed on disk shows the notice instead of overwriting, first with JSON version fields and 409, then refactored to `ETag`, `If-Match` and 412.
7. **Revisions.** History list, merge view against a snapshot, restore, pruning; opened from view and editor.
   - Done when: restore is undoable from the panel.
8. **Themes and polish.** Theme contract fixed, light and dark built-ins, user themes folder, picker UI, status bar, dialogs, `--no-open`, a first README with attribution and licence notes, CI on GitHub Actions.
   - Done when: a user theme dropped into `~/.config/mdame/themes/` appears in the picker without a restart.
9. **Agent workflow.** Agent folders in the tree, handoff, what changed, full-text search, copy as quote, clickable task lists, content width and font size, shortcut help, the agent snippet and skill.
   - Done when: a plan that an agent writes under `.claude/plans` shows in the tree, `mdame <that file>` from another terminal opens it in the running tab, and the blocks that the agent rewrites glow.
10. **Release.** Editing on macOS, CI on a macOS runner, release binaries through cargo-dist, release 0.1.0 of the crate on crates.io, and the README with a demo of the agent loop and an honest comparison. Then the Show HN.
   - Done when: the install script and `brew install` give a working mdame on Linux and macOS.
11. **Small Later items.** About, custom key bindings, the Catppuccin and Minimal themes, new file with `n`, side-by-side diff, vim key bindings, a print stylesheet, word count, read-only mode, the mono toggle, toasts.

After milestone 11, the medium and large Later items wait; tabs need their own design round.

## Open decisions

- **Upstream report.** Decided 15 October 2026, to do later and independent of the milestones: confirm the CORS finding locally (mdlive on 4891, a page on another port whose `fetch` reads a file), check whether mdserve shares it, then report privately through GitHub's "Report a vulnerability" (or ask for a private contact in an issue without details), with the reproduction and a suggested fix, and allow about 90 days before any public mention.
- **Theme details.** The exact Primer value of each contract variable, at the theme pass in milestone 8. The list itself was fixed on 28 October 2026.
- **Settled in milestone 5:** notify-debouncer-full 0.7 pairs the two halves of a rename on inotify, for files and folders (`tests/watch.rs`).
- **Settled in milestone 4:** legacy modes such as TOML highlight through `highlightCode`; `@codemirror/language-data` has no GraphQL, so `.graphql` and `.gql` stay plain text (adding `cm6-graphql`, about 1 MB, was rejected on 18 October 2026).

## Decided

| Decision | Date |
| --- | --- |
| Name: `mdame` (say it *Madame*) for the crate and the binary; `mdlive` stays upstream's name | 10 October 2026 |
| Own files in `.mdame/`, `~/.config/mdame/` and `~/.local/state/mdame/`; no import from mdlive | 10 October 2026 |
| Default port 4891, with fallback to the next free port | 10 October 2026 |
| One server serves one workspace; tabs show different files of it; another workspace means another launch | 10 October 2026 |
| Workspace switching deferred to Later | 10 October 2026 |
| Revisions as an inline diff in the editor (`@codemirror/merge`); `similar` dropped | 10 October 2026 |
| Config fields of other apps need no preserving: mdame writes its own `config.toml` | 10 October 2026 |
| Architecture, API, protocol and libraries signed off; see the review log | 14 October 2026 |
| Security model signed off, with security reviews during the build | 15 October 2026 |
| Wireframes signed off, to adjust during testing | 15 October 2026 |
| Upstream advisory: confirm locally, then report privately (later) | 15 October 2026 |
| Default theme follows the system; built-ins are GitHub Primer light and dark; Catppuccin and Minimal later | 15 October 2026 |
| Token from getrandom; when bound to all interfaces, the token replaces the `Host` list | 17 October 2026 |
| Bun is the bundler: its output is reproducible | 17 October 2026 |
| Recents move from `config.toml` to `recents.toml` in the state folder: they are state, and `config.toml` stays the user's | 18 October 2026 |
| An invalid `config.toml` stops mdame at start | 18 October 2026 |
| Tree: nested JSON, viewable files only, `.gitignore` applied without git, folder date from its newest file | 18 October 2026 |
| Sidebar key `b` instead of `k`: a memory hook (VS Code's Ctrl+B), works on every layout, and leaves `j`/`k` free for scrolling | 18 October 2026 |
| `mdame <file>` opens the file's folder with that file first, not the file alone | 18 October 2026 |
| Testing rules: one home per rule, matrix tests for rules that hold for every route, property tests, mutation testing per milestone; no list of invariants beside the test names | 20 October 2026 |
| A token on loopback too, kept in a 0600 file and a 400-day cookie: a sandboxed program that shares the network could otherwise write any file through mdame | 23 October 2026 |
| Reviews count a program on this machine only when it lacks the token. A program built to attack mdame is out of scope: one that takes the port after mdame stops, or that serves a page on another port of the same host. Defending against it cost too much: tabs that die at each restart, preferences that reset, and URLs that cannot be typed or bookmarked | 25 October 2026 |
| CI on GitHub Actions: fmt, clippy, tests and `check-dist` | 28 October 2026 |
| Licence: MIT, as mdlive and mdserve. `LICENSE` keeps mdlive's copyright lines, for the parts that mdame ported | 28 October 2026 |
| Milestone 9 takes the small Later items; the medium and large ones wait | 28 October 2026 |
| v1 is the version for a Show HN. It gains agent folders (view-only), handoff, what changed, full-text search, copy as quote, clickable task lists, width and font size, shortcut help, an agent snippet, macOS support and release binaries. Toasts and the mono toggle move to Later. Milestones 9 and 10 are new; the small Later items become milestone 11 | 29 October 2026 |
| Themes: the choice lives in `localStorage`, and `theme` leaves `config.toml`. A theme's `color-scheme` picks the built-in loaded under it and Mermaid's theme. Diff colours derive from `--success` and `--danger`. A status bar menu picks the theme. IBM Plex is bundled. Shadows stay outside the contract | 28 October 2026 |

### Review log, 14 October 2026

- Workspace state: `std::sync::RwLock<Option<Arc<Workspace>>>` behind one accessor, `AppState::workspace()`.
- Two launches on one workspace allowed, with atomic config writes; detection added to Later.
- "Daemon mode" dropped from the wording; localStorage keys prefixed `mdame:`.
- Broadcast capacity 256; a batch over 100 events sends one `resync`. No render cache; render time logged.
- `src/lib.rs` plus a thin `main.rs`; core file module named `document.rs`; `api.rs` instead of `mod.rs`.
- Save conflicts by content hash: `GET /api/source`, `ETag` and `If-Match`, 412, 428 without `If-Match`; built first as JSON fields with 409. `POST /api/workspace` keeps 409; the `workspace` event stays.
- Heading ids on; fragment links never rewritten; app ids prefixed `mdame-`.
- `/raw`: images with their type, everything else as `text/plain`, every response sandboxed. Mermaid `securityLevel: 'strict'`. Remote `https:` images allowed. In-workspace file symlinks work; symlinked folders are not walked.
- History location `workspace` (with `.mdame/.gitignore`) or `state` (`~/.local/state/mdame/<encoded path>/`), asked on first start. Snapshot names in milliseconds with `create_new`.
- CI `check-dist` task; `mise run dev` is watch mode plus manual restarts.
- "No npm and no Node" became "No Node": Bun as package manager, and as bundler if its output is reproducible, else esbuild. Reason: hand-vendoring CodeMirror's ~20 packages without a lockfile duplicated `@codemirror/state`.
- highlight.js replaced by `@lezer/highlight`. Written ourselves: config and state paths (etcetera), the key map (tinykeys), `content.css` (github-markdown-css). anyhow dropped. `bun test` for pure front-end modules.

## Conventions for the Claude Code session

- This file is the spec. Update it in the same commit as any decision change.
- Start `CLAUDE.md` with: build and test commands, the module map from Repository layout, the security rules, and these conventions.
- The owner leads. Propose designs and explain trade-offs and Rust idioms; write code in small, reviewable steps, one milestone per branch.
- No new dependency without the owner's approval and a line in Libraries.
- Every route lands with its tests; every rendering change updates insta snapshots deliberately, not with a blanket accept.
- `cargo fmt`, `cargo clippy -- -D warnings` and `cargo test` pass before each commit.
- Keep modules small and single-purpose; if a file passes about 400 lines, discuss a split.
- Never use `std::fs` with a path that came from a request; go through the workspace `Dir`.
