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
- **What the browser or the terminal already does, mdame does not rebuild.** Browser tabs are the tabs, and browser zoom is the font size. Find and print come from the browser. Renames, moves, deletes and git happen in the terminal, and mdame follows them. Decided on 3 November 2026.
- **Learning first.** Code is idiomatic and explained; no clever abstractions the owner hasn't chosen.

## Feature scope

v1 is the owner's Keep list from the feature checklist, plus a few nearly free items promoted from Later and a few simplifications agreed afterwards.

### v1

**Launching.** `mdame <folder>` opens that folder, and `mdame <file>` opens its folder with that file shown first. `mdame` with no path opens the current folder. One workspace per launch. Flags: `-H` bind address, `-p` port with fallback to the next free one, `--no-open`, `-v` verbose logging. Opens the browser on start. Ships as a single binary with all assets embedded.

**Viewing.** GitHub-flavoured markdown, raw HTML (sanitized), front matter hidden, highlighted code blocks with a copy button, Mermaid in fenced blocks and `.mmd` files, images from the workspace, text, JSON, YAML and TOML shown highlighted, GraphQL as plain text, CSV as a table, a 1 MB render guard, a not-found page and an empty-workspace page. Find in page uses the browser's own Cmd/Ctrl+F. An outline beside the content lists the headings of the file.

**Live updates.** Content updates in place when a file changes, new and removed files and folders show in the sidebar, editors' save-by-rename is handled, images refresh, scroll position is kept, the current view follows a rename, and the editor shows a "changed on disk" notice.

**Sidebar.** Collapsible folder tree with remembered open folders, drag to resize, hide/show with `b`, fuzzy filter with `/`, sort by name or modified in either direction, current file highlighted, file-type icons. Row hover buttons: new file in this folder, copy path.

**Status bar actions.** Edit, copy raw content, copy path, revisions.

**Editor.** CodeMirror 6 with markdown highlighting, opened with `e`. Split view with draggable divider, show/hide preview, line numbers, scroll sync, Cmd/Ctrl+S and a Save button, Esc to close, Cmd/Ctrl+B and I, Tab inserts two spaces, unsaved dot and leave-page warning, last-modified time in the status bar. The browser's spellcheck, with a toggle.

**Revisions.** Snapshot on every save that changes the file. `h` or `r` from view or editor opens the editor in diff mode: an inline diff against a revision picked from a list, then restore (snapshots the current version first, so it is undoable). Automatic pruning to the last N snapshots per file.

**Look and feel.** A View options menu: the theme (built-in light and dark, plus any user theme in `~/.config/mdame/themes/`), the content width, and the toggles of the outline and of the spellcheck. A shortcut help dialog (`?`), with a footer line for the version and links. Status bar (workspace, file, edit mode, version, file actions), dialogs on the native `<dialog>` element.

**Agent workflow.** Added on 29 October 2026 so that v1 is ready for a Show HN, and settled on 3 November 2026:

- The tree shows every markdown file in hidden folders, at any depth. Agents write their plans and specs there, under `.claude`, `.kiro`, `.cursor` or `.github`. The editor edits them too. Other types in hidden folders stay hidden, and `.git` and `.mdame` stay out.
- Changes: the status bar lists the markdown files that changed on disk while the tab was open, so the file that an agent writes is one click away.
- Change bars: each block that changed since you last saw the file gets a bar in the margin, as in a git gutter. Diff mode compares the text with that version, and can restore it.
- Search: a panel searches the contents of the files, and shows the matching lines beside the list of files.

**Distribution.** Release binaries for Linux and macOS through dist (formerly cargo-dist), and a Homebrew tap. The Linux binaries are static, built with musl, so one file runs on any distribution. No install script: in `~/.local/bin`, the script of dist 0.33 takes over the PATH setup of other tools that dist built, such as uv. A public GitHub repository, and the crate on crates.io.

### Later, by cost

The small items form milestone 12, except copy as quote and toasts. The medium ones wait.

| Item | Cost | Notes |
| --- | --- | --- |
| Custom key bindings | Small | A `[keys]` table in `config.toml` mapping action names to keys, sent in `/api/state`; `keys.ts` builds its map from it with the defaults as fallback. Two actions on one key stop mdame at start |
| Alternative built-in themes: Catppuccin (Latte, Frappé, Macchiato, Mocha) and Minimal | Small | Extra CSS files. Catppuccin from its official palette and style guide, with `subtext1` as muted text in Latte (5.53:1; `subtext0` fails at 4.37). Minimal from its default HSL formulas, with Primer's code colours since it has none; its default accent needs checking as link text. Both MIT |
| New file with `n`, new-file editor | Small | Reuses the folder hover action |
| Arrow keys in the sidebar tree | Small | ↑↓ move between the visible rows. → opens a folder, or moves to its first row if it is open. ← closes a folder, or moves to the parent folder. Enter opens the file. As in the WAI-ARIA tree pattern. The filter's ↑↓ stay as they are |
| Side-by-side diff in diff mode | Small | `MergeView` from `@codemirror/merge`, already a dependency, as a toggle beside the inline diff, remembered in `localStorage`. It needs width: with the sidebar open, each pane gets about 370 px on a 1280 px window |
| Mono toggle | Small | Content in `--font-mono` at `--content-width-mono`; out of v1 on 29 October 2026 |
| Toasts | Small | At the bottom of the page, once a feature needs them; out of v1 on 29 October 2026 |
| Vim key bindings in the editor, as a toggle | Small | `@replit/codemirror-vim`; the choice lives in `localStorage` |
| Print stylesheet | Small | Ctrl+P prints the content alone, without the sidebar and the status bar; the browser can print to PDF |
| Word count and reading time in the status bar | Small | For the open file |
| Read-only mode, `--read-only` | Small | The write routes (save, create, restore) answer 403, and `/api/state` tells the page to hide the editor. For a LAN share, or a folder that you only watch |
| Copy as quote | Small | Maybe, so not in milestone 11. With `q`, a selection in the view copies as a markdown quote of its source lines, with `path:line`, to paste into an agent |
| Handoff to a running mdame | Medium | `mdame <file>`, in a folder that a running mdame serves, opens the file in that mdame's tabs and exits. Two designs: a lock file per instance in the state folder and an `open` event to the tabs, or a check of ports 4891–4900 and a new browser tab on the running server. Either needs a flag for agents, so that a call with no mdame running fails instead of serving. Out of v1 on 3 November 2026: the list of changes covers the agent loop |
| Wide blocks | Medium | Tables, code blocks and diagrams grow past the text column, up to the pane, and the text keeps its width. The outline then needs its own place |
| launchd service (`mdame service …`) | Medium | macOS only, a plist template |
| Paste or drop an image into the editor | Medium | The image is saved in the workspace and linked at the cursor. A new upload route, with the limits of the other writes; where the image goes is decided then |

