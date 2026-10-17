# mdame progress

Where the build stands against the milestones in `docs/SPEC.md`.

## How we work

One commit at a time. Claude writes the code and its tests, and runs fmt, clippy and the tests. Kamal reads the code, asks questions and writes the commit message. One branch per milestone.

## Milestones

| # | Milestone | Status | Commits |
| --- | --- | --- | --- |
| 1 | Skeleton | Done 17 October 2026, on `m1-skeleton`, not merged | 9 |
| 2 | Workspaces | Next | about 9 |
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

## Next

1. Review milestone 1 and merge `m1-skeleton` into `main`.
2. Milestone 2, Rust side first: config and recents, the cap-std `Workspace`, `POST /api/workspace`, `/api/complete`, and the path argument.
3. Design round for the picker screen and the first-start dialog, before their UI.

## Open points

- `--no-open` flag: proposed so that `mise run dev` stops opening a tab on each restart. Not in the spec; decide before milestone 2 if the extra tabs get in the way.
- `mise run dev -- -v`: argument passing to mdame not checked yet.
