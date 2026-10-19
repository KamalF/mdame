# mdame progress

Where the build stands against the milestones in `docs/SPEC.md`.

## How we work

One commit at a time. Claude writes the code and its tests, and runs fmt, clippy and the tests. Kamal reads the code, asks questions and writes the commit message. One branch per milestone.

## Milestones

| # | Milestone | Status | Commits |
| --- | --- | --- | --- |
| 1 | Skeleton | Done 17 October 2026, merged into `main` 18 October | 9 |
| 2 | Workspaces | Done 18 October 2026, merged into `main` the same day | 20, with the review fixes |
| 3 | Sidebar | Done 18 October 2026, merged into `main` the same day | 19, with the review fixes |
| 4 | Viewing | Done 18 October 2026, merged into `main` the same day | 16, with the review fixes |
| 5 | Live updates | Done 19 October 2026, on `m5-live`; review next | 9 |
| 6 | Editor | — | about 12 |
| 7 | Revisions | — | about 6 |
| 8 | Themes and polish | — | about 9 |

## Milestone 1: skeleton

- Axum server with shared `AppState` and `GET /api/state`.
- `ApiError` with the spec's JSON error shape.
- Guard: Origin and Host checks, and a token when bound beyond loopback (`-H`).
- Port fallback from 4891, over 10 ports.
- Flags: `-p`, `-H`, `-v`, `--help`, `--version`. Logs with tracing.
- The browser opens on start, through loopback when bound to `0.0.0.0`.
- Bun set up as package manager and bundler; its output is reproducible.
- mise tasks: `web`, `dev`, `fmt`, `lint`, `test`, `check-dist`.
- `web/dist` embedded with rust-embed, with ETag, 304 and the security headers.

## Milestone 2: workspaces

- `config.rs`: `Config` (theme, snapshots_per_file, history) in `config.toml`, `Recents` in `recents.toml` in the state folder; generic load (a missing file gives the default) and atomic save; the config and state paths.
- `Recents::add`: puts a path first, with no duplicate, and keeps 25.
- `AppState` holds the config, loaded at start; an invalid `config.toml` stops mdame with a readable error. `/api/state` returns `needs_setup`.
- `PUT /api/settings` saves `{history}` and returns the new state; a body that is not a known JSON setting gets 400.
- `workspace.rs`: `Workspace::open` canonicalizes the path and opens a cap-std `Dir` on the folder; a file opens its folder, with the file first.
- `AppState` holds the workspace. `mdame <path>` opens it at start and adds it to the recents; a recents file that cannot be read or saved only warns. `/api/state` returns the workspace as `{root, start}`.
- `POST /api/workspace`: `~` expansion, 409 when a workspace is open, 404 for a missing path, 400 for a relative one.
- `GET /api/complete` in `tree.rs`: path suggestions for the picker.
- `GET /api/recents`, newest first. The Rust side of milestone 2 is complete.
- `/api/state` returns `home`, so that the picker shows paths as `~/…`.
- The picker screen: `api.ts`, `picker.ts`, provisional `base.css` and `components.css`, and `bun test` for its pure functions. Until milestone 4, an open workspace shows a one-line placeholder.
- The first-start dialog in `dialogs.ts`: a native `<dialog>`; Continue or Esc saves the choice through `PUT /api/settings`.
- Messages that come from the OS lose their "(os error N)" suffix, on the command line and in the API.
- Review loop over milestones 1 and 2: 5 rounds and a simplify pass; fixes in their own commits. Follow-ups are listed under Open points.
- The picker highlights no row until ↑ or ↓: Enter opens the field's text unless you chose a row.

## Milestone 3: sidebar

- `GET /api/tree` in `tree.rs`: the `ignore` walker, run with `spawn_blocking`; `AppState::workspace()` gives 409 when none is open.
- `sidebar.ts` pure functions with `bun test`: sort, flatten, folders to open, fuzzy filter with `@leeoniya/ufuzzy`. Sidebar details recorded in the spec.
- The tree view: folders open and close, open folders are remembered per workspace, a click goes to `/view/<path>` (Back works), the current file is highlighted. Icons moved to a shared `icons.ts`.
- Sort button in a sidebar header: name A→Z, Z→A, newest, oldest, folders first; the choice is remembered; one icon per order.
- Filter: fuzzy match on file names, flat results with bold letters and the folder in grey; ↑↓, Enter (chosen or first result), Esc.
- Resize handle (mouse or ←→, 180–480 px, remembered), hide and show from the status bar (remembered), and below 900 px an overlay that Esc, the backdrop or opening a file closes.
- `keys.ts`: one listener and a key map; `b` hides or shows the sidebar, `/` focuses the filter. Ignored while typing in a field and with Ctrl, Alt or Meta.
- Copy path on hover: a button next to each row copies the workspace-relative path; a check or a cross shows the result.
- Review loop over milestone 3: 5 rounds and a simplify pass; fixes in their own commits. Links that leave the workspace and ignore files above it no longer reach the tree; the filter matches accented names.