### Dropped

- Desktop app and everything in it: native windows, menus, session restore, update checks, CLI installer.
- Opening in the desktop app by default, and the `-b` flag.
- Claude Code plugin.
- The filesystem browser modal; replaced by path autocomplete.
- Sort by created date; unreliable on Linux.
- Deleting a single revision; replaced by pruning.
- Restoring a revision into the editor; restore writes the file.
- The custom find bar; the browser's find and CodeMirror search cover it.
- The workspace picker, the recent workspaces, and workspace switching: mdame starts from a terminal, where `mdame` opens the current folder. Another folder needs another launch.
- The choice of history location, and the first-start dialog that asked it: revisions live in the workspace.
- Font size presets: browser zoom does it.
- Clickable task lists in the view: the editor ticks a box in a few keys.
- The `CLAUDE.md` snippet and the skill for agents: users tune their own, once they know their workflow.
- The About dialog: a footer line in the shortcut help gives the version and links.
- File operations from the page (new folder, rename, move, delete) and the right-click menu: they happen in the terminal, and mdame follows them.
- Tabs inside the page: browser tabs are the tabs.

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
| Single-file and folder mode Later, daemon kept | In v1: `mdame <file>` and `mdame <folder>` are how mdame starts |

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

**Process model.** `mdame` opens its workspace at start, before it answers any request. There is no daemon handoff, port file, launchd service or desktop app in v1. If the port is busy, try the next ones and print the URL actually used; the browser opens on that URL once the port is bound.

**Two launches on one workspace.** Allowed in v1. Each runs on its own port and sees the other's saves as changes on disk, and the save check works across them because it compares content, not process state. Shared writes are made safe instead of locked: snapshots are created with `create_new`, and pruning ignores snapshots that are already gone. Detecting the second launch is a Later item.

**Viewing a file.** The browser asks `GET /api/file?path=…`; the server reads the file through the `Dir`, renders it with comrak, sanitizes it with ammonia and returns HTML with source positions. The browser morphs it into the content area, highlights new code blocks with Lezer and runs Mermaid on new diagrams.

**When a file changes on disk.** The debouncer reports the path; `watch.rs` sends `changed`; tabs showing that file refetch and morph, keeping scroll. The tree refetches only on create, remove or rename, and on a change to a file of the tree while it is sorted by date.

**Saving.** The editor loads its text with `GET /api/source`, which returns the content and its `ETag` (a content hash) in one response. It saves with `PUT /api/file` and `If-Match` set to that ETag. If the content on disk changed since, the server answers 412, and the editor checks the file on disk as after a `changed` event. Otherwise `history.rs` snapshots the old content, the new content is written, and the watcher's own event updates other tabs.

After a `changed` event or a 412, the editor fetches the file again and compares it with its own text:

- If the file has the editor's version, nothing changes. After a 412, the status bar says "Save again": the file was replaced during the save, so the save did not happen.
- If the file has a new version and the editor has no unsaved edits, the editor reloads it without a notice. Only the changed lines change, so the cursor and the scroll stay. Ctrl+Z undoes the reload.
- If the file has a new version and the editor has unsaved edits, a notice says that the file changed on disk. Reload replaces the edits with the file on disk, and Ctrl+Z brings them back. Overwrite saves the editor's text over the file, and the snapshot keeps the text that was on disk.
- If the file is gone, a notice says so. Recreate creates the file again and saves the editor's text into it.

## Libraries

Each part of the app maps to one focused library; custom code is limited to snapshot storage, scroll sync, toasts, port fallback, config and state paths, the keyboard map, rendered-markdown CSS, the code-highlighting glue, content search and the change bars. Versions and facts were checked on crates.io, docs.rs, the npm registry and each repo on 14 October 2026; pin whatever is current when the project starts.

### Rust

| Crate | Version | Job | Considered and rejected |
| --- | --- | --- | --- |
| axum + tokio | 0.8.9; 1.53 | HTTP and WebSocket server (`ws` feature); the guard is `middleware::from_fn_with_state` | none smaller worth the trade |
| rust-embed | 8.13 | Embed `web/dist` in release builds, read from disk on each request in debug (unless the `debug-embed` feature is on); its per-file SHA-256 gives `/assets` ETags | memory-serve (small user base), axum-embed (no release since 2023) |
| notify-debouncer-full | 0.7 | Debounced file events with rename pairing | raw `notify` with custom handling (what mdlive does), notify-debouncer-mini (loses rename info). Rename pairing on inotify is not explicitly documented: the ported mdlive watcher tests are the proof. 0.7 takes quadratic time to watch folders one by one. 0.8, in release candidate, fixes it. |
| ignore | 0.4.33 | Walk the workspace, respecting `.gitignore`, on 4 threads and one walk at a time: each folder that a walk opens is an event on the watcher's watches, and more threads overflowed the inotify queue on 15,000 folders; mdame filters hidden entries itself, to keep their markdown; `follow_links` stays false | walkdir (no ignore rules) |
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
| rustix | 1.1.5 | The link count of an open file, and on macOS its path (`F_GETPATH`), for the editor's checks. cap-std already depends on it | the `libc` crate (unsafe calls) |

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
| @codemirror/merge | 6.12 | Inline diff against a revision in the editor (`unifiedMergeView`); its `diff` also finds the lines behind the change bars | diff2html, server-side diff with `similar` |
| @lezer/highlight | 1.2.5 | Code highlighting in rendered views with the editor's own parsers (`highlightCode`, `classHighlighter`) | highlight.js (a second grammar set and class names), shiki (heavier), syntect on the server (theme mapping work) |
| mermaid | 12.2 | Diagrams; an ESM entry of 31 KB plus 104 lazy chunks (about 5.4 MB, embedded), loaded only when a page has one | none exists |
| idiomorph | 0.8 | Patch new HTML into the page in place (0BSD) | morphdom (equivalent), full reload (current) |
| @leeoniya/ufuzzy | 1.0.19 | Sidebar fuzzy filter, with its `highlight` helper | fuse.js (bigger) |

Written ourselves instead of a package:

- **Keyboard map** in `keys.ts`. About 30 lines implementing the rules of the Keyboard section; replaces tinykeys.
- **`web/styles/content.css`** for rendered markdown. It uses the theme contract's variables directly; replaces github-markdown-css, whose 234 variables follow the OS colour scheme rather than the theme picker.

Icons: Lucide, copied in as SVG files, only the icons used. Lucide is ISC, and its Feather-derived icons are MIT; the README names both licences.

Theme colours: copied from `@primer/primitives` (MIT) for the built-ins, and later from Catppuccin and Minimal (both MIT). No package is installed; the README credits each.

