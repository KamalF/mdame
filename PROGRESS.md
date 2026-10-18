# mdame progress

Where the build stands against the milestones in `docs/SPEC.md`.

## How we work

One commit at a time. Claude writes the code and its tests, and runs fmt, clippy and the tests. Kamal reads the code, asks questions and writes the commit message. One branch per milestone.

## Milestones

| # | Milestone | Status | Commits |
| --- | --- | --- | --- |
| 1 | Skeleton | Done 17 October 2026, merged into `main` 18 October | 9 |
| 2 | Workspaces | In progress, on `m2-workspaces` | 5 of about 9 |
| 3 | Sidebar | — | about 8 |
| 4 | Viewing | — | about 11 |
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

## Next

1. `AppState` holds the workspace; the path argument opens it and adds it to the recents.
2. `POST /api/workspace` (409 when one is open), `~` expansion, `/api/complete`.
3. Design round for the picker screen and the first-start dialog, before their UI.

## Open points

- `--no-open` flag: in the spec's v1 flags. Build it in milestone 8, or sooner if the tabs that `mise run dev` opens on each restart get in the way.
- `mise run dev -- -v`: argument passing to mdame not checked yet.