## Milestone 4: viewing

- `render.rs`: markdown with comrak (GFM, footnotes, alerts, heading ids without prefix, `data-sourcepos`). Front matter is hidden: `---` by comrak, `+++` replaced with blank lines so the line numbers still match the file. insta snapshots of the fixtures in `tests/fixtures/`.
- ammonia rules in `render.rs`: the defaults, plus `class`, `id`, `data-sourcepos`, footnote and heading-anchor attributes, `section`, and task-list inputs (forced to checkboxes). A hostile-HTML fixture pins the output.
- Relative URLs become `/raw/…` paths: `render::markdown` takes the file's path and resolves them against its folder with `url::Url::join`; `#…` links stay as they are.
- One extension table: `render::Family` maps each extension to a family; `/api/tree` sends it on each file, and the sidebar picks the icon from it. `VIEWABLE` and `FAMILIES` are gone.
- `render::file(family, path, text)`: markdown, escaped code for text and data, `<pre class="mermaid">`, CSV tables with the `csv` crate, `<img src="/raw/…">`. A fixture and a snapshot for each.
- `GET /api/file` with `document.rs`: read through the `Dir` in `spawn_blocking`, 1 MB guard (images are not read), 404 for unknown, missing and non-file paths, 403 for `..`, absolute paths and links out. Timed: a dense 1 MB markdown file takes 0.9 s in release, ten times that in debug.
- `GET /raw/*path`: images with their type, any other file as `text/plain`, every file served with the sandbox CSP; the page's CSP middleware keeps a policy that a handler set. Tests for a `.png`, an `.svg`, an `.html`, 404 and 403.
- The view: `view.ts` fetches `/api/file` and shows the HTML in `#mdame-content`, drops late answers, and scrolls to `#…`; provisional `content.css`. Links to a file of the tree open it in the page; moving between `#…` of one file only scrolls.
- `codehl.ts`: code blocks coloured with Lezer and `classHighlighter` (`tok-*` classes, provisional `--hl-*` colours). `bun test` checks JSON, YAML, `yml`, TOML (a legacy mode) and Rust. `@codemirror/language-data` has no GraphQL: `.graphql` and `.gql` stay plain text.
- `diagrams.ts`: Mermaid, loaded on the first diagram, `securityLevel: 'strict'`, theme from `--mermaid-theme`; a diagram that fails keeps its source with the error below. `web/dist` is now 204 files, 7 MB, still reproducible.
- Copy buttons: one `copyButton` in `copy.ts` for the sidebar's copy path, a button on each code block, and the status bar's copy path and copy content (not for images). The status bar shows the file's path and modified time.
- Not-found page, and a "not shown here" page with a link to the raw file for an existing file of another type (`/api/file` answers `not_viewable`, still 404). Links in content open in the app. Empty-workspace page when the tree has no file.
- Review loop over milestone 4, fixes in their own commits: markdown whose HTML nests more than 256 deep gets a notice (ammonia is quadratic in depth; the check is a heuristic), at most two renders run at a time (409 otherwise), `/raw` refuses files over 64 MB (413) and reads with a bound, FIFOs are not opened, an unreadable file is no longer called "outside the workspace", `mdame-` ids and classes are dropped from content, the raw-file link on the "not shown here" page works, and a `#…` target is found again after Mermaid draws.

## Milestone 5: live updates