No UI framework: plain ES modules, written in TypeScript. Revisit Preact only if the state of the page sprawls.

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
    themes.rs           theme names; list and read the user themes
    error.rs            ApiError (thiserror) → status code + JSON body
    config.rs           config.toml (settings, read only); config, state and themes dirs
    workspace.rs        Workspace: root, cap-std Dir, starting file; open
    tree.rs             ignore walker → tree JSON
    search.rs           content search over the files that the tree shows
    watch.rs            debouncer → relative-path events → broadcast
    render.rs           comrak, ammonia, per-type rendering, size guard
    document.rs         read, save (with snapshot), raw bytes for images
    history.rs          snapshots, listing, pruning, restore
    ws.rs               WebSocket: forward events to clients
    api.rs              declares the route-group modules below
    api/                files.rs, history.rs, workspace.rs: one per route group
  web/
    index.html
    favicon.svg         copied to dist/assets/ by the web task
    notices.ts          writes the licence texts of the bundled packages
    src/                main.ts, api.ts, live.ts, sidebar.ts, view.ts,
                        editor.ts, revisions.ts, dialogs.ts,
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

**Shared state.** The router holds `Arc<AppState>`, and axum hands every handler a clone of that `Arc`: one pointer copy, no data copied. `AppState` itself cannot be cloned, because `Mutex` is not `Clone`. It holds:

- `config: Config`, read at start.
- `workspace: Workspace`, opened at start. It never changes while mdame runs, so it needs no lock, and a handler reaches it through its `Arc<AppState>`.
- `events: broadcast::Sender<Event>` for WebSocket clients.
- `access: Mutex<Access>`: the token and its open codes (the opened and the printed one), under one lock, so that a request decides from one view of them. A `None` token turns the check off for tests of other rules.
- `token_file: Option<PathBuf>`: where the token is kept, on loopback (see Token).

**Opening a workspace.** Once per launch, at start: the path given on the command line, or the current folder. mdame builds the `Workspace` (opens the `Dir`, starts the watcher) before it answers any request.

**No render cache.** Render on each request; comrak is fast enough for files under the 1 MB guard, and this removes the old app's global mutex problem. Render time is logged at debug level (`-v`), and milestone 4 times the 1 MB fixture. The editor preview is the heavier load, and a cache cannot help it. Add a cache keyed by path and content only if the numbers ask for it.

**Watcher threading.** The debouncer calls back on its own OS thread, and passes each batch to a thread of the watcher through a bounded channel. That thread turns the batch into `Event`s with workspace-relative paths, skips `.mdame/`, and sends them on the broadcast channel. Walking the workspace blocks, so this work stays out of tokio. Each WebSocket connection subscribes its own receiver, so a slow tab never slows the watcher or the other tabs. The debounce is 200 ms. If the watcher cannot start, mdame logs a warning and runs without live updates. The debouncer releases each path's events on its own, so a file deleted and written again with a gap can arrive as `removed`, then `created`. On macOS, FSEvents reports, for each path, all the flags that the path collected, in no order, and never the side of a rename. So there, the disk gives the kind of each event. A missing path is `removed`. If the path is present, a creation or a rename gives `created`, and any other event gives `changed`. A rename therefore gives `removed` and `created`, and a tab does not follow a renamed file. Decided on 8 November 2026.

**Watched folders.** The watcher watches the folders that the tree shows. It walks the workspace with the walker of the tree, so gitignored folders, `.git` and `.mdame` stay out. On Linux, inotify costs one watch per folder, so each shown folder gets a watch of its own. On macOS, FSEvents watches the whole root at the cost of one folder, and the watcher drops the events under the folders that the tree does not show. The debouncer keeps no cache of file ids: on macOS that cache pairs renames, but it walks the whole root, through symlinks and ignored folders. Some batches change the shown folders: those that create, remove or rename a folder, or that touch a `.gitignore` or `.ignore` file, in a shown folder. A file's creation, removal or rename does not. After such a batch, the watcher walks the workspace again and updates its watches. One walk serves every batch that waits, since a walk of 15,000 folders takes about 0.2 s. After a rescan, events were lost, so it watches every folder again. notify drops the watch of a folder that is removed or moved away, and the watches below it, so the watcher watches the folder again if its path comes back, as after a `git checkout`. A renamed folder is watched again only after the walk: what is written into it before sends nothing. A folder can change between the walk and its watch, so after a walk that added watches, the watcher walks once more. A new folder may hold files written before its watch, so the watcher sends `created` for its entries too, even when the folder's own event comes in a later batch. A folder that a `.gitignore` change shows counts as new; a renamed folder does not. On macOS, FSEvents never tells the side of a rename, so both sides of a renamed folder count as new, and a folder swapped for another one sends the entries of the new one. Hiding folders costs time: notify-debouncer-full drops each watch with a pass over all the watches, even in 0.8. On 15,000 folders, hiding 1,100 of them through a `.gitignore` change delays the events by 6 s. A folder that mdame cannot read is skipped with a warning. One deleted during the walk is watched if it comes back. At the inotify watch limit, mdame logs a warning, and the folders that it did not reach send no events. The debouncer looks for the watch of each event in the order of the watches, so the root is watched first. The first walk runs on the thread of the watcher, so mdame opens at once: notify-debouncer-full 0.7 takes quadratic time to watch folders one by one, 12 s for 15,000. Then the watcher sends `resync`, since a tab may have connected during the walk. Decided on 7 November 2026.

