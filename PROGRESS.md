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
| 4 | Viewing | In progress, on `m4-viewing` | 4 of about 11 |
| 5 | Live updates | — | about 9 |
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

## Next

1. Milestone 4: `render.rs` for the other file types (text and data as code, Mermaid, images) behind one function, then CSV, then the 1 MB guard with `/api/file`.

## Open points

- `--no-open` flag: in the spec's v1 flags. Build it in milestone 8, or sooner if the tabs that `mise run dev` opens on each restart get in the way.
- `mise run dev -- -v`: argument passing to mdame not checked yet.
- From the review of 18 October 2026, for later:
  - Security: refuse `/api/*` when `Sec-Fetch-Site: cross-site`; run `/api/complete` in `spawn_blocking`; remove `?t=` from the address bar once the cookie is set; state in the threat model that the machine has one user.
  - Usability: print a usable address when bound to `0.0.0.0`; debounce completion requests; unknown `/api/*` routes and wrong methods should use the spec's error shape; `-p 80` gets 403.
  - Tests: shared helpers in `tests/common`; `local()` paths in an owned temporary folder; `home` in `AppState` so route tests can control `~`.
- From the review of milestone 3, for later:
  - Sidebar: `mount` and `setupLayout` return controller objects instead of setting module-level functions; `aria-selected` for the arrow-key choice, as in the picker.
  - Big workspaces: a limit on the filter results, latinized names computed once, cached icons; `/api/tree` walks the whole folder on each request. Measure with the milestone 5 refetches first.
  - Tests: a `get_json` helper in `tests/common` for `tree.rs`, `complete.rs` and `state.rs`.