- `watch.rs`: the `Event` type sent to the browser, and the mapping from one debounced batch to events with workspace-relative paths. `.mdame/` and paths outside the root are skipped; a delete then create of one file is one `changed`; a batch over 100 events, or a rescan, gives `resync`. Events carry no `dir` flag (spec updated).
- The watcher starts with the workspace and stops when it is dropped: debouncer thread → tokio `mpsc` → a task → `AppState::events` (`broadcast`, 256). A watch that cannot start only warns. `tests/watch.rs` ports the mdlive cases; rename pairing on inotify is settled.
- `GET /ws` in `ws.rs`: each tab gets its own receiver; a lagging tab gets `resync`; a closed tab drops its receiver at once. Tests with a real client (`tokio-tungstenite`), including a foreign `Origin` refused with 403.
- Opening a workspace sends `workspace` with its root, so the other tabs still at the picker can follow.
- `live.ts`: the page connects to `/ws` before its first request and reconnects with backoff (500 ms doubling to 10 s); after a lost connection it reloads the state. A tab on the picker follows a workspace opened in another tab; a server restarted on another workspace reloads the page.
- The open file refreshes in place on `changed` or `created` (and after a reconnection): the new HTML is coloured and its diagrams drawn off-screen, then morphed in with idiomorph 0.8. Checked in the browser: a plain write, a vim-style save, diagrams and code blocks keep the scroll position and the unchanged elements; a not-found page shows the file once it is created.
- The sidebar reloads on `created`, `removed` and `renamed`, keeping the open folders, the sort and the filter. A rename of the open file, or of a folder holding it, follows it with `replaceState` and keeps the scroll position. A removal asks the server again rather than showing not-found at once, since the file may already be back; the status bar is cleared on not-found. Checked in the browser.
- Images refresh: a `changed` or `created` image gets a `?v=<time>` on every `<img>` that shows it, embedded or opened alone, and later renders keep that version so a morph cannot put the old image back. Checked in the browser.
- `resync`, like a reconnection, refetches the state, the tree, the open file and every workspace image on screen.
- Done when, checked on 19 October 2026: the ported mdlive watcher cases pass (`tests/watch.rs`), and saves from vim and nvim (`-u NONE`, run from a script) update the page with no reload, at the same scroll position.

### Manual checklist

Run mdame on a test folder, open a long markdown file, scroll halfway, then:

1. Save the file from vim, nvim and another editor: the text updates, the scroll stays, no `~` file shows in the sidebar.
2. Add, delete and rename files and folders from a terminal: the sidebar follows, keeping open folders, the sort and the filter.
3. Rename the open file, then its folder: the address follows, Back does not lead to the old name.
4. Delete the open file: "Not found", and an empty status bar. Write it again: the file shows.
5. Change an image that the file shows, then the file itself: the new image stays.
6. Create a few hundred files at once (`for i in (seq 300); touch $i.md; end`): the page catches up once.
7. Open two tabs on the picker, open a workspace in one: the other follows.
8. Restart mdame: the page reconnects; on another workspace, it reloads.

## Next

1. Review loop over milestone 5, then merge `m5-live` into `main`.

## Open points

- History rewritten on 18 October 2026 so that the front end is TypeScript from the first commit; the JavaScript history is kept in `backup/before-typescript` and `backup/m4-viewing-before-typescript` until they are deleted.

- The watcher watches gitignored folders too (`target/`, `node_modules/`: 2 600 of this repo's 2 900 folders), so a `cargo build` in the workspace sends events and `resync`s for files the tree never shows. Measure in the browser after milestone 5 before filtering.
- `--no-open` flag: in the spec's v1 flags. Build it in milestone 8, or sooner if the tabs that `mise run dev` opens on each restart get in the way.
- `mise run dev -- -v`: argument passing to mdame not checked yet.
- From the review of milestone 4, for later: stream `/raw` instead of reading the file whole (capped at 64 MB now); open files with `O_NONBLOCK` so that a file swapped for a FIFO between the type check and the open cannot block a thread; "Copy content" fetches before it writes to the clipboard, which Safari may refuse, and the failure tooltip then blames localhost.
- Handlers all live in `server.rs`; the spec's `api.rs` + `api/` split (`files.rs`, `history.rs`, `workspace.rs`) is not done. Do it when `server.rs` gets hard to read, in a commit of its own.
- Debug builds render a dense 1 MB markdown file in about 10 s. If `mise run dev` feels slow, `[profile.dev.package."*"] opt-level = 2` optimizes the dependencies only.
- From the review of 18 October 2026, for later:
  - Security: refuse `/api/*` when `Sec-Fetch-Site: cross-site`; run `/api/complete` in `spawn_blocking`; remove `?t=` from the address bar once the cookie is set; state in the threat model that the machine has one user.
  - Usability: print a usable address when bound to `0.0.0.0`; debounce completion requests; unknown `/api/*` routes and wrong methods should use the spec's error shape; `-p 80` gets 403.
  - Tests: shared helpers in `tests/common`; `local()` paths in an owned temporary folder; `home` in `AppState` so route tests can control `~`.
- From the review of milestone 3, for later:
  - Sidebar: `mount` and `setupLayout` return controller objects instead of setting module-level functions; `aria-selected` for the arrow-key choice, as in the picker.
  - Big workspaces: a limit on the filter results, latinized names computed once, cached icons; `/api/tree` walks the whole folder on each request. Measure with the milestone 5 refetches first.
  - Tests: a `get_json` helper in `tests/common` for `tree.rs`, `complete.rs` and `state.rs`.