**Bursts and lag.** The broadcast channel holds 256 events (`EVENT_CAPACITY`). When one debounced batch holds more than 100 events (`BURST_THRESHOLD`), for example after a `git checkout`, and not counting reads (inotify reports each open, and mdame's own tree walk opens every folder) or the events of the folders that the tree hides, `watch.rs` sends a single `resync` instead of the individual events. A tab whose receiver still returns `Lagged` also gets `resync`. Both numbers are named constants to tune later.

## HTTP API and WebSocket protocol

The browser is a single page that talks JSON to `/api`, gets raw workspace files from `/raw`, and listens on `/ws`. Every `path` is relative to the workspace root, uses forward slashes, and is resolved through cap-std, so `..` and absolute paths fail with 403.

### Routes

| Method and path | Purpose | Returns |
| --- | --- | --- |
| `GET /`, `/view/*`, `/edit/*` | The single page; the browser routes from the URL | `index.html` |
| `GET /assets/*` | Bundled JS and CSS, and the licences of the bundled packages | embedded files, with ETag |
| `GET /themes/{name}.css` | The user theme of that name, else the built-in | CSS |
| `GET /raw/*path` | Workspace images, and other files as plain text | images with their type, anything else as `text/plain`; always sandboxed (see Security); 413 over 64 MB, since the file is read whole |
| `GET /api/state` | Workspace as `{root, start}`, version, and `themes`: the built-ins, then the user themes by name. The themes folder is read at each request | JSON |
| `GET /api/tree` | Nested folder tree. Only viewable files (see Rendering); folders with none are left out. `.gitignore` rules apply even outside a git repository. A folder's `modified` is that of its newest file; a file has a `family` (`markdown`, `text`, `data`, `table`, `diagram`, `image`) that picks its icon and its rendering | `{name, path, kind, family, modified, children}` |
| `GET /api/file?path=` | Rendered file: `html`, `source`, `family`, `modified`, `size`, `too_large`, and `editable`, whether the page offers the editor. `source` is the text that was rendered, for the change bars; it is `null` for an image and for a file over 1 MB. 404 `not_found` for a missing file; 404 `not_viewable` for a file that exists with no family, so the page can offer the raw file | JSON |
| `GET /api/source?path=` | Editor source, in one request: text and its version together; 413 over 8 MB, and 404 `not_viewable` for a file that the editor may not open (below) or that is not UTF-8 | `{content, modified}` with `ETag: "<content hash>"` |
| `PUT /api/file?path=` | Save `{content}` with `If-Match: "<hash>"`; snapshots first; 404 `not_viewable` for a file that the editor may not open; 413 over 8 MB | `{modified}` and the new `ETag`; 412 if the content changed on disk since, or if `If-Match` is anything but one strong `ETag` (`*` and lists included); 428 without `If-Match` |
| `POST /api/file` | Create `{path}`, empty; 409 if it exists, 400 for a type that the editor cannot open or that the tree hides, 404 naming the folder when its folder is missing. Folders are never created | 201, `{modified}` and the `ETag` of the empty content |
| `POST /api/render` | Editor preview `{path, content}` | `{html}` |
| `GET /api/search?q=` | Content search, for the search panel. `q` is a literal phrase with smart case: the search ignores case unless `q` has an uppercase letter. It reads the files that the tree shows, except images, files over 1 MB and files that are not UTF-8. Newest files first, at most 50 files and 20 matches per file. An empty `q` gets 400 | `{files: [{path, modified, lines: [{number, text, matched}], more}], more}`: the matching lines of each file and the 2 lines around each, merged where they overlap, as `rg -C2` prints them. A file's `more` is true when the file has more than 20 matches. The last `more` is true when the list of files was cut |
| `GET /api/history?path=` | Revisions of a file that the editor may open, newest first. The `id` is the snapshot's name, and `time` is the Unix milliseconds of that name. A file that mdame never saved over gives `[]`, and the request creates no folder | `[{id, time, size}]` |
| `GET /api/history/view?path=&id=` | A revision's text, for the merge view. 404 `not_found` for an `id` that is not the name of a revision of this file; 404 `not_viewable` for a revision that is not UTF-8 | `{content}` |
| `POST /api/history/restore` | `{path, id}`: saves the revision over the file, as `PUT /api/file` does. The current content becomes a revision first, so the restore can be undone. It needs no `If-Match`. 404 for a deleted file, or for an `id` that names no revision; 412 if another program writes the file during the restore | `{modified}` and the new `ETag` |
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
- `render.sourcepos = true`: each block carries `data-sourcepos="start:col-end:col"`, used for scroll sync, the change bars, and opening a search match at its line.
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

`web/src/codehl.ts` finds `code.language-x` blocks, matches `x` with `LanguageDescription.matchLanguageName` from `@codemirror/language-data`, awaits the language's `load()`, parses the text and writes spans with `highlightCode` and `classHighlighter`. These emit the same `tok-*` classes as the editor, so one set of theme colours serves both. A block over 100 KB stays plain text: one span per token took 3.4 s for a 943 KB JSON file. Milestone 4 checks every listed type, in particular GraphQL and the languages that come through legacy modes.

### Themes in rendered content

A theme file sets the CSS variables used by `content.css` and the code colours, which apply to both the editor and rendered code. Its `color-scheme` also picks Mermaid's theme when the browser initialises Mermaid: `dark` for a dark scheme, `default` otherwise.

## Security

Only the mdame page itself, in a browser that holds the token, can reach the API; file access never leaves the workspace; workspace content never runs as script on mdame's origin. Build the guard in milestone 1, before any route that touches files.

The guard trusts origins, not code: any script running on a page at mdame's origin passes it. So the rule underneath every row below is that untrusted content never becomes a page on mdame's origin.

| Threat | Defence |
| --- | --- |
| A website in another tab calls the local API | No CORS layer at all. A middleware rejects any request whose `Origin` header is present and not mdame's own origin, and rejects WebSocket upgrades the same way. An image or a script on another page sends no `Origin`, so for `/api/` and `/raw/`, it also rejects a request whose `Sec-Fetch-Site` is present and neither `same-origin` nor `none`. `same-site` counts too: a page on another port of the same host is same-site. |
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

**Programs on this machine.** Any program on the machine can reach the loopback port, even one in a sandbox that cannot write the files itself: a Flatpak app with network access, a container on the host network, a coding agent. Without the token, such a program could write any file through mdame. The token stops it only if the sandbox also keeps it from reading the token. Coding-agent sandboxes often limit writes but not reads. Deny the agent reads of mdame's state folder, which holds the token, and of the browser profile, whose cookies hold it too. Also give it a PID namespace of its own, which hides your other processes from it. The code in the URL that mdame opens is on the browser launcher's command line for a moment, and `hidepid` hides only the processes of other accounts. The editor's routes also open, save and create only the text types that the view shows. A hidden file, or a file in a hidden folder, must be markdown, and never under `.git` or `.mdame`, in any letter case. The rules apply through a symbolic link too (a hard link is the same file under a second name, which mdame cannot tell from the first). They apply to the workspace folder's own path too: in `~/.claude`, only markdown is editable, and mdame does not open a folder in `.git` or `.mdame`. A leaked token then cannot rewrite `.git/config`, an agent's settings such as `.claude/settings.json`, a CI workflow in YAML, a `Makefile` or a snapshot. It can still rewrite a data file that runs commands, such as `package.json` or `mise.toml`. It can also rewrite an agent's instructions, such as `CLAUDE.md`, a skill, or the markdown of an agentic workflow in `.github/workflows/`, which CI runs once you push it. A skill whose front matter lists `allowed-tools` runs those tools without asking. Accepted on 3 November 2026: you amend an agent's plan in mdame, and the root `CLAUDE.md` was writable already.

Tests cover each row: a request with a foreign `Origin`, a wrong `Host`, a missing token, on loopback too, a `../` path, a symlink pointing out of the workspace, an in-workspace symlinked file, and an `.html` and an `.svg` under `/raw` returning `sandbox` (and `text/plain` for the `.html`). The guard rows land in milestone 1, the rest with their routes.

## On-disk formats

mdame keeps its own files and imports nothing from mdlive, so it starts with no revisions. The layouts follow mdlive v2.3.13, checked against `handlers/api.rs` and `config.rs`, except where noted.

**Revision snapshots.** Before a save overwrites a file, its previous content is copied to `<history root>/<relative path>/<unix milliseconds>.<original extension>`. Example: saving `api/rate-limiting.md` writes `api/rate-limiting.md/1771271566123.md` under the history root. The relative path is where the file really is: a link or a `..` in the path asked does not split the revisions of one file. The snapshot is opened with `OpenOptions::create_new`, so it never overwrites one that exists; on `AlreadyExists`, add 1 ms and retry. Its mode is 0600, since the file it copies may be private. After the save writes the file, mdame keeps the newest 20 snapshots of that file (`snapshots_per_file`), by the time in their name, and deletes the rest. A name dated after now, from a clock that was ahead, counts as the oldest: the list shows it last, and pruning deletes it first. Pruning always keeps the snapshot that the save just made, unless `snapshots_per_file` is 0: after a collision, its name can be ahead of the clock. Pruning waits for the write: with `snapshots_per_file = 0`, the snapshot still covers a crash during the write. It ignores snapshots already gone, and deletes no folder, no link, and no file whose name is not a snapshot's. A link at `.mdame` or `.mdame/history` stops the save: pruning through it could delete files of the workspace. If it fails, mdame logs a warning, and the save still succeeds. A test checks that two quick saves give two snapshots. An empty file gets no snapshot: writing over it loses nothing. A save of the text already on disk writes nothing and makes no snapshot, so a habit of pressing Ctrl+S does not push the real revisions out.

**History location.** The history root is `<workspace>/.mdame/history/`. When mdame creates `.mdame/`, it makes it 0700, since its folders follow the workspace's file names. It also writes `.mdame/.gitignore` containing `*`, so git, the `ignore` walker, ripgrep and agents skip it with no change to the user's own `.gitignore`. Revisions move with the workspace when it is renamed or moved.

**Watcher and tree.** `.mdame/` is never shown in the tree and its events are ignored, so snapshots never trigger `changed`.

**Config.** `~/.config/mdame/config.toml` (or under `$XDG_CONFIG_HOME`) holds what the user chooses. mdame reads it at start and never writes it. If the file is not valid, or has an unknown key such as a misspelled one, mdame stops at start with the error, so that a misspelled setting is never ignored in silence. All fields are optional:

```toml
snapshots_per_file = 20
```

**Token.** On loopback, mdame keeps the token in `<state folder>/token`, mode 0600, so that the cookie of a tab or a bookmark still works after a restart. The first start makes the file. A token file that others can read, or that holds no token, gives a warning, and the token then lasts one run: delete the file to fix it. Deleting the file also locks every browser out, from the next start on. Beyond loopback, the token is new at each start, since its URL goes to other devices. mdame makes the state folder 0700 before it writes the token there. If it cannot, the token lasts one run.

**User themes.** Any `~/.config/mdame/themes/<name>.css` appears in the theme picker as `<name>`, after the built-ins. A user file with a built-in's name overrides it. A link there counts too, wherever it points, since dotfile managers make such links. A theme name has no `/` and no leading dot, so a request names only a file of the folder.

**Browser-only preferences** such as sidebar width and open folders live in `localStorage` (see Front end).

## Front end and design

The front end is a small single-page app in TypeScript ES modules, bundled into `web/dist` (see Tooling). This section fixes the structure and the theme contract and records the owner's design decisions. The wireframes are in [mdame wireframes](https://claude.ai/artifact/N8wsSPTuHm3gvC3PnnWxwj).

### Structure

- `main.ts` reads `/api/state`, routes on the URL (`/view/<path>`, `/edit/<path>`), and wires the WebSocket.
- `api.ts` is the only module that calls `fetch`; it turns error bodies into exceptions with a code.
- Each screen module exports `mount(el, params)` and `unmount()`; state lives in plain objects, and changes re-render or morph only the affected region.
- Preferences that belong to one browser (sidebar width, open folders, preview visibility, split position, theme, content width, outline, spellcheck) go in `localStorage`, wrapped in try/catch, with every key prefixed `mdame:` so they never meet mdlive's keys on the same port.
- App element ids start with `mdame-`; no code reads elements through `window.<id>` globals.
- Logic with no DOM access (scroll-sync mapping, key rules, error mapping) lives in its own functions so `bun test` can cover it.

### Screens and regions

| Screen | Contents |
| --- | --- |
| View | Sidebar (filter, search button, sort, tree), rendered content with its change bars and outline, status bar (path, modified time, list of changes, actions) |
| Editor | Same frame; content area splits into CodeMirror and preview, with a divider; status bar gains unsaved dot and Save |
| Revisions | Inline diff in the editor (CodeMirror merge view) against a revision picked from a list, with Restore |
| Empty and not found | One line saying what happened and one action |
| Dialogs | Native `<dialog>` for confirm, name input, the shortcut help and the search panel. Toasts are a Later item |

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
| `s` | Search the contents of the files |
| `?` | Shortcut help |

Shortcuts are ignored while typing in an input or CodeMirror, while a dialog is open, and when a modifier other than the listed ones is held. `keys.ts` implements this as one `keydown` listener and a map from key to handler. Esc and Cmd/Ctrl+S have their own listeners, since they must work inside CodeMirror: CodeMirror uses Esc first, to clear a selection or to close its search panel or completion list. Otherwise Esc closes the revisions panel first, then the editor, unless a dialog, a menu or the sidebar overlay is open. Cmd/Ctrl+S saves from anywhere on the page.

### Theme contract

A theme is one CSS file that sets variables on `:root` and nothing else. The app's own CSS, including `content.css`, uses only these variables, so any theme works with any version of the layout.

- **Surfaces and text:** `--bg`, `--bg-raised`, `--bg-sunken`, `--fg`, `--fg-muted`, `--border`, `--selection`.
- **Meaning:** `--accent`, `--accent-fg`, `--danger`, `--warning`, `--success`.
- **Type:** `--font-ui`, `--font-content`, `--font-mono`, `--content-width`, `--content-width-mono`. `--content-width-mono` is for the mono toggle, a Later item.
- **Code colours**, for the editor and rendered code alike through Lezer's `tok-*` classes: `--code-bg`, `--hl-keyword`, `--hl-string`, `--hl-number`, `--hl-comment`, `--hl-title`, `--hl-type`, `--hl-attr`, `--hl-meta`.
- `color-scheme: light` or `dark`, a standard CSS property. mdame loads the built-in theme of that scheme first, then the theme over it, so a user theme may set only the variables that it changes. Browsers also draw scrollbars and form controls to match.

The diff's added and removed lines mix `--success` and `--danger` into the background, and a hovered row mixes in `--fg`, so themes set no diff or hover colours. The change bars use `--success` for an added block, `--accent` for a changed one and `--danger` where text was removed, so themes set no colours for them either. Shadows and backdrops stay translucent black, outside the contract.

The list was fixed on 28 October 2026. Milestone 8 documents it in `web/themes/README.md` with a commented template, because that file is what issue #15 users will copy.

### Design decisions

- Overall feel: a mix. Compact chrome, like a quiet tool next to a terminal, around a reading-first content column (measure and type).
- Sidebar: docked on wide windows, an overlay below about 900 px (opened with `b`). Width 180–480 px, default 260 px. Details decided on 18 October 2026:
  - At first load, only the folders on the path to the current file are open. Open folders are remembered per workspace (the `localStorage` key holds the root).
  - One sort button cycles name A→Z, name Z→A, newest first, oldest first; its icon shows the current order. Folders always come first, and a folder's date is its newest file. The choice is remembered.
  - Clicking a file goes to `/view/<path>`. Icons: one per family (markdown and text, image, CSV, data files, Mermaid).
  - The filter matches file names with `@leeoniya/ufuzzy` and shows a flat list, matched letters in bold, folder in grey. It shows 100 results at most, then the number of the others: in a large repository, one letter matches thousands of names. Over 1,000 matches, uFuzzy ranks none, so the 100 come unranked, without bold letters. ↑↓ choose (no row is highlighted until then), Enter opens the chosen result or else the first one (a wrong open here costs one click), Esc clears the field and then leaves it.
  - Hover action in milestone 3: copy path. "New file in this folder" comes in milestone 6, with `POST /api/file`.
- File header: none. Path, modified time and the actions (edit, copy raw, copy path, revisions) live in the status bar; content starts at the top edge.
- Editor: preview on the right, 50/50 by default, draggable divider, scroll sync.
- Revisions: inline diff in the editor (CodeMirror merge view) against a revision picked from a list. `h` or `r` in view mode opens the editor in diff mode.
- Typography: IBM Plex Sans for UI and content, IBM Plex Mono for code, content width 60ch. The mono toggle (Later) will set the content in Plex Mono at 72ch. Fonts are bundled as woff2 (OFL). Decided 28 October 2026.
- View options: the palette button in the status bar opens a menu. It holds the theme (System, Light, Dark, then the user themes), the content width (Default, Wide, Full), and the toggles of the outline and of the spellcheck. Each choice lives in `localStorage`, per browser and per port. The theme was decided on 28 October 2026, the rest on 3 November 2026.
- Content width: Default is the theme's `--content-width`, 60ch in the built-ins. Wide is 80ch, and Full is the whole pane. Wide and Full set `--content-width` on `<html>`, so they win over the theme. They apply to the view and to the editor's preview. Decided 3 November 2026.
- Hidden folders: the tree shows each markdown file whose path has a hidden part, at any depth, such as `.claude/plans/a.md` or `.notes.md`. Other types there stay out. The walker never enters a `.git` or `.mdame` folder, at any depth and in any letter case, since some file systems ignore case. `.gitignore` applies as elsewhere, and so do `.ignore` and `.git/info/exclude`: they hide a folder such as `.claude/worktrees/`, so mdame needs no option of its own for it. The rules look at the whole real path of a file, the workspace folder's own path included: in `~/.claude` or `~/.config/notes`, the tree shows only markdown. Decided 3 November 2026; the ignore files 6 November; the workspace folder's path 9 November.
- List of changes: the status bar lists the markdown files that are created or changed on disk while the tab is open. It leaves out the file on screen and the files of a `resync`. With one file, the item shows its name, and a click opens it. With several, it shows the newest name and `+N`, and a click opens a menu, newest first, with Clear at the end. Opening a file, from anywhere, removes it from the list. A second change moves a file to the top. A rename keeps its entry under the new name, and a removal takes it out. The list lives in the tab's memory. Decided 3 November 2026.
  - Settled on 5 November 2026, with the code: the item sits at the right of the status bar, before the version, with a dot in `--accent`. A rename that moves no listed file counts as a change to its new path: a program that saves by renaming a new file over the old one changes that file. A rename to a type that is not markdown takes the entry out.
- Change bars: a block that changed since you last saw the file gets a bar at its left, as in a git gutter. The bar is `--success` for an added block and `--accent` for a changed one. A `--danger` mark shows where text was removed. A bar marks the innermost block with a `data-sourcepos`, so a changed list item marks the item, not the list. Per file, the tab keeps in memory the version that you last saw: the version on screen when you last left the file. After each change, the page compares that version with the current one. The bars therefore add up, and a change that is undone loses its bar. A file that the tab has never shown has no bars. A new bar glows once, then stays; under reduced motion, it does not glow. The page diffs the lines with `diff` from `@codemirror/merge`. Decided 3 November 2026.
  - Settled on 4 November 2026, with the code: a block whose lines are all new is added; any other changed block is changed. Text removed inside a block marks the block as changed, and the `--danger` mark is for text removed between blocks. A changed table row marks the row. Opening the editor on the file does not leave it, so diff mode compares with the same version as the bars. A rename keeps the version last seen. Past 100 ms of diffing, the rest of the text counts as one change; past 55,296 distinct lines in the two versions, there are no bars. The bars sit in the article's left padding, in one column, whatever the depth of the block.
- Last seen: if the text of a file differs from the version that you last saw, diff mode lists that version first, as "Last seen". Its Restore saves that text as a normal save, so the current text becomes a revision first. mdame makes revisions of its own saves only, so after an agent rewrites a file, this is how you undo the rewrite. Decided 3 November 2026.
  - Settled on 5 November 2026, with the code: "Last seen" is the version that the change bars compare with, and a file that the tab never showed has none. Leaving a file from its editor counts as leaving it with the text that the editor held. Back in the view of the same file, the file was never left, so the bars include the edits saved in the editor. Line breaks do not count in the comparison. As the first entry, it is the one that diff mode compares with when it opens. Its Restore sends `If-Match` with the version that the editor holds, so a file that an agent wrote again meanwhile gets 412.
- Search panel: `s`, or a button beside the sidebar filter, opens a dialog. The field is at the top. The matching files are on the left, newest first, with their number of matches. On the right are the matching lines of the selected file, with 2 lines of context, line numbers and the match highlighted, as the browser's find does. The panel searches as you type, from 3 characters, 150 ms after typing stops: the server cannot stop a search, so each keystroke must not start one. A new search cancels the request in flight. ↑↓ choose a file, Enter opens it at its first match, a click on a line opens it at that line, and Esc closes the panel. In markdown, the page scrolls to the block that holds the line; other types open at the top. Below 900 px, the preview goes under the list. The `/` filter keeps matching names only. A regex toggle may come later. Decided 3 November 2026.
  - Settled on 5 November 2026, with the code: a picked line opens the file at `#L<line>`, so a reload or Back scrolls to it again; an element whose id is that name wins. A file shows `20+` when its `more` is set, and the status line shows `50+ files` when the answer's `more` is set. A click on a file chooses it; Enter or a click on a line opens it. The highlight mixes `--warning` into the background, so that each theme gives it its own yellow.
- Outline: an "On this page" list of the h2 and h3 headings, to the right of the content column. It shows in the view only, for a file with 3 headings or more. The heading of the section on screen is highlighted, and a click on a heading scrolls to it. A dot marks each section that has a change bar. The outline needs 224 px: 200 px for the list and a gap of 24 px. If the space to the right of the centred column is narrower, the column moves left to make room. With Full, the column narrows instead. If moving the column is not enough, the outline hides. Its toggle in View options hides it too. Decided 3 November 2026.
  - Settled on 5 November 2026, with the code: only h2 and h3 count for the 3 headings. The column moves left only as far as the outline needs, so it does not jump when the pane narrows. With Full, the column narrows down to 480 px, about 45 characters; below that, the outline hides. A section ends at the next h1, h2 or h3, so an h4 stays in the section above it. If text was removed just above a heading, the dot goes to the section before. A click on a heading opens `#<id>`, as the heading's own link does. A heading with no id, which the sanitizer drops when it starts with `mdame-`, opens `#L<line>`. A heading is highlighted once its top is 48 px or less from the top of the pane. At the end of the file, the last one is. Near the end of a file, a heading cannot reach the top. Therefore, after a click on an entry or a page load with `#…` in the address, that heading stays highlighted until the pane scrolls. In View options, the toggle is the Outline item, under Show.
- Spellcheck: the editor turns on the browser's spellcheck, with the browser's dictionary. It underlines words in code too. A toggle in View options turns it off, with no reload. Decided 3 November 2026.
  - Settled on 6 November 2026, with the code: the toggle is the Spellcheck item, under Show, after Outline. It applies to the open editor at once, diff mode included.
- Shortcut help: `?` opens a dialog with the keys in three groups: Outside the editor, Editor, and Filter and search. In the editor, the letter keys type text. One list in the code feeds the dialog, and a test checks that each key that the page binds is in it. It shows ⌘ on macOS and Ctrl elsewhere. One line says that the editor keeps CodeMirror's own keys, such as Ctrl+F and Ctrl+Z. A footer line gives the version and links to the repository and to the licences. Decided 3 November 2026.
  - Settled on 6 November 2026, with the code: the dialog is titled "Keyboard shortcuts". A keyboard button in the status bar, before View options, opens it too, so that a user who does not know `?` finds it. "Licences" opens `/assets/THIRD-PARTY-LICENSES.txt`, which mdame serves, so it matches the running version; the file moved into `web/dist/assets/` for this. The test covers the keys of `bindKeys` and of the editor's keymap. The keys of the filter, of the search panel, Esc and Cmd/Ctrl+S have their own listeners, and the list holds them by hand.
- Icons: Lucide, only the icons used, bundled as SVG; tooltips give the label and shortcut. The favicon is Lucide's `file-text`, in the accent of the built-in light theme, or of the dark theme when the system is dark. It cannot follow the theme picked in View options. Decided 9 November 2026.
- Motion: one transition. Panels and the sidebar overlay slide in over 150 ms; nothing moves under `prefers-reduced-motion`.
- Default theme: follow the system. Until the user picks a theme, the page uses the built-in light or dark theme according to `prefers-color-scheme`, and switches live when the OS does; a picked theme is stored and wins. Decided 15 October 2026.
- Built-in themes: GitHub Primer light and dark, from `@primer/primitives` (11.10.0 checked), copied into `web/themes/light.css` and `dark.css`. Chosen for the highest text and muted contrast of the families compared (body text 15.8:1 light, 17.4:1 dark; muted 6.1 and 6.5) and for the look most people know from rendered markdown. Primer has no number, type or attribute syntax colours, so mdame maps them: number uses constant, type and meta use variable, attribute uses entityTag. Decided 15 October 2026.
- Alternative themes come later (see Later): Catppuccin and Minimal, the latter with Primer's code colours.

Process: the low-fidelity wireframes of the picker, view and editor were signed off on 15 October 2026 and are adjusted during testing if needed; the theme pass comes in milestone 8, when every screen exists.

## Tooling

mise manages the repo. `mise.toml` pins the tools (Rust toolchain, Bun) and defines the tasks:

| Task | Does |
| --- | --- |
| `web` | `bun ci` (frozen lockfile), then bundle `web/src` into `web/dist`. `web/notices.ts` then writes `web/dist/assets/THIRD-PARTY-LICENSES.txt` from the bundle's metafile: for each npm package in the bundle, its licence files, its NOTICE file, and its source URL. A package with no licence file stops the task |
| `dev` | The bundler in watch mode in the background, plus `cargo run`. The Rust server is restarted by hand and the browser refreshed by hand; in debug builds rust-embed reads `web/dist` from disk on each request |
| `fmt` | `cargo fmt` |
| `lint` | `cargo clippy -- -D warnings` |
| `test` | `cargo test` and `bun test` |
| `check-dist` | `mise run web`, then fails if `git status --porcelain -- web/dist` lists anything: a stale committed bundle. `git diff` alone misses new, untracked chunk files |

**No Node.** Bun is the package manager: `package.json`, a committed text `bun.lock`, and `bunfig.toml` with `linker = "hoisted"`, so there is one flat `node_modules/` (git-ignored) and a single copy of `@codemirror/state`, checked with `bun pm ls` (and `bun dedupe` if needed). Dependency install scripts stay off, which is Bun's default. `bun audit` and `bun outdated` cover maintenance; Renovate understands `bun.lock`.

**Bundler.** Bun's own bundler (`bun build`, ESM output, `--splitting` for Mermaid's and language-data's lazy chunks, and for the editor, which loads on the first edit: with the editor, the first page load took 758 KB of JavaScript, and without it 439 KB, `--minify`). Its output is reproducible, which `check-dist` depends on. Checked on 17 October 2026 with Bun 1.4.3: a test entry that imports codemirror, lang-markdown, language-data and Mermaid built 203 identical files (7.1 MB) in three directories, one of them installed fresh with `bun ci`. The output held no absolute paths, and `node_modules/` held one copy of `@codemirror/state`. If a later Bun breaks this, esbuild, installed through Bun as a devDependency, becomes the bundler, and only the `web` and `dev` tasks change.

**Users need only Rust.** `web/dist` is committed, so `cargo install mdame` never runs Bun or esbuild.

## What to reuse from mdlive

Reuse mdlive's tests, formats and a few small functions; replace everything else. Clone v2.3.13 next to the new repo for reference. Any copied code keeps the MIT notice of mdlive and mdserve.

| From mdlive | Use it as | Where it goes |
| --- | --- | --- |
| `tests/websocket_test.rs` | Specification for the watcher: vim-style rename saves, delete-then-create, folder moves | `tests/watch.rs`, ported to the new events |
| `tests/api_test.rs`, `tests/workspace_test.rs` | Cases for path validation, create and save | route tests |
| `.mdlive/history` layout, prune-to-20 | Same layout under the history root, millisecond names, same default | `history.rs` |
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
| Unit | `#[cfg(test)]` modules | tree building, pruning, front matter stripping, port fallback |
| Rendering | insta snapshots of fixture files in `tests/fixtures/`, plus explicit checks for sanitizing | every file type, alerts, footnotes and in-page links, heading ids, task lists, sanitizing (a fixture full of hostile HTML), relative URL rewriting |
| Routes | build the router with a tempdir workspace, call it with `tower::ServiceExt::oneshot` | every route's success and error codes, the security rows as matrix tests, 412 on a stale save and 428 without `If-Match`, `/raw` headers |
| History | tempdir workspace | two quick saves give two snapshots, pruning, `.mdame/.gitignore` |
| Watcher | real files in a tempdir, wait for events with a timeout | the cases ported from mdlive's `websocket_test.rs`, the burst rule |
| WebSocket | a test client against a bound server | events arrive with relative paths; `resync` after lag |
| Front-end unit | `bun test` on modules with no DOM | scroll-sync line-to-block mapping and interpolation, the key-map rules (ignore while typing, modifiers), API error mapping, what the page does for each live event |

Watcher tests are timing-sensitive: use generous timeouts (2 s) and assert on the set of events, not their exact order. CI on Linux and macOS runs `cargo fmt --check`, then `mise run lint`, `test` and `check-dist`. After each release, a job installs it with Homebrew, on Linux and on macOS, and checks that mdame starts and answers `/api/state`.

## Build order

Ten milestones for v1, released as 0.1.0, then two more before the Show HN. Each ends in something the owner can run, with a review before the next starts. The wireframes were signed off on 15 October 2026.

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
8. **Themes and polish.** Theme contract fixed, light and dark built-ins, user themes folder, theme picker, status bar, dialogs, `--no-open`, a first README with attribution and licence notes, CI on GitHub Actions. The workspace picker and the choice of history location go.
   - Done when: a user theme dropped into `~/.config/mdame/themes/` appears in the theme picker without a restart.
9. **Agent workflow.** Markdown in hidden folders, shown and editable; the list of changes in the status bar; the change bars and "Last seen" in diff mode; the search panel; the content width; the outline; spellcheck in the editor; the shortcut help with its footer line.
   - Done when: Claude Code, with `plansDirectory` set to `.claude/plans`, writes a plan. The plan shows in the tree and in the list of changes, and one click opens it. When the agent rewrites it, the changed blocks get bars and the outline gets dots. In diff mode, "Last seen" shows what changed and restores it.
10. **Release.** Editing on macOS, CI on a macOS runner, release binaries through dist, and release 0.1.0 of the crate on crates.io. The watcher stops watching gitignored folders. With no Mac at hand, a CI job checks the release on macOS. The memory of mdame and of its tab is measured against VS Code, idle and on a large repository. The open points of milestone 8 close: CI actions pinned by SHA, a warning to use only themes that you trust, and the notice of `@primer/primitives`. The README leads with the reason for mdame: a markdown viewer and editor in the browser, beside the terminal, lighter than VS Code. Its comparison starts with VS Code, and its demo of the agent loop sets `plansDirectory`.
   - Done when: `brew install` gives a working mdame on Linux and macOS.
11. **Fixes for 0.1.1.** Live updates on macOS, through a check of the disk for each event, and the watcher tests on macOS. Security: the rules of hidden folders apply to the root too, `/api/*` refuses cross-site requests, the walker skips an ignore file that is not a regular file, and search answers cut long lines. Release: a licence that GitHub detects, the licence texts of the Rust dependencies in the archives, a changelog, `rust-version`, stripped binaries with attestations. A favicon. Then release 0.1.1.
   - Done when: the watcher tests pass on the macOS runner of CI, except the cases that the README lists as known issues. `brew install` gives a working 0.1.1 on Linux and macOS.
12. **Small Later items.** Custom key bindings, the Catppuccin and Minimal themes, new file with `n`, arrow keys in the sidebar tree, side-by-side diff, vim key bindings, a print stylesheet, word count, read-only mode, the mono toggle. Then release 0.2.0, and the Show HN.

After milestone 12, the medium Later items wait.

## Open decisions

- **Settled in milestone 8:** the built-in themes map each contract variable to a Primer variable, and the theme pass checked each pair that the screens use. Dark sets `--accent-fg` to `bgColor-inset`, since Primer's white is 3.1:1 on its accent.
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
| The workspace picker, the recents and workspace switching go: `mdame` with no path opens the current folder. Revisions live in the workspace only: the `state` mode and the first-start dialog go. mdame never writes `config.toml` | 29 October 2026 |
| A link in the themes folder is a theme, wherever it points: dotfile managers make them. Changed from refusing a link that leaves the folder | 2 November 2026 |
| What the browser or the terminal already does, mdame does not rebuild. Dropped: the font size presets, clickable task lists, file operations, the right-click menu, tabs, and the agent snippet and skill. The About dialog becomes a footer line of the shortcut help | 3 November 2026 |
| Milestone 9: markdown in hidden folders is shown and editable, except under `.git` and `.mdame`. The handoff goes to Later, and a list of changes in the status bar replaces it. Change bars compare with the version that you last saw. A search panel, the content width, an outline and spellcheck come in. Copy as quote and wide blocks go to Later | 3 November 2026 |
| Milestone 10 also measures memory against VS Code, stops watching gitignored folders, takes the open points of milestone 8, and leads the README with VS Code | 3 November 2026 |
| Milestone 10: no npm wrapper; static Linux binaries built with musl; on Linux the watcher skips gitignored folders, on macOS it drops their events; a CI job checks the release on macOS | 7 November 2026 |
| Live updates on macOS are a known issue of 0.1.0: FSEvents merges the kinds of the events of a path. The watcher tests run on Linux only | 7 November 2026 |
| The first walk of the watcher runs in the background: with notify-debouncer-full 0.7, watching 15,000 folders one by one takes 12 s | 7 November 2026 |
| No install script: dist's script takes over the PATH setup of other tools that dist built in `~/.local/bin`, such as uv. Homebrew, mise, Cargo and the release archives remain | 8 November 2026 |
| After tests on a Mac, live updates on macOS stay a known issue of 0.1.0. Their fix, a check of the disk for each event, comes after 0.1.0 | 8 November 2026 |
| The small Later items gain arrow keys in the sidebar tree | 6 November 2026 |
| Milestone 11 takes the fixes that 0.1.0 needs, and releases 0.1.1. The small Later items become milestone 12, without toasts, and release 0.2.0. The Show HN waits for 0.2.0 | 9 November 2026 |
| The watcher tests run on macOS too. Where FSEvents gives other events, a test expects them on macOS. The folder delete, which sends nothing on macOS, is ignored there | 9 November 2026 |

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
