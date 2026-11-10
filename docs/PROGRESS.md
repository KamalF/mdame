# mdame progress

Where the build stands against the milestones in `docs/SPEC.md`.

## How we work

One commit at a time. Claude writes the code and its tests, and runs fmt, clippy and the tests. Kamal reads the code and asks questions. For each commit of milestone 12, Kamal says when it is ready who writes the message: he does, or Claude does after a quiz on the commit. A change with open design questions starts with a design session, right before its code. One branch per milestone.

## Milestones

| # | Milestone | Status | Commits |
| --- | --- | --- | --- |
| 1 | Skeleton | Done 17 October 2026, merged into `main` 18 October | 9 |
| 2 | Workspaces | Done 18 October 2026, merged into `main` the same day | 20, with the review fixes |
| 3 | Sidebar | Done 18 October 2026, merged into `main` the same day | 19, with the review fixes |
| 4 | Viewing | Done 18 October 2026, merged into `main` the same day | 16, with the review fixes |
| 5 | Live updates | Done 19 October 2026, merged into `main` 20 October | 56, with the review fixes |
| 6 | Editor | Done 25 October 2026, merged into `main` the same day | 68, with the review fixes |
| 7 | Revisions | Done 29 October 2026, merged into `main` the same day | 31, with the review fixes |
| 8 | Themes and polish | Done 3 November 2026, merged into `main` the same day | 31, with the review fixes |
| 9 | Agent workflow | Done 7 November 2026, merged into `main` the same day | 22, with the review fixes |
| 10 | Release | Done 8 November 2026, merged into `main` the same day | 50, with the review fixes |
| 11 | Fixes for 0.1.1 | Done 10 November 2026, merged into `main` the same day | 39, with the review fixes |
| 12 | Later items for 0.2.0, then Show HN | Planned 10 November 2026 | 9 in the plan, without the review fixes |
| 13 | Handoff and keys | Scope decided 10 November 2026 | 6 items |

The plan of milestone 12 has 9 commits before its review. Wide blocks and pasted images may each take more than one. Milestone 13 has no plan yet: its 6 items are in the build order of `docs/SPEC.md`.

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

- `watch.rs`: the `Event` type sent to the browser, and the mapping from one debounced batch to events with workspace-relative paths. `.mdame/`, paths outside the root and paths below a symlink are skipped; events are sent unmerged; a batch over 100 events (reads not counted), or a rescan, gives `resync`. Events carry no `dir` flag (spec updated).
- The watcher starts with the workspace and stops when it is dropped: debouncer thread → tokio `mpsc` → a task → `AppState::events` (`broadcast`, 256). A watch that cannot start only warns. `tests/watch.rs` ports the mdlive cases; rename pairing on inotify is settled.
- `GET /ws` in `ws.rs`: each tab gets its own receiver; a lagging tab gets `resync`; a closed tab drops its receiver at once. Tests with a real client (`tokio-tungstenite`), including a foreign `Origin` refused with 403.
- Opening a workspace sends `workspace` with its root, so the other tabs still at the picker can follow.
- `live.ts`: the page connects to `/ws` before its first request and reconnects with backoff (500 ms doubling to 10 s); after a lost connection it reloads the state. A tab on the picker follows a workspace opened in another tab; a server restarted on another workspace reloads the page.
- The open file refreshes in place on `changed`, and on `created`, `removed` or `renamed` of it or of a folder holding it (and after a reconnection): the new HTML is coloured and its diagrams drawn off-screen, then morphed in with idiomorph 0.8. Checked in the browser: a plain write, a vim-style save, diagrams and code blocks keep the scroll position and the unchanged elements; a not-found page shows the file once it is created.
- The sidebar reloads on `created`, `removed` and `renamed`, keeping the open folders, the sort and the filter. A rename of the open file, or of a folder holding it, follows it with `replaceState` and keeps the scroll position. A removal asks the server again rather than showing not-found at once, since the file may already be back; the status bar is cleared on not-found. Checked in the browser.
- Images refresh: a `changed`, `created` or `renamed`-to image, or one in such a folder, gets a `?v=<time>` on every `<img>` that shows it, embedded or opened alone, and later renders keep that version so a morph cannot put the old image back. Checked in the browser.
- `resync`, like a reconnection, refetches the state, the tree, the open file and every workspace image on screen.
- Done when, checked on 19 October 2026: the ported mdlive watcher cases pass (`tests/watch.rs`), and saves from vim and nvim (`-u NONE`, run from a script) update the page with no reload, at the same scroll position.

- Review loop over milestone 5: 15 rounds and a simplify pass, fixes in their own commits:
  - The watcher no longer follows symlinked folders, and drops events below a symlink inside the workspace, so outside names never reach the tabs.
  - Reads (inotify `IN_OPEN`) no longer count in the burst rule: a tree walk in a workspace of over 100 folders made an endless `resync` loop.
  - The server sends events unmerged: three rounds found folder swaps that a merge turned into a wrong `changed`. The page tells saves from swaps by asking for the open file again, and follows a rename only when the open file is gone (Emacs and `set backup` saves).
  - The workspace opens in `spawn_blocking`, with the watcher started before the lock; the `workspace` root goes out as text.
  - Page: an image without `src` no longer breaks a file; a file moved onto the open one, a folder brought back, and images in a swapped folder refresh; one tree reload per batch; events during the first tree load are not lost; an open `<details>` stays open; a busy 409 during a refresh is retried; the filter keeps its arrow-key choice and the tree its keyboard focus; a date sort reorders on a change; a removed image leaves the page. An unreadable folder, or one deleted while the watch starts, no longer turns off live updates for the whole workspace.
  - Simplify pass: one rule in `onEvent` for every path event, with one render per batch; image versions looked up through the folders of their path; copy buttons replaced only when a morph copied them; `OWN_DIR` for `.mdame`.
  - Follow-ups and deferred nits are under Open points.

### Manual checklist

Run by hand on 20 October 2026: all 8 checks passed. Run mdame on a test folder, open a long markdown file, scroll halfway, then:

1. Save the file from vim, nvim and another editor: the text updates, the scroll stays, no `~` file shows in the sidebar.
2. Add, delete and rename files and folders from a terminal: the sidebar follows, keeping open folders, the sort and the filter.
3. Rename the open file, then its folder: the address follows, Back does not lead to the old name.
4. Delete the open file: "Not found", and an empty status bar. Write it again: the file shows.
5. Change an image that the file shows, then the file itself: the new image stays.
6. Create a few hundred files at once (`for i in (seq 300); touch $i.md; end`): the page catches up once.
7. Open two tabs on the picker, open a workspace in one: the other follows.
8. Restart mdame: the page reconnects; on another workspace, it reloads.

## Test cleanup before milestone 6

Done 20 October 2026, after the testing rules in `docs/SPEC.md`:

- The guard as one table test.
- `tests/routes.rs`: every route refuses a foreign `Origin`, every route that changes state takes JSON only, every path route stays in the workspace. The per-route copies are gone; `tests/common` holds the shared helpers.
- One home per rule: front matter, `.mdame` filtering, lookup-table tests. The hostile-HTML test checks for dangerous tags, attributes and URLs, beside its snapshot.
- Property tests (`proptest`, `fast-check`) for relative URL rewriting and the view URL round trip.
- `live.react`: the page's reaction to a live event, as a pure function with tests.
- `cargo mutants` baseline: 294 mutants, 31 missed. Tests added for the constant-time token compare, the 1 MB and 64 MB limits at their boundary, the port fallback on other errors, the refusal message and a workspace path through a file. The mutants that no test should catch are excluded in `.cargo/mutants.toml`, each with its reason.
- Under load, a watcher test failed in 1 of 40 runs (an extra `changed` from a late batch), which counts a mutant as caught when no check caught it. `cargo mutants` now runs the tests through nextest, whose `mutants` profile retries the watcher and WebSocket tests twice. The full run with retries, on 20 October 2026, found 5 more survivors that the baseline had counted as caught: tests for an unreadable config file and for a link to a file in the completion, and 3 more exclusions.

## Milestone 6: editor

Decided on 20 October 2026:

- A save writes the file in place (truncate, then write). The inode, the permissions and the hard links stay. The snapshot covers a crash during the write.
- If the file changes on disk and the editor has no unsaved edits, the editor reloads it silently, with a minimal change so that the cursor and the scroll stay. If the editor has unsaved edits, a notice offers Reload (one transaction, so Ctrl+Z gets the edits back) or Overwrite (the disk version becomes a snapshot first). A deleted file gets the same notice, without Reload; its Overwrite creates the file again. A `changed` event whose version equals the editor's base version is our own save.
- The editor refuses a file that is not valid UTF-8, and an image.
- The editor and the save share one size limit: 8 MB.
- Pruning waits for milestone 7.
- A revision is the content on disk just before mdame writes over it. Saves from other editors make no snapshot, and Reload keeps the discarded edits only in the undo history.

Rules, as test names, by commit:

1. `history.rs` (done): `workspace_mode_keeps_history_in_dot_mdame`, `creating_dot_mdame_writes_its_gitignore`, `an_existing_dot_mdame_is_left_as_it_is`, `state_mode_keeps_history_under_the_encoded_workspace_path`, `encode_path_replaces_every_non_alphanumeric_with_a_dash`, `snapshot_goes_under_the_file_path_named_by_the_time`, `two_snapshots_in_the_same_millisecond_are_both_kept`.
2. `GET /api/source` (done): `source_returns_the_text_and_its_version`, `version_follows_the_content`, `source_refuses_what_is_not_utf8_text` (an image too: 404 `not_viewable`), `source_refuses_a_file_over_the_edit_limit`; rows in the `tests/routes.rs` matrix.
3. `PUT /api/file` with JSON `content` and `base_version`, 409 (done): `save_writes_the_content_when_the_version_matches` (it also returns the new version), `save_snapshots_the_old_content_first`, `save_with_a_stale_version_is_refused_and_writes_nothing`, `save_of_a_deleted_file_is_refused`, `save_takes_content_up_to_the_edit_limit`; rows in the routes matrix. A save never creates a file: `POST /api/file` does, as the spec says.
4. `POST /api/render` (done): `preview_gives_the_same_html_as_the_view`, `preview_over_1_mb_shows_a_notice`; rows in the routes matrix.
5. Editor screen (done): `/edit/<path>`, `e` and the Edit button open it, `Esc` closes it, Cmd/Ctrl+S and the Save button save, an unsaved dot, a dialog before in-app navigation loses edits, and the browser's leave-page warning. No unit test: all of it is DOM wiring or CodeMirror's own `doc.eq`; the manual checklist covers it. A save error shows in the status bar until the notice of commit 9.
6. Split, divider, preview (done): the preview renders through `POST /api/render` 150 ms after typing stops, morphed in as a view refresh; the divider and the preview toggle are remembered in `localStorage`. `latestOnly` (`latest.ts`): `an answer older than the latest call is dropped`. The review replaced it with the queue of `serial.ts`: a tab runs one render at a time. `load` and `store` moved from `sidebar.ts` to `storage.ts`.
7. Scroll sync (done): `scrollsync.ts`, with no DOM: `maps a line to the last block starting at or before it`, `interpolates towards the next block`, `before the first block is the top`, `past the last block is the end`, `a block that would move back is skipped`, `preview to editor inverts editor to preview` (property test, between the first and the last anchor). The wiring in `editor.ts` keeps the preview aligned after each render.
8. Ctrl+B, Ctrl+I, Tab, line numbers (done): `format.ts`: `bold wraps the selection`, `bold unwraps an already bold selection` (markers just outside the selection or at its ends, `*` only: `_` is often part of a name), `bold on an empty selection puts the cursor between markers`, the same three for italic, `bold and italic stack`, `tab inserts two spaces at the cursor`, `tab indents the selected lines`. Shift+Tab removes one indent level. `basicSetup` already shows the line numbers.
9. Changed-on-disk notice (done): `disk.ts`: `a change whose version equals the base is our own save`, `a change with unsaved edits shows the notice`, `a change without unsaved edits reloads`, `a removal shows the notice with nothing to reload`, `a reload keeps the cursor between two changes`, `a reload gives the text on disk` (property test). `live.ts`: `concerns names the open file, a folder holding it, and either end of a rename`. The notice is a CodeMirror panel above the text. A deleted file gets the notice even without unsaved edits. A save refused with 409 shows the notice (412 since rule 11). Saves and disk checks run one at a time. The reload diff comes from `@codemirror/merge`, a milestone 7 dependency added early.
10. New file in a folder (done): `POST /api/file` with `{path}`: `create_makes_an_empty_file`, `create_of_an_existing_file_is_refused`, `create_refuses_a_type_that_the_editor_cannot_open`, `create_in_a_missing_folder_names_the_folder`, `create_stays_in_the_workspace`; `save_of_an_empty_file_makes_no_snapshot`; a row in the routes matrix. `dialogs.ts`: `a name with no extension gets .md`, `a name with an extension stays as typed, without the spaces around it`, `an empty name gives null`. A hover button on folder rows and a button in the sidebar header open the new-file dialog. The deleted-file notice offers Recreate: it creates the file, then saves.
11. Switch to `ETag`, `If-Match`, 412, and 428 without `If-Match` (done): `GET /api/source`, `PUT` and `POST /api/file` send the version as an `ETag` header and no longer in the body. `save_with_a_stale_version_is_refused_and_writes_nothing` (now 412), `save_without_if_match_is_refused` (428), `if_match_must_be_one_strong_etag`; the source, create and routes tests read the header. In the client, `send` in `api.ts` gives the response, for its headers.
12. Manual checklist, `cargo mutants`, review loop.

- Review loop over milestone 6: 29 rounds and a simplify pass, converged on 24 October 2026. On 25 October, Kamal chose a simpler access design than the one that the review had reached (see the SPEC's Decided table), and the review's fixes were regrouped by topic: they are the commits after 849e238.
  - Access: the token is required on loopback too, and kept in a 0600 file. The URLs that mdame opens and prints carry one-time codes; a code used twice gives a new token. Programs built to attack mdame from this machine are out of scope.
  - Saving: a failed save leaves the file and the history as they were. A save of the text on disk writes nothing. A file renamed over the path during a save gets 412. Saves and disk checks run one at a time, and none is dropped.
  - Limits: the editor opens only visible text files that the view shows, through links too, and the picker refuses hidden folders. Snapshots, `.mdame` and the state folder are private.
  - Page: one preview render at a time; the file's line breaks are kept; a reload keeps the cursor across many changes; a deleted file counts as unsaved; Esc, Ctrl+S and Ctrl+B/I fixes. After a lost connection, the page sends nothing until mdame is back on the same folder.
- `cargo mutants` after the review, on 25 October 2026: 381 mutants, 13 missed and 3 timeouts. Tests now catch 6 of them (`watch_around`, which notify's partial watches had hidden, and `has_display`). `run` names every field of its access, so that a lost token does not compile. The 9 others are excluded with their reasons. A run over the changed files then found none missed.

### Manual checklist

Run by hand on 25 October 2026: all 24 checks passed. These checks cover what no unit test covers. Run mdame on a test folder that holds a long markdown file, in Chrome and Firefox.

Editor:

1. `e` and the Edit button open the editor, and Esc closes it. Ctrl+S and the Save button save. The unsaved dot shows after an edit and clears after a save, or after an undo back to the saved text. With unsaved edits, Back or a click in the sidebar asks first, and closing the tab warns.
2. Drag the divider and hide the preview: both stay as set after a reload.
3. Scroll the editor, then the preview: each pane follows the other. Scroll a long file to its middle, then run "replace all" (Ctrl+F) with a longer text: both panes stay on the same section. Checked on 21 October 2026 with Chrome's scroll anchoring off.
4. In Firefox, scroll the preview of a file with a closed `<details>` near the top: the editor does not jump to the line of the hidden block.
5. Ctrl+B and Ctrl+I wrap a selection and unwrap it; Tab indents the selected lines.
6. Change the open file from a terminal: with no edits, the editor reloads it with no notice, and the cursor stays. With edits, a notice offers Reload and Overwrite. Delete the file: the notice offers Recreate.
7. Open a file in the editor, make no edit, and delete it from a terminal: the unsaved dot shows, and Esc asks first.
8. The new-file button of a folder opens the dialog; the new file opens in the editor. `docs//notes` gives `docs/notes.md`.
9. In the editor of a large file, type in several bursts: DevTools shows one `POST /api/render` at a time.
10. On an image, a hidden file, or a file over 8 MB, the status bar has no Edit button, and `e` does nothing.
11. With the system in dark mode, the editor's cursor, selection and line numbers are readable, and so is the completion list that `<d` opens.
12. With Caps Lock on, Ctrl+S in the editor saves and opens no browser dialog.
13. With unsaved edits, a click on a `#…` link in the preview keeps them.
14. Below 900 px, with the sidebar overlay open over the editor, the first Esc closes the overlay, and the second closes the editor.
15. With unsaved edits, press Back, change the file of the previous page on disk while the dialog is open, and choose Keep editing: the editor is still there.

Connection:

16. Stop mdame while the editor has unsaved edits, and press Ctrl+S: the status bar says to try again once mdame is back. Start mdame again: the tab reconnects, and Ctrl+S saves.
17. Restart mdame on the same folder: the open tab keeps working, with the same sidebar width and open folders.
18. Restart mdame on another folder: the tab reloads. With unsaved edits, stay on the page: Ctrl+S writes nothing and says to copy the text and reload.

Access:

19. mdame opens `http://127.0.0.1:4891/?c=…`, and the address bar then shows no `c=`. A reload of that tab after a minute still works (the cookie).
20. Open `http://127.0.0.1:4891/` in a private window: 403 "missing or wrong token".
21. The URL that mdame prints works once, within ten minutes. A second use gets 403: mdame prints a new URL, and the tabs of the old token get 403.
22. Delete `~/.local/state/mdame/token` and restart mdame: the old tab gets 403, and the new one works. Keep the old tab in a browser that mdame does not open: the tabs of a browser share the cookie.
23. Start mdame over SSH, with no display: it opens no browser and says to open the printed URL.
24. Start mdame on a large folder whose first walk takes over a minute: the opened tab still gets in. Checked on 25 October 2026 on `~/dev`, with mdame paused for 75 s during the walk.

## Milestone 7: revisions

Decided on 25 October 2026:

- A revision goes under the real path of its file, relative to the workspace. A link or a `..` in the path asked does not split the revisions of one file.
- `GET /api/history` creates no folder. A file that mdame never saved over has no revisions.
- The `id` of a revision is its file name, such as `1771271566123.md`. The routes refuse any other form: digits, then an optional extension, with no `/`.
- Pruning runs after the write. It keeps the newest `snapshots_per_file` revisions (20 by default), ordered by the time in their name, and the snapshot that the save just made. It deletes no file with another name, and no folder or link. A failed prune gives a warning and does not fail the save.
- Restore writes the bytes of the revision over the file, as a save does. It writes in place, after a snapshot of the current content, and one at a time with the saves. It needs no `If-Match`: the snapshot keeps the text that it replaces. If the revision equals the file, restore writes nothing. A deleted file gets 404. Restore refuses a revision or a file that is not UTF-8, as the editor does.
- Diff mode follows the wireframe. The editor shows its text as an inline diff against the chosen revision, and stays editable. The list of revisions takes the place of the preview, with Restore below it. No revert per change: restore writes the whole file, since the spec dropped restoring into the editor.
- With unsaved edits, Restore replaces them as Reload does, in one undo step: Ctrl+Z brings them back.
- The list shows the time and the size of each revision. Only the chosen revision shows its count of added and removed lines: a count on each row would fetch every revision.
- `h`, `r` and a Revisions button in the status bar open diff mode against the newest revision.
- Esc closes the revisions panel first, and the editor stays open. A second Esc closes the editor, as with the sidebar overlay.

Decided on 28 October 2026, after the review:

- A revision name dated after now, from a clock that was ahead, counts as the oldest: the list shows it last, and pruning deletes it first.
- In `state` mode, two workspaces whose paths encode to one name, such as `/x/my notes` and `/x/my-notes`, share one history. The layout stays. When a workspace opens in `state` mode, mdame warns in the terminal if a recent workspace encodes the same.

Rules, as test names, by commit:

1. Revisions under the real path (done): `a_snapshot_goes_under_the_real_path_of_the_file`.
2. Pruning (done): `prune_keeps_the_newest_snapshots` (by time, not by name: `999` is older than `1000`), `prune_deletes_no_other_file`, `save_prunes_to_snapshots_per_file` (20 by default), `a_save_succeeds_when_pruning_fails`.
3. `GET /api/history` and `GET /api/history/view` (done): `history_lists_the_revisions_newest_first` (through a link too), `history_of_a_file_never_saved_is_empty`, `listing_creates_no_history_folder` (both modes), `history_view_returns_the_revision_text`, `an_id_names_a_revision_of_this_file_only` (`/` in the `id`, a missing one, no history folder), `history_view_refuses_a_revision_that_is_not_utf8`; rows in the routes matrix.
4. `POST /api/history/restore` (done): `restore_writes_the_revision_over_the_file`, `restore_keeps_the_current_content_as_a_revision` (a second restore undoes the first), `restore_of_a_deleted_file_is_refused`; a row in the routes matrix. The write is a save, so the save's tests cover the rest.
5. Diff mode (done): the list, the merge view, `h`, `r`, the Revisions button in the view and in the editor, Esc. `revisions.ts`: `dayOf says today, yesterday, or neither, across midnight`, `sizeLabel gives bytes, then KB and MB with one decimal`, `lineCounts counts a changed line once as added and once as removed`. The list refreshes after a save and after a change on disk. The DOM wiring goes to the manual checklist.
6. Restore from the panel (done): the Restore button restores the revision on screen. The restore runs in the editor's queue, with the saves and disk checks. The editor then takes the text in one undo step, as Reload does, and the list refreshes. A revision's time is when mdame saved over its text: each row's tooltip says so. No unit test: all of it is wiring; the manual checklist covers it.
7. Manual checklist, `cargo mutants`, review loop.

- `cargo mutants` over the milestone 7 diff, on 28 October 2026: 63 mutants, 5 missed. Tests now catch 4 of them. A history that cannot be read gives an error, not an empty list. A prune reports a snapshot that it cannot delete. The 5th needs a race, and is excluded with its reason.

- Review loop over milestone 7: 6 rounds and a simplify pass, converged on 28 October 2026. Fixes in their own commits:
  - A revision opens only if it is a regular file, not a link or a FIFO, and is read up to 8 MB.
  - Only regular files count as revisions. Their type comes from a stat, since some file systems give none in a listing. A snapshot that another mdame prunes during a listing is skipped.
  - A save always keeps the snapshot that it made, unless `snapshots_per_file` is 0.
  - mdame refuses a link at `.mdame` or `.mdame/history`. Through such a link, pruning could delete notes of the workspace.
  - In state mode, a restore makes the state folder private before its snapshot, as a save does.
  - An `id` with a NUL byte gives 404.
  - Page: a revision that failed to load can be chosen again, and so can the one on screen. A refresh loads the chosen revision again when it is not on screen.
  - Follow-ups and deferred nits are under Open points.
- `cargo mutants` over the milestone 7 diff after the review, on 28 October 2026: 64 mutants, 3 missed and 1 timeout. A test now catches the missed one in `open`. The FIFO test checks its link case first, so a mutant fails it rather than hanging it. The 2 others, in `list`, need a race, and are excluded with their reason.
- After the manual checklist, on 29 October 2026: the counts of the chosen revision show the added lines in green and the removed lines in red. The colour is `--success`, the name that milestone 8 decided, added to the provisional theme values.

### Manual checklist

Run by hand on 29 October 2026: all 13 checks passed. These checks cover what no unit test covers: the DOM wiring of diff mode and Restore, and the warning in the terminal. Run mdame on a test folder, in Chrome and Firefox. First, save a markdown file three times from the editor, with a small change each time.

Diff mode:

1. In the view of that file, `h`, `r` and the Revisions button each open the editor in diff mode against the newest revision. In the editor, the Revisions button opens and closes the panel. While the focus is in the text, `h` and `r` type a letter.
2. Each row shows a time ("Today 14:05", "Yesterday 09:12", or a date) and a size. Its tooltip says when mdame saved over that text. Only the chosen row shows its added and removed lines, and they change as you type.
3. Click an older row: the inline diff follows it, and the Restore button names its time.
4. While the panel is open, the status bar has no preview toggle. Esc closes the panel, the editor stays, and the preview comes back if it was on. A second Esc closes the editor.
5. With the system in dark mode, the added and deleted lines of the diff are readable.
6. On an image or a hidden file, the status bar has no Revisions button, and `h` does nothing. A file that mdame never saved says "No revisions yet", and Restore is off.

Restore:

7. Restore an older revision: the editor and the file on disk get its text, and the list gains a revision, the text from before. Ctrl+Z brings back that text, unsaved edits too.
8. Restore the newest revision: the first restore is undone on disk.

The list:

9. Save the file in a second tab: the list of the first tab gains the revision.
10. In the file's folder under `.mdame/history/`, run `printf '\xff' > 999999999999.md`, a revision that is not UTF-8. Click its row: the panel shows "not a UTF-8 text file". Click the revision on screen: it is chosen again, and Restore works.
11. Stop mdame, then click another row: the panel says to try again once mdame is back. Start mdame again: that revision loads by itself.
12. Add a revision named `99999999999999.md`: it shows last in the list, dated in the year 5138, and diff mode opens against the real newest.

State mode:

13. With `history = "state"` in `config.toml`, open a folder `my notes`, quit, then open a folder `my-notes` beside it: the terminal prints a warning that names both folders.

## Milestone 8: themes and polish

Decided on 28 October 2026:

- The theme choice lives in `localStorage`, per browser. The `theme` field leaves `Config`: an old `config.toml` that sets it stops mdame at start, as any unknown key does.
- A theme sets `color-scheme: light` or `dark`. mdame loads the built-in theme of that scheme first, then the theme over it, so a user theme may set only the variables that it changes. `color-scheme` also picks Mermaid's theme, and `--mermaid-theme` goes.
- The diff's added and removed lines mix `--success` and `--danger` into the background: themes set no diff colours. Shadows and backdrops stay translucent black, outside the contract.
- A theme button in the status bar opens a menu: System, Light, Dark, then the user themes.
- IBM Plex Sans and Mono are bundled as woff2 (OFL).
- CI runs on GitHub Actions. The licence is MIT.

Decided on 29 October 2026, after a market study (kept outside the repo, in `~/dev/claude/mdame-market-2026-10-28/`): v1 becomes the version for a Show HN.

- Toasts and the mono toggle leave milestone 8 for Later.
- Milestone 9, agent workflow: agent folders in the tree (view-only), handoff to the running instance, what changed, full-text search, copy as quote, clickable task lists, content width and font size, shortcut help, an agent snippet and skill.
- Milestone 10, release: macOS editing and a macOS CI runner, release binaries through cargo-dist, release 0.1.0 of the crate, the README with a demo. Then the Show HN.
- The small Later items become milestone 11.

Decided on 29 October 2026, after a comparison with mo: mdame does one job, and does it completely, with as little code as it can.

- The workspace picker goes, with the recents and workspace switching. mdame starts from a terminal, where `mdame` with no path opens the current folder.
- The choice of history location goes, with the first-start dialog. Revisions live in `<workspace>/.mdame/history/`. mdame never writes `config.toml`.
- Proposed, to settle before milestone 9: a smaller milestone 9, and a milestone 10 that measures the footprint against VS Code. See Open decisions in `docs/SPEC.md`.

Rules, as test names, by commit. Done when: a user theme dropped into `~/.config/mdame/themes/` appears in the theme picker without a restart.

1. CI on GitHub Actions (done): on each push and pull request, a Linux runner checks the format, then runs `lint`, `test` and `check-dist`. First, because the repository is public now: CI checks each push from here on. No test: done when a push of `m8-themes` gets a green run.
2. No picker (done): `mdame` with no path opens the current folder. `picker.ts`, `GET /api/complete`, `GET /api/recents`, `POST /api/workspace`, `recents.toml`, `home` in `/api/state` and the `workspace` event go, with the page's code for a tab on the picker and the refusal of a hidden folder. `AppState` holds the workspace with no lock and no `Option`, so the 409 "no workspace is open" goes. The tests of the removed code go, and so do their rows in the routes matrix. The README's usage follows. No new test: the path defaults to `.`.
   - The warning about shared histories goes here too: it compared the workspace with the recents.
   - mdame opens the workspace before it builds `AppState`. Tests that read no file get an empty workspace in `target/tmp/empty`.
3. No history choice (done): revisions live in `<workspace>/.mdame/history/`. The `history` field of `Config` goes: an old `config.toml` that sets it stops mdame at start, as any unknown key does. `state` mode, `encode_path`, the first-start dialog, `needs_setup`, `PUT /api/settings` and `config::save` go. Snapshots kept in `state` mode stay in `~/.local/state/mdame/`, and mdame no longer reads them. The tests of the removed code go.
   - `AppState` holds the config with no lock, and no longer holds its path or the state folder. `config::load` reads a `Config` only.
4. `--no-open` (done): mdame prints the URL and opens no browser. `no_open_opens_no_browser`, next to the tests of `has_display`, which becomes `opens_browser`. It closes the open point on `--no-open`.
5. Built-in themes (done): `web/themes/light.css` and `dark.css` hold the Primer value of each contract variable, and `base.css` keeps no colour. The diff mixes `--success` and `--danger` into the background. Mermaid's theme follows `color-scheme`, and `--mermaid-theme` goes. `GET /themes/{name}.css`: `a_builtin_theme_is_css`, `an_unknown_theme_is_404`, `a_theme_name_is_one_segment`; a row in the routes matrix. Until commit 6, the page follows the system.
   - Primer variables: `--bg-raised` is `overlay-bgColor`, `--bg-sunken` is `bgColor-inset`, `--code-bg` is `bgColor-muted`, and `--selection` is `selection-bgColor`. A comment in each theme file names the Primer variable of each value.
   - `mise run web` copies the two files into `web/dist/themes/`, which the binary embeds. Two `<link>`s with a `media` query pick the built-in of the system's scheme.
   - The diff's colours are in the editor's CodeMirror theme: a theme there overrides the merge view's own colours.
6. Theme choice (done): `theme` leaves `Config` (`a_config_that_sets_theme_stops_mdame`). The theme button opens its menu: System, Light, Dark. The choice goes in `localStorage`, and the built-in of the theme's scheme loads first. `theme.ts`: `system follows prefers-color-scheme`, `a stored choice wins`, `an unknown stored theme falls back to system`.
   - The two `<link>`s of commit 5 stay, with an `id`: under System, their media queries follow the system with no script. A stored choice sets their `media` to `all` and `not all`.
   - The menu is a popover above the button, built when it opens. Mermaid takes the theme at each render, so a new choice shows in the next diagrams drawn.
7. User themes (done): each `~/.config/mdame/themes/<name>.css` shows in the menu after the built-ins, and the list is read again each time the menu opens. A user file with a built-in's name overrides it. `state_lists_user_themes_after_the_builtins`, `a_user_theme_overrides_a_builtin`, `a_new_user_theme_shows_without_a_restart`, `a_link_in_the_folder_is_a_theme`, `a_theme_outside_the_folder_is_refused` (`..`).
   - Decided on 2 November 2026: a link in the folder is a theme, wherever it points, since dotfile managers make such links. The plan refused a link that leaves the folder.
   - `/api/state` lists the themes, and the menu asks for it each time it opens. The page loads a stored user theme without the list: if the theme is gone, its link fails and the page shows the system's theme.
   - A user file named like a built-in replaces it whole, so it must set every variable. The README of commit 9 says so.
8. IBM Plex Sans and Mono, bundled as woff2 (done). The credit goes in the README.
   - From Fontsource 5.3.0: Plex Sans as a variable font, so one file per script covers every weight, and Plex Mono at 400 and 400 italic. Bold code is drawn by the browser. Every script that Plex has is bundled, and the browser loads only those that a page uses.
   - Bun 1.4.3 inlines every font that CSS names, as a `data:` URL that the CSP refuses. The fonts are `--external` to the bundle, and `mise run web` copies their woff2 files to `web/dist/assets/files/`. `every_woff2_font_of_the_css_is_served` checks that none is missing. Plex Mono's CSS also names woff files, which no browser that reads woff2 asks for: they are not copied.
   - The OFL texts go in `web/dist/THIRD-PARTY-LICENSES.txt`, with the other npm packages, and not in `LICENSE`, which holds the notices of code copied into the sources.
   - `--font-content` and `--content-width` of the contract now apply to rendered files, with the values of before.
9. `web/themes/README.md` (done): the contract, with a commented template. The README gains a themes section and the Primer credit.
   - The template is the documentation: each variable has the value of the dark built-in and a comment that says where it shows. No separate table.
10. Theme pass (done): each screen in light and dark (view, editor, revisions, dialogs, status bar, theme menu), with contrast checks.
   - A script measured each text and background pair that the screens use, translucent colours blended first. Two failed: accent text on the current file (3.7:1 light, 2.5:1 dark), and Primer's white on the dark accent (3.1:1). Every other pair passes 4.5:1, the diff and each code colour included.
   - The current file keeps `--selection` behind text in `--fg`. Hover no longer uses `--selection`, so it stays apart from the current file: `--hover` in `base.css` mixes `--fg` into the background, as the active line does. Themes do not set it.
   - `--accent-fg` colours the text of accent buttons; dark sets it to `bgColor-inset` (6.6:1). `--warning` colours warning alerts; caution alerts keep `--danger`.
   - The content width is the spec's 60ch.
   - In dark, the dialog's secondary button had the dialog's own colour: it has a border now.
11. Manual checklist, `cargo mutants`, review loop.

- `cargo mutants` over the milestone 8 diff, on 2 November 2026: 62 mutants, 4 missed. A test now catches 2 of them: a user theme that cannot be read gives an error, not a 404. The 2 others are excluded with their reason. The first changes only the line that `run` logs when no browser opens, so the manual checklist must check that `--no-open` logs no "no display" line. The second needs a theme deleted between its check and its read: a race.
- Review loop over milestone 8: a simplify pass and 2 rounds, converged on 2 November 2026. Fixes in their own commits:
  - The editor's gutter shows the active line in Dark, which gives `--bg-raised` and `--bg-sunken` one colour.
  - An unreadable theme gets 403, as an unreadable file does. The theme menu starts from the themes of the first `/api/state`.
  - `history::root` and `open_root` take the workspace folder only. What the picker and the history choice left behind goes.
  - The theme template gives `--content-width` the 60ch of `base.css`.
  - With the theme menu open, Esc closes the menu, not the editor.
  - The editor's panels, buttons, search fields and selection matches take the theme's colours. In Dark, the notice of a change on disk measured 2.7:1.
  - `run` decides `--no-open` once, and `has_display` checks only the display again, as before commit 4. `no_open_opens_no_browser` and the mutants exclusion of the second check go: manual check 16 covers the flag.
  - Follow-ups and deferred nits are under Open points.
- `cargo mutants` over the milestone 8 diff after the review, on 2 November 2026: 60 mutants, none missed.
- A check for over-engineering over the whole code, on 3 November 2026. Fixes in their own commits:
  - Four leftovers of the picker and state mode go: the `ConfigError` enum, the `Arc` around the workspace, the `history` parameter of the revision functions, and the lock that set the open codes after `AppState` was built.
  - The page loses a helper, a check and four CSS rules that changed nothing.
  - Under reduced motion, the sidebar overlay no longer slides: the rule that turned the transition off lost to more specific selectors.
  - Kept: the helpers with one caller whose names say what they do, `errorLine`, which an open point wants to reuse, and the `fileIcon` fallback for a family that Rust may add.

- After the manual checklist, on 3 November 2026: when the menu finds that the chosen theme was deleted, it clears the choice, so the page shows the system's theme at once. Check 1 failed at first in Firefox: the tab still ran the page from before the fix, since a restart on the same folder does not reload it.

### Manual checklist

Run by hand on 3 November 2026: all 17 checks passed. These checks cover what no unit test covers: the theme menu, how each screen looks in each theme, the fonts under the CSP, and the start of mdame. Run mdame on a test folder, in Chrome and Firefox. The folder holds a markdown file with a Mermaid diagram, a code block, a table, and the five alerts: note, tip, important, warning and caution.

Theme menu:

1. The palette button at the right of the status bar opens a menu above it: System, Light, Dark. A check marks the current choice. Esc, a click outside the menu, and a second click on the button each close it. In the editor and in diff mode, Esc closes the menu, and the editor stays.
2. With the system in light mode, choose Dark: the page turns dark with no reload. After a reload, it is dark from the first frame, with no light flash. Choose System: the page turns light. Switch the system to dark mode: the page follows with no reload.
3. After a choice, the next diagram that mdame draws follows the theme: reload the page, or change the file.
4. Choose Dark in Chrome: a second Chrome tab shows Dark after a reload, and Firefox keeps its own choice.

User themes:

5. With the system in dark mode and the menu closed, write `~/.config/mdame/themes/pink.css` with `:root { color-scheme: light; --accent: deeppink; }`. Open the menu: "pink" shows after Dark, with no restart. Choose it: the accent is pink, and every other colour is Light's.
6. With pink chosen, delete `pink.css`, then open the menu: it marks System, and the page shows the system's theme at once.
7. Copy the template of `web/themes/README.md` into `~/.config/mdame/themes/mine.css`, and choose it: the page looks like Dark.

Fonts:

8. Text is IBM Plex Sans, and code is IBM Plex Mono. DevTools loads their woff2 files from `/assets/files/`, and the console shows no CSP error.
9. A page in English loads only the Latin files. Add a paragraph in Greek: the page loads the Greek file too.

Each screen, in Light and then in Dark:

10. These are readable: the view, the editor and the completion list that `<d` opens, the notice of a change on disk, the search that Ctrl+F opens and the matches of a selected word, diff mode with its panel, the new-file dialog, the dialog before losing edits, the status bar, the theme menu, and the sidebar overlay below 900 px.
11. The current file in the sidebar is readable, and a hovered row looks different from it. The text of an accent button is readable, and the secondary button of a dialog has a border. In the editor, the gutter shows the active line.
12. The five alerts, the table and the colours of the code block are readable. A warning alert has the warning colour, and a caution alert has the danger colour.

Start:

13. In a folder, run `mdame` with no path: it opens that folder.
14. Put `theme = "dark"` in `~/.config/mdame/config.toml`: mdame stops at start, with a message that names the file and the key. Do the same with `history = "state"`.
15. With no `~/.config/mdame/config.toml`, start and stop mdame: it writes none.
16. `mdame --no-open` prints the URL, opens no browser, and logs no "no display" line.

Motion:

17. With reduced motion on in the system, and the window below 900 px, the sidebar overlay opens and closes with no slide.

## Milestone 9: agent workflow

Decided on 3 November 2026, before the milestone started. `docs/SPEC.md` holds the design: Feature scope, the routes, and the design decisions of the front end.

- Markdown in hidden folders shows in the tree and opens in the editor, except under `.git` and `.mdame`. Every other type in hidden folders stays out. This replaces the view-only agent folders of 29 October.
- The handoff goes to Later, with its two designs: a lock file, or a check of the ports. The list of changes in the status bar replaces it: when an agent writes a file, the file is one click away.
- What changed: change bars, as in a git gutter, against the version that you last saw in the tab. Diff mode gets a "Last seen" entry, with Restore.
- Full-text search: a panel, opened with `s`, with the files on the left and the matching lines on the right. It matches like `rg -S`, not like a fuzzy finder: a fuzzy match on prose matches nearly every line.
- The content width: Default, Wide and Full, in the palette menu, which becomes View options.
- New: an outline of the headings, and spellcheck in the editor, each with a toggle in View options.
- Two private mockups helped to decide the layout: [content width](https://claude.ai/artifact/TtEVW1C8Pivas7aywDy8PW) and [outline](https://claude.ai/artifact/TLm7r823mEPjwZBJ1JmYcv).
- The shortcut help gets a footer line with the version and links. It replaces the About dialog of milestone 11.
- Dropped: the agent snippet and skill, the font size presets and clickable task lists. File operations, the right-click menu and tabs, which waited after v1, are dropped too. Copy as quote goes to Later as a maybe, and wide blocks go to Later.
- Milestone 10 gains the memory measurement against VS Code, the watcher that skips gitignored folders, the open points of milestone 8, and a README that leads with VS Code.

Rules, as test names, by commit. Each commit also updates the README and the spec where they describe what it changes. Done when: Claude Code, with `plansDirectory` set to `.claude/plans`, writes a plan. The plan shows in the tree and in the list of changes, and one click opens it. When the agent rewrites it, the changed blocks get bars and the outline gets dots. In diff mode, "Last seen" shows what changed and restores it.

1. Markdown in hidden folders, in the tree (done): the walker reads hidden entries, and never enters `.git` or `.mdame`. A path with a hidden part shows only if it is markdown. `.gitignore` applies as before. The watcher already sends events for these files. `markdown_in_a_hidden_folder_is_listed`, `a_hidden_markdown_file_is_listed`, `other_types_in_a_hidden_folder_stay_out`, `git_and_mdame_are_never_listed` (it replaces `hidden_and_mdame_entries_are_left_out`), `gitignore_applies_in_hidden_folders`.
   - A `.git` or `.mdame` folder stays out at any depth, so the `.git` of a nested repository does too. `is_git_or_mdame` in `workspace.rs` holds the rule, for the editor of commit 2.
2. Markdown in hidden folders, in the editor (done): `editable_name` accepts markdown with a hidden part, except under `.git` and `.mdame`. The real path of the open file passes the same rule. Create and the revisions follow. `hidden_markdown_is_offered_to_the_editor` (it replaces `hidden_files_are_not_offered_to_the_editor`), `create_makes_markdown_in_a_hidden_folder`, `a_hidden_file_keeps_its_revisions`. The refusal tests of source, save and create keep `.git/x.md`, `.mdame/…` and `.claude/settings.json`. Their link case `.a.md -> a.md` is now allowed, so it becomes a name under `.git/`.
   - Each refusal has its own message: "mdame does not edit files in .git or .mdame", or "a hidden file, or a file in a hidden folder, must be markdown". `create_refuses_a_type_that_the_editor_cannot_open` checks both.
3. The source in `/api/file` (done): `source` holds the text that was rendered, and is `null` for an image and over 1 MB. `file_returns_the_source_that_it_rendered`, `an_image_and_a_large_file_have_no_source`.
   - A file that is not UTF-8 gets the lossy text that was rendered, with U+FFFD, so the bars compare the text on screen.
4. Change bars (done): a pure module finds the marks from the version last seen, the current source and the blocks' `data-sourcepos`. The page keeps the version last seen of each file in memory. `an added paragraph is marked added`, `a changed list item marks the item, not the list`, `removed text marks the place where it was`, `an undone change loses its bar`, `a file shown for the first time has no bars`, `leaving a file makes the version on screen the one last seen`.
   - `changes.ts` is the pure module, with `a renamed file keeps the version last seen` too. `bars.ts` draws the bars in a layer of the article, and a `ResizeObserver` on the article moves them when the text wraps again or an image loads. The layer leaves the article before each morph, so that idiomorph does not reuse it as a block.
   - The line diff gives each distinct line one character, so that `diff` compares whole lines. Its timeout is 100 ms: an exact diff of 10,000 scattered changes took 15 s.
   - A drawn Mermaid diagram keeps the `data-sourcepos` of its code block, so it can get a bar. The editor's scroll sync now uses it as an anchor too.
   - Checked in Chrome on 4 November 2026, light and dark, on a sample plan in `.claude/plans/`: a changed paragraph, an added table row, a changed nested item, an added paragraph, a changed Mermaid diagram, and a removed section. All bars sit in one column. On the next change, only the new bar glows, and an undone change loses its bar. A narrower column moves the bars with the text.
5. "Last seen" in diff mode (done): the first entry of the revision list when the file differs from the version last seen. Its Restore saves that text through `PUT /api/file` with `If-Match`. `last seen comes first when the file changed`, `no last seen entry when the file is unchanged`, `restoring last seen saves its text`.
   - The editor gives the revisions panel two callbacks: the text on disk as the editor holds it, and the version last seen, from `view.ts`. The entry has no time, and no request loads it. `restoreRequest` picks `PUT /api/file` for "Last seen" and `POST /api/history/restore` for a revision.
   - Checked in Chrome on 5 November 2026: after an agent's rewrite, `h` opens diff mode on "Last seen", with the rewrite as a diff. "Restore Last seen" writes the first version back, the agent's text becomes the one revision, and the view shows no bars.
   - The rebuild renamed most chunks of `web/dist`, as earlier editor commits did. The content of some shared chunks changed, not only the hashed names that they import; the cause is in bun's bundler, and was not looked into further.
6. The list of changes (done): a pure module keeps the list, and the status bar shows it, with a menu when it holds several files. `a created or changed markdown file is listed`, `other types are not listed`, `the file on screen is not listed`, `a second change moves the file to the top`, `opening a file removes it`, `a rename keeps the entry under the new name`, `a removed file leaves the list`, `resync adds nothing`, `clear empties the list`.
   - `changelist.ts` holds the `ChangeList` class and the status bar's item, with `a file saved by renaming a new file over it is listed` too: the watcher reports such a save as a rename.
   - The item stays in the page while its menu is open, so a new change updates the open menu and does not close it.
   - Open point for milestone 10: the watcher reports gitignored files too, so the list can show a markdown file that the tree hides. The watcher that skips gitignored folders fixes most of it.
7. `GET /api/search` (done), in a new `search.rs`, with a row in the routes matrix. `a_phrase_matches_in_any_case`, `an_uppercase_letter_makes_the_case_count`, `search_reads_what_the_tree_shows` (gitignored files out, hidden markdown in, `.git` out), `images_and_files_over_1_mb_are_skipped`, `a_file_that_is_not_utf8_is_skipped`, `newest_files_come_first`, `results_stop_at_50_files_and_20_matches_per_file`, `context_lines_are_merged_where_they_overlap`, `an_empty_query_is_400`.
   - The search walks the tree with `tree::build`, so it reads what the tree shows. `document::text` reads each file, with the 1 MB limit and the UTF-8 check. The tests of the matching are unit tests in `search.rs`; `tests/search.rs` checks the route's answer and the 400.
   - `rg -S`: an uppercase letter anywhere in the phrase makes the case count. Without one, both sides go through `to_lowercase`, line by line.
   - After the 20th match, the file's scan stops, and its 2 lines of context still print, as `rg -m20 -C2` does. `more` is true only when a 51st file matches.
8. The search panel (done): `s` and a button beside the filter open it. A new keystroke aborts the request in flight. `the match is highlighted whatever its case` (bold in the plan; changed on 5 November 2026), `the preview breaks where the line numbers jump`, `a line maps to the block that holds it`.
   - `search.ts` holds the panel and its pure functions. The highlight uses a regex with the `i` flag only when the phrase has no uppercase letter, as the server does. The request goes through `request()` with an `AbortController`.
   - A line opens as `#L<line>`: `scrollToHash` in `view.ts` already runs on each show, after the diagrams and on a move inside the file, so the line needed no other hook. A line in no block, such as a blank line, scrolls to the block that ends nearest above it.
   - `blocksOf` in `bars.ts` gives the blocks of an article to the bars and to `#L<line>`.
   - Checked in Chrome on 5 November 2026: `s` opens the panel; `retry` lists two files with their counts and marks "Retry" and "RETRY"; ↓ chooses the next file, whose lines break with a dashed line where the numbers jump; a click on line 27 opens `plan.md#L27` with its code block in the middle of the pane.
9. The content width (done): the palette menu gains a Width section, and its tooltip says "View options". `a stored width wins`, `default sets no width`, `an unknown stored width falls back to default`.
   - `width.ts` holds the choice. Full sets `--content-width: none`, so the article's `max-width` goes and its 32 px padding stays. The menu gains a "Theme" and a "Width" label, as in the mockup, and its button is named "View options". The README's themes section says so.
10. The outline (done): a pure module lists the headings and places the outline. `only h2 and h3 are listed`, `fewer than 3 headings give no outline`, `a section with a change bar gets a dot`, `the outline fits beside a centred column`, `without room the column moves left`, `with full the column narrows`, `when moving is not enough the outline hides`. Its toggle in View options.
   - `outline.ts` holds the outline, with `entries` and `place` as its pure functions. `drawBars` now returns its marks and blocks, for the dots. The view shows the outline at once, then again with the dots once the bars are drawn.
   - `scrollToHash` calls `scrolledTo` with the heading that it scrolled to. The outline keeps that heading highlighted while the pane's `scrollTop` stays the same. Kamal found the case: in a tall window, a click on "Backoff" in the sample plan scrolled to the end of the file, and "Open questions" got the highlight.
   - The outline sits in a wrapper of no height, sticky at the top of the pane, before the article. The mouse wheel over the outline therefore scrolls the pane, and a morph of the article leaves the outline alone.
   - Two variables on the pane, `--outline-left` and `--outline-right`, set the column's margins. A rule applies them only to an article that follows the wrapper, so a page without an outline never gets them.
   - A `ResizeObserver` on the pane and on the article places the outline again: the pane changes with the window and the sidebar, the article with the width choice and the fonts. It places it in the next frame, as a move of the column inside the callback would resize the article again.
   - Checked in Chrome on 5 November 2026, light and dark, on a sample plan, with a pane of 1017 px. Default moves the column 18 px left, Wide 108 px, and Full narrows it to 793 px. With no sidebar, the column stays centred. With a sidebar of 480 px, the outline hides. With Full, it shows in a pane of 797 px and hides in one of 677 px. A click on "Backoff" opens `#backoff` and highlights it; the end of the file highlights the last heading. After a rewrite, the 3 changed sections get dots, and the column stays in place. The toggle, the editor and a not-found page leave no outline and no moved column behind. The console stays empty. On 6 November, in a pane 1200 px tall, a click on "Backoff" scrolls to the end of the file, and "Backoff" stays highlighted until the pane scrolls.
11. Spellcheck (done): the editor's `spellcheck` attribute sits in a CodeMirror compartment, so its toggle in View options applies with no reload. `spellcheck follows the stored choice`.
   - `spellcheck.ts` holds the choice, the compartment and the extension that the editor adds. A view plugin in the extension keeps the set of open editors, so the menu reaches them without importing `editor.ts`. That import would make a cycle: `editor.ts` imports `view.ts`, which reaches `theme.ts` through `diagrams.ts`.
   - Checked in Chrome on 6 November 2026, through the `spellcheck` attribute of the editor's text: it is on by default. The menu item turns it off and on at once, in the editor and in diff mode, and a reload keeps the choice. The console stays empty.
12. Shortcut help (done): one list of the keys, and `?` opens the dialog, with the footer line. `every key of bindKeys and of the editor keymap is in the help` (`every key that the page binds is in the help` in the plan), `macos shows ⌘ and the others ctrl`.
   - `shortcuts.ts` holds the list, `keyLabel` and the dialog. `keys.ts` exports `PAGE_KEYS`, the type of the map of `bindKeys`, so a key that `main.ts` binds and the list misses fails the test. The editor's keymap moved to `format.ts` as `formatKeys`, so the test reads it too. The test name changed: the keys of the filter, of the search panel, Esc and Cmd/Ctrl+S have their own listeners, and no test reads them.
   - A keyboard button in the status bar, before View options, opens the help too: its tooltip teaches `?`, and the footer's version and links need no key.
   - `bindKeys` now ignores the keys while a dialog is open. Without it, `e` in the help opened the editor behind the dialog.
   - `web/dist/THIRD-PARTY-LICENSES.txt` moved to `web/dist/assets/`, so that the footer's "Licences" link opens the copy that mdame serves. The server now sends `.txt` as `text/plain`, so the browser shows the file instead of downloading it: `the_licences_show_as_text` in `tests/assets.rs`.
   - Checked in Chrome on 6 November 2026: `?` opens the help, with the focus on Close, and the actions of the three groups line up. A second `?` opens no second dialog, and `e` does not open the editor behind it. Closing the dialog removes it. The footer reads "mdame 0.0.1 · Repository · Licences". The console stays empty.
13. Review loop (done), `cargo mutants` (done), manual checklist (done).
   - For the "done when" check: this repository's `.git/info/exclude` lists `/.claude/`, and ignore rules apply in hidden folders too, so its `.claude/plans` stays out of the tree. Run the check in another workspace.
   - Review loop, done on 6 November 2026: a simplify pass, then 11 rounds of a code reviewer and a security reviewer, until a round found no blocker and no should-fix. Decided on the way:
     - The search panel searches 150 ms after typing stops. The server cannot stop a search, so one search per keystroke would pile up.
     - `/api/search` gives each file a `more` flag, so a file with exactly 20 matches no longer shows `20+`.
     - `.git` and `.mdame` are refused in any letter case, since some file systems ignore case.
     - Leaving a file from its editor counts as leaving it with the text that the editor held. Esc back to the view of the same file does not leave it.
     - Markdown in `.github/workflows/` is editable, so an agentic workflow there joins `CLAUDE.md` and the skills in the accepted risks of `docs/SPEC.md`. The other choice: refuse edits under `.github/workflows/`.
     - Text replaced by blank lines gets a "removed" mark. Blank lines between the items of a loose list, or a lone `>` in a quote, mark no container. Text changed in no block, such as front matter, gets no mark.
   - `cargo mutants` on the diff of the milestone, 6 November 2026: 50 mutants, 40 caught, 10 unviable, none missed.

- After the manual checklist, on 7 November 2026: a long name in the list of changes ends in "…", and its `+N` count stays visible. A long menu of the status bar no longer goes 6 px past the top of the window: its `max-height` now holds its padding and border. In the help, the group of the letter keys is named "Outside the editor", not "Anywhere": in the editor, these keys type text. Esc has a row in both groups.

### Manual checklist

Run on 7 November 2026: all 18 checks passed. Claude ran them in Chrome through agent-browser, except checks 1 and 15. Kamal ran them all in Firefox. Checks 8 and 9 failed at first; after the fixes above, they passed in both browsers. Check 15 used ibus with Anthy, in Firefox and in Chromium. These checks cover what no unit test covers: the bars, menus and panels on screen, and the agent workflow from end to end. Run mdame on a test folder with `cargo run -- -p 4996 <folder>`, in Chrome and Firefox, and reload each open tab after a rebuild. The folder holds:

- `plan.md`, with front matter, 4 h2 headings, a loose list, a quote and a Mermaid diagram;
- `.claude/plans/a.md`, `.claude/settings.json` and `.git/notes.md`;
- `crlf.md`, with CRLF line breaks;
- `twenty.md` and `more.md`, with 20 and 21 lines that hold "retry".

Agent workflow:

1. In another workspace, set `plansDirectory` to `.claude/plans` in the settings of Claude Code, and ask it for a plan. The plan shows in the tree and in the list of changes, and one click opens it. Ask for a change: the changed blocks get bars, and the outline gets dots. `h` opens diff mode on "Last seen", which shows the change. Its Restore brings back the plan that you saw.

Hidden folders:

2. The tree shows `.claude/plans/a.md`, but not `.claude/settings.json` and not `.git`. `e` opens `a.md` in the editor, and Save writes it.

Change bars and "Last seen":

3. Change `plan.md` on disk while it is on screen: the changed blocks get bars at their left, in one column, and only the new bar glows. Make the window narrower: the bars follow their blocks.
4. In `plan.md`, add an item to the loose list: only the new item gets a bar. Change the front matter: no bar. Replace the paragraph under "Goal" by a blank line: a red mark shows where it was.
5. Open `plan.md`, go to `/` with Back, change `plan.md` on disk, then open it again: the bars show only that change. Do the same through the editor of `a.md`.
6. Open `plan.md` and press `e`. Change the file on disk: the editor reloads it. Click `a.md`, then `plan.md`: no bar for the change that the editor showed. Do the same with `crlf.md`: no bar at all.
7. In the editor of `plan.md`, type a word, then change the file on disk: the notice shows. Click Reload, then Revisions: "Last seen" is the first entry.

List of changes:

8. Write three markdown files on disk: the status bar shows the newest name and `+2`. A click opens a menu above it, newest first, with Clear. Write 40 more: the menu scrolls, and its top stays in the window.
9. Write `2026-11-06-implementation-plan-for-the-search.md`: its name ends in "…" inside its button.
10. Open the menu and move the focus to an item with Tab. Write a `.json` file, then the newest markdown file again: the menu stays as it is, with the focus on the same item.
11. With `plan.md` on screen, run `mv plan.md plan2.md` in a terminal: the view follows, and the list does not show `plan2.md`.

Search:

12. `s` opens the panel. Type `retry` fast: DevTools shows one request, about 150 ms after the last key. `twenty.md` shows 20, and `more.md` shows `20+`.
13. One Esc closes the panel, in Chrome too.
14. Click a file in the list, then press ↓ and Enter: the next file is chosen, and Enter opens it at its first match.
15. With an input method, such as Japanese, type in the field: Enter converts the text and opens no file, and Esc cancels the composition and keeps the panel open.

View options:

16. With the outline on and a pane of about 900 px, choose Full: the outline shows, and the column narrows. Choose Wide: with no resize, the column is centred again, and the outline hides if it does not fit.
17. Each choice of Theme, Width and Show applies at once, and stays after a reload. Spellcheck underlines a misspelt word in the editor, and its toggle turns it off.

Help:

18. `?` opens the help. Its footer's Licences link shows the licences as text in the browser.

## Milestone 10: release

Decided on 7 November 2026, before the milestone started. `docs/SPEC.md` holds the scope: milestone 10 in the build order, and Distribution.

- No npm wrapper. The install script, Homebrew and `cargo install` cover Linux and macOS, and npm would need its own account and token.
- The Linux binaries are static, built with musl, for x86_64 and aarch64. One file runs on any distribution, since mdame has no C dependency. macOS gets x86_64 and aarch64 binaries.
- The watcher skips gitignored folders. On Linux, inotify costs one watch per folder, so mdame watches only the folders that the tree shows. On macOS, FSEvents watches the whole root at one cost, so mdame drops the events under ignored folders.
- No Mac is at hand. After the release, a CI job on a macOS runner installs mdame with the script and with Homebrew, starts it, and requests `/api/state`. Editing on macOS gets no check in a browser.
- Decided on 7 November 2026, after the first CI runs on macOS: live updates on macOS are a known issue of 0.1.0, listed in the README. The watcher tests run on Linux only.
- Decided on 8 November 2026, in the review: no install script. In `~/.local/bin`, the script of dist 0.33.1 (and 0.34.0) "migrates" any `~/.local/bin/env` written from dist's template, as uv's installer writes it: it points the user's shell profiles to `~/.config/mdame/env.sh` and deletes uv's file, even with `MDAME_NO_MODIFY_PATH=1`. Homebrew, mise, Cargo and the release archives remain.
- Decided on 8 November 2026, after tests on a Mac: live updates on macOS stay a known issue of 0.1.0. Their fix, the disk check under Open points, comes after 0.1.0.

Rules, as test names, by commit. Each commit also updates the README and the spec where they describe what it changes. Done when: `brew install` gives a working mdame on Linux and macOS. Until the review, the install script was part of the check.

1. Editing on macOS (done). `fd_path` asks the kernel with `F_GETPATH`, through `rustix::fs::getpath`, where Linux reads `/proc/self/fd`. macOS adds no " (deleted)" to the name of a deleted file, so a link count of 0 marks it on both systems. `fd_path_names_the_open_file`, `a_deleted_file_is_reported_deleted`.
   - `is_at` counts a deleted file as gone. During a rename over a file, the file loses its last link a moment before the path leads to the new file. In that moment, `a_file_renamed_over_after_the_open_is_opened_again` failed in 2 runs of 3.
   - `rustix` becomes a direct dependency on macOS only. It is in the lock file already, through cap-std. Kamal approved it on 7 November 2026; this commit adds its line in Libraries.
   - Without a Mac, `cargo clippy --target aarch64-apple-darwin` checks that the macOS code compiles.
2. CI on macOS (done). A second job on a macOS runner runs the same steps. The actions are pinned by commit SHA, and the checkout sets `persist-credentials: false`.
   - The macOS runner may find failures that Linux hides: the temporary folder behind a symlink, or a file system that ignores case. Their fixes come in this commit or right after it.
   - One failing runner does not cancel the other: `fail-fast: false`.
   - cargo-mutants and nextest install on Linux only. They serve only mutation testing, and cargo-mutants has no build for ARM macOS.
   - The first run on macOS: `a_save_succeeds_when_pruning_fails` now runs on Linux only. Its history folder has write permission but no read permission. Without `O_PATH`, cap-std cannot open such a folder, so on macOS the snapshot fails too. `cargo test` now runs every test binary, even after one fails.
   - The second run on macOS: 14 of the 16 tests of `tests/watch.rs` and one test of `tests/ws.rs` fail. They now run on Linux only. The failures are under Open points.
3. The watcher skips gitignored folders (done). `a_change_in_a_gitignored_folder_sends_nothing`, `a_new_folder_is_watched`, `a_file_written_right_after_its_folder_is_created_is_seen`, `a_folder_that_a_gitignore_change_shows_is_watched`, `a_folder_that_a_gitignore_change_hides_sends_nothing`, and `a_renamed_folder_stays_watched`.
   - The watcher walks the workspace with the walker of the tree, `tree::walker`. It walks again after each batch with a creation, a removal or a rename, or with a write to a `.gitignore` or `.ignore` file.
   - On macOS, the event filter drops the events under ignored folders. Its tests run on Linux only, as the other watcher tests do. A unit test, `a_path_in_a_folder_that_the_tree_hides_is_skipped`, checks the filter on both systems.
   - A folder created or moved in sends `created` for its entries too: they may have been written before its watch. `populated_folder_moved_in_is_created` now expects the file in the folder.
   - inotify reports the move of a watched folder from the folder itself too, as a removal, a moment after the rename: maybe in the next batch. The watcher drops a removal of a path renamed less than a second ago. The first version looked only in the same batch: `renames_are_paired` failed in the CI run of the rehearsal's tag.
   - notify-debouncer-full 0.7 takes quadratic time to watch folders one by one: 12 s for 15,000 folders, where notify alone takes 0.46 s. Decided on 7 November 2026: the first walk runs on the watcher's thread, so mdame opens at once, and live updates start later on a large workspace. Tests wait for it with `Watcher::wait_started`. The release candidate 0.8.0-rc.2 fixes it, but needs notify 9.0.0-rc.7.
   - `watch.rs` stays one module: 555 lines, of which 230 are tests. The code that watched around an unreadable folder is gone, since each folder now has its own watch.
   - It closes most of the open point of milestone 9: the list of changes no longer shows the files of gitignored folders.
4. Release binaries with dist (done). `dist init` writes the release workflow and its config: the four targets above, a shell installer and a Homebrew formula. `dist plan` lists the archives, the installer and the formula.
   - The formula goes to a tap repository, `KamalF/homebrew-tap`. Before this commit, Kamal and Claude set up the tap and a token that the release workflow can use. The token, the secret `HOMEBREW_TAP_TOKEN`, can write the contents of the tap only, and has no expiration.
   - dist 0.33.1, from `mise.toml`: 0.34.0 was 5 days old. Its config is in `dist-workspace.toml`. `dist init` kept its default targets beside the four, so the targets were set by hand.
   - Each target builds on a native GitHub runner: `ubuntu-22.04`, `ubuntu-22.04-arm`, `macos-14` and `macos-15-intel`. No crate of mdame compiles C, so musl needs only `musl-tools`.
   - The install script puts mdame in `~/.local/bin`, not in dist's default `~/.cargo/bin`: most users of the script have no Rust.
   - The actions of the release workflow are pinned by commit, through `github-action-commits`. dist writes the checkouts with `persist-credentials: false`, except the one that pushes the formula to the tap.
   - `Cargo.toml` gains `homepage`, for the formula, and the `dist` profile: the release profile with thin LTO.
5. A job after each release, on Linux and on a macOS runner: it installs mdame with the script and with Homebrew, starts it with `--no-open`, and requests `/api/state` with the token. On macOS, this job is the "done when" check. (done)
   - `.github/workflows/check-release.yml`, which dist calls after the release is announced, through `post-announce-jobs`. It takes the tag and the prerelease flag from dist's plan.
   - `.github/check-release.sh` starts the mdame that it is given on an empty folder, with its own config and state folders, and reads the token from the state folder. It passes on a local build; it runs on any binary.
   - dist publishes no formula for a prerelease, so the Homebrew part runs only for a release.
   - Rehearsal, before commit 6: the version `0.1.0-rc.1`, then its tag, which Kamal pushes. The prerelease checks the release workflow.
   - `v0.1.0-rc.1`, 7 November 2026: the Linux and Intel macOS builds passed, but GitHub has retired the `macos-14` image that dist 0.33.1 picks for Apple Silicon, so nothing was published. That build now runs on `macos-15`, through `github-custom-runners`. The CI run of the tag found the flaky echo of a folder's move, above. Then `v0.1.0-rc.2`.
   - `v0.1.0-rc.2`, 7 November 2026: the four builds passed, and the prerelease is on GitHub. The check job was skipped. GitHub skips a job when a job that it needs, even through another, was skipped, unless its condition says `always()`. The check job needs `announce`, which needs the Homebrew job, skipped for a prerelease, and dist writes the check job with no condition. On a release, the Homebrew job runs, and so does the check job.
   - Checked by hand on Linux x86_64 instead: the install script of `v0.1.0-rc.2`, with `MDAME_INSTALL_DIR` in a temporary folder, then `.github/check-release.sh` on it. It passes. The binary is static, 18 MB with its symbols.
   - Checked by hand on an Intel Mac with macOS 15.7.9, through ssh, on 8 November 2026. The `x86_64-apple-darwin` archive of `v0.1.0-rc.2`, downloaded with curl, matches its SHA-256 and passes `.github/check-release.sh`. On the same Mac, `cargo test` passes at `a714c48`: 204 tests, and 2 ignored, as on the macOS runner of CI.
6. The open points of milestone 8 (done): `web/themes/README.md` says to use only themes that you trust, and `LICENSE` carries the notice of `@primer/primitives`.
   - The notice is the one of `@primer/primitives` 11.10.0, the version that the themes copy: "Copyright (c) 2018 GitHub Inc." and the MIT text. `LICENSE` goes into the crate and into each release archive.
7. Memory, measured by hand: mdame and its tab against VS Code, with the same folder and the same markdown file open, idle and on a large repository. The large repository is `mdn/content`, the MDN documentation in markdown. The numbers go to the README. (done)
   - Measured by Kamal on 7 November 2026, with `~/dev/claude/runbooks/2026-11-07-mdame-memory.md`. Small: this repository and `README.md`, after one minute. Large: `mdn/content` (14,751 folders) and the page of `Array`, after two minutes.
   - mdame: the server and the process of its tab in Chromium. 64 MB (8 and 55) small, 144 MB (22 and 122) large. Chromium's own "memory footprint" of the large tab, 109 MB, agrees.
   - VS Code 1.145.2, from Microsoft's tarball, with its own data folder, no extension, and the preview of the file beside the text: every process. 1,003 MB small, 1,138 MB large.
   - `scripts/memory.sh` sums the PSS of each process given and its children. It needs sudo: Chromium and VS Code hide the memory of their sandboxed processes from the account that runs them. The shared processes of the browser do not count for mdame, since the browser is open anyway.
   - The mdame is the musl binary of `v0.1.0-rc.2`, as the install script gives it.
8. The README leads with the reason for mdame: a markdown viewer and editor in the browser, beside the terminal, lighter than VS Code. Its comparison starts with VS Code, with the numbers of step 7. Its demo of the agent loop sets `plansDirectory`. Its install section gives the script, Homebrew and `cargo install mdame`. (done)
   - The opening: what mdame does, for whom, and the memory against VS Code in one line. Two lines in Kamal's voice say why mdame exists: he tried mdlive for a short time, then built his own as a learning project, to practise software engineering with a coding agent. Then the demo, then the status, with no Windows build. Then the install, by script, Homebrew, mise (its `github:` backend, checked on `v0.1.0-rc.2`) and Cargo, then "With a coding agent", then the usage.
   - The install script: a warning to read it first. dist builds it for each release, so it has no file in the repository. What it does, read in the `v0.1.0-rc.2` installer: it checks the SHA-256 of the archive, writes `~/.config/mdame/env.sh`, and adds a line that runs it to the shell profiles and to fish's `conf.d`, unless `MDAME_NO_MODIFY_PATH=1`.
   - "With a coding agent": `plansDirectory` in `.claude/settings.json`, then the loop: the list of changes, `e` to edit the plan, the change bars, and "Last seen" in diff mode.
   - "Compared with VS Code": the ratios, 16 times and 8 times, then the table of step 7.
   - "Similar projects": one line each for mdserve, mdlive, grip, glow, Obsidian (not open source) and SilverBullet (Kamal's view: great, comprehensive for those who like to tinker; mdame aims to be simpler), on how mdame differs, with facts checked on 7 November 2026: mdserve is archived and lists only the top level of a folder; mdlive v2.3.13 is still the latest, and reloads the whole page on each change. Then what mdame does not do, from the principles of the spec.
   - "Design, tests and reviews": Kamal decided, Claude Code wrote most of the code. Then three short h3 parts, from the spec and this file: the design (the principles of the spec), the tests (the testing rules, `cargo mutants`, CI and the release check) and the reviews (each commit explained back, the review loop of 2 to 29 rounds per milestone, the manual checklist).
   - `docs/demo.gif`, under the opening, 12.6 s, 1.3 MB: the plan of a demo project, `tidy`, in `.claude/plans/`. The agent rewrites a step and adds a test, the change bars appear, `design.md` joins the list of changes, and `h` opens diff mode. Recorded with agent-browser at 1024×800 on an mdame that Kamal started, then cut with ffmpeg.
   - Why these choices: on 7 November 2026, a study of Show HN comments that praise a README, and of those READMEs. They show the tool working near the top, name the alternatives and how they differ, state their limits, and sound like a person wrote them.
9. Review loop, `cargo mutants`, manual checklist.
   - Review loop, done on 8 November 2026: a simplify pass, then 9 rounds of a code reviewer, a security reviewer and a prose reviewer of the README, until a round found no blocker and no should-fix. Decided on the way:
     - The watches are added in sorted order, so the root comes first. The debouncer looks for the watch of each event in the order of the watches. In a random order, with 15,000 folders, the 30,000 events of one tree walk overflowed the inotify queue, and each overflow made the tabs walk the tree again, without end. Measured with a scratch program on the library.
     - A walk runs only for an event that touches a shown folder, a new folder or an ignore file, in a shown folder. A file's creation, removal or rename runs no walk: with a new file every 0.3 s on 15,000 folders, each walk delayed the next events, and a write arrived 3.6 s late. It now arrives after 0.24 s. `only_folders_and_ignore_files_change_the_shown_folders`.
     - One walk serves every batch that waits in the channel. The batches are merged, so the events no longer skip a copy of any earlier event, only a copy of the latest event of the same path: remove, create, then remove of one file lost the last removal. `a_removal_after_a_creation_after_a_removal_is_sent`.
     - After a rescan, events were lost, and with them the removals that dropped watches: every folder is watched again, and the folders that the walk no longer shows are unwatched. It costs the quadratic watching of notify-debouncer-full 0.7, 18 s on 15,000 folders, once per overflow. A slow removal of 5,000 of these folders gave three overflows in a row, about 40 s in all; it ends.
     - notify drops the watch of a folder that is removed or moved away, and the watches below it. The watcher now watches such a folder again if its path comes back, as after a `git checkout`. `a_folder_created_again_stays_watched`, `a_folder_swapped_through_moves_stays_watched`.
     - After a walk that added watches, the watcher walks once more: a file or a folder made between the walk and its watch was lost. A scratch program on 15,000 folders missed 5 of 6 such files before, and none after. No test: it needs that timing. No third walk: with a new folder every 50 ms, an open loop held the events back for seconds.
     - A folder deleted between the walk and its watch is watched if it comes back. notify can also report it as `Io(NotFound)`, when it goes between the watch and notify's check of it. An unreadable folder stays skipped, so its warning shows once.
     - After the first walk, the watcher walks again too, and then sends `resync`, before `wait_started` returns: a tab may have connected during the walk. It costs about 0.5 s at the start on 15,000 folders. `a_tab_connected_during_the_first_walk_gets_a_resync`.
     - The debouncer keeps no cache of file ids on macOS either. That cache pairs renames, but it walks the root at the start and at each rescan, through symlinks: in a folder with a link to `/`, mdame walked the whole disk before it opened. On Linux, notify-debouncer-full already used no cache.
     - A renamed folder is watched again only after the walk that follows its batch: what is written into it before sends nothing. `main` watched it again at once, through notify's recursive watch. Stated in the spec; no cheap fix.
     - Only the shown folders that a batch removes or renames lose their watch, and their removed ancestors are looked up in a set, so a batch of removals costs little time.
     - The watcher asks notify to unwatch only the folders that still exist, such as one that a `.gitignore` change hid. Each call waits for notify's thread, which is busy with the events of the removal: removing 5,000 of 15,000 folders delayed the first event by 6.3 s. It now comes after 0.9 s.
     - A new folder sends `created` for its entries even when an earlier walk watched it before its own event came: `mkdir a`, then `mkdir b` 60 to 250 ms later, lost the files of `b`. A folder that a `.gitignore` change shows now sends them too, so the tab reloads its tree. A renamed folder does not. `the_entries_of_a_new_folder_are_created_unless_it_was_renamed`.
     - The events of the folders that the tree hides do not count toward a burst: on macOS, a build in `node_modules/` or `target/` sent `resync`. `a_burst_in_a_folder_that_the_tree_hides_sends_nothing`.
     - Hiding many folders through a `.gitignore` change holds the events back: notify-debouncer-full drops each watch with a pass over all the watches, even in 0.8. On 15,000 folders, hiding 1,100 of them takes 6 s, and 12,800 take 29 s. Stated in the spec; no cheap fix.
     - The README says where revisions live, gives `cargo install --locked`, tells macOS users to use Homebrew or mise (the binaries are not notarized), tells how to show a gitignored `.claude/`, and lists the late start of live updates on a large folder: 12 to 18 s on 15,000 folders, as measured here on several runs, depending on the load of the machine. Its agent loop says to press Esc before the agent rewrites the plan.
     - `rustix` is now a dependency on every target: `fd_path` reads the link count with `fstat` on Linux too.
     - The echo of a folder's move is still found by its time: notify gives it no rename cookie, but the debouncer keeps only the last event of a kind for a path, and drops the parent's report when both share a batch.
     - No install script, as decided above.
   - `cargo mutants` on the diff of the milestone, 8 November 2026: 87 mutants, 67 caught, 6 unviable, 14 missed. New unit tests catch 8 of them: an access or a change of metadata on a folder runs no walk (without it, each walk would run another), the burst limit on the entries of a new folder, a change after a creation with another path between, a vanished and a denied folder in `watch_folders`, and a folder created again before a rescan. `path_of` becomes one function with a block for each system, so the macOS block, which Linux does not build, gives no mutant. Five mutants are excluded in `.cargo/mutants.toml`, each with its reason. The exclusions for `watch_readable` and `watch_around`, which this milestone removed, go. The run after: 81 mutants, 75 caught, 6 unviable, none missed.
10. Performance on a large repository. Decided on 8 November 2026, after a review: all ten fixes go into 0.1.0. A server reviewer and a page reviewer measured mdame on `mdn/content`, and Claude measured it in Chrome on Kamal's release build. On a small folder, mdame is snappy: first content in about 0.2 s, typing under 16 ms per key, every route under 15 ms. On `mdn/content`, it is not: typing in the filter froze the tab for up to 7 s per key, a click in the tree took 0.8 s with a big folder open, and `/api/tree` took 1 s. The README invites such a test, since its comparison uses `mdn/content`. One commit per fix:
    1. Icons are cloned from a parsed copy (done). Parsing the markup with `innerHTML` cost three times a clone. Opening the page of the input element blocks the tab 218 ms instead of 313 ms.
    2. The filter shows at most 100 results (done), then the number of the others. Each keystroke paints in 52 to 70 ms on `mdn/content`, where "i" froze the tab for 6.9 s. `filter shows at most 100 results, and counts the others`.
    3. The outline sets the article's own margins (done), not inherited custom properties on the pane, and skips writes that change nothing. A 195 KB changelog opens in 322 ms instead of 737 ms; a dense 1 MB file in 2.6 s instead of 3.8 s.
    4. Dragging the sidebar sets the sidebar's own width (done): 60 fps on the page of Array, against 17. The overlay of narrow windows keeps its 280 px with `!important`.
    5. A file opened from the tree or from a link, or a folder toggle, updates only the rows that change (done), and a tree refetch with the same answer renders nothing. With `web/api` open, a click on a file takes 134 ms instead of 665 ms, and a refetch 69 ms instead of 308 ms.
    6. The server walks the workspace with 4 threads (done), one walk at a time: four tabs that loaded the tree at once ran 16 threads and overflowed the inotify queue. `/api/tree` takes 176 ms instead of 1,009 ms, a search for a rare word 371 ms instead of 1,212 ms, and a new folder's events come after 0.75 s instead of 2.2 s. The watcher needs a folder before its entries. The walk keeps that order: it visits a folder before its entries, since the visit can skip them.
    7. The morph skips the unchanged blocks at the start and the end of the article (done), and gives them their new line numbers. A changelog update blocks the tab 377 ms instead of 595 ms, and a dense 1 MB file 1.6 s instead of 6.4 s. After an update, the article holds the same nodes and line numbers as a fresh open. A `<details>` that the reader opened stays open if no block changes above it, or none below it.
    8. Mermaid diagrams are cached by theme and source (done), the last 50. A live update of a file with 6 diagrams has no long task, against 320 to 406 ms.
    9. Code over 100 KB shows as plain text (done). A 943 KB JSON file opens with 370 ms of long tasks instead of 3.4 s. `a text over 100 KB stays plain text`.
    10. The editor loads on the first edit (done). The first page load takes 439 KB of JavaScript instead of 758 KB.
    11. The rows of the tree out of view skip their layout (done), with `content-visibility`. The manual checklist found it: a drag of the sidebar lays out each row again. With `web/api` open, 1,614 rows, the drag runs at 22 fps instead of 7, and at 36 fps instead of 23 with 347 rows. A virtual tree, which builds only the rows in view, would reach 60 fps; it waits until after 0.1.0.
    - `cargo mutants` on the Rust part of these commits, `tree.rs` and `watch.rs`: 7 mutants, 5 caught, 2 unviable, none missed. cargo mutants cannot remove the order of the walk, so a test checks it: `the_walk_gives_a_folder_before_its_entries` fails on a walk in reverse. The page's changes have no unit test where they touch the DOM; the harness measures checked them.
    - The measures came from the page reviewer's harness: the real page, bundled with a fake server that answers with responses recorded from `mdn/content`, in headless Chrome, before and after each fix. The server's came from its reviewer's bench crate, on a copy of `mdn/content`.
11. Release 0.1.0: the version in `Cargo.toml`, then a tag that starts the release workflow. Kamal runs `cargo publish`. Then the "done when" check, and the Show HN.
    - Done on 8 November 2026: mdame 0.1.0 is on GitHub, in the tap and on crates.io. The job "Check release" passes on its Linux and macOS runners.
    - The first push of the formula failed with a 403. The token `HOMEBREW_TAP_TOKEN` could write to `KamalF/mdame`, not to `KamalF/homebrew-tap`. Kamal moved it to the tap, and the failed jobs ran again.
    - `~/.cargo/credentials.toml` has held no token since the publish of 0.0.1. `cargo publish` took a new token with the `publish-update` scope from the clipboard.

### Manual checklist

Run on 8 November 2026: checks 1 to 21 pass. Kamal ran checks 1 to 7, and the narrow window of check 11, in Chrome and Firefox. Claude ran checks 8 to 18 in the headless Chrome of agent-browser, at 1280×633, on the release build; the measures are below the checks. After the release, Kamal ran checks 19 to 21. Check 19 passed on port 4991, since another mdame held port 4891: see the candidates for milestone 11. These checks cover what no test covers: the watcher in the browser, on a real repository and a large one, and the release as a user installs it. Run mdame with `cargo run --release -- -p 4996 <folder>`, in Chrome and Firefox, and reload each open tab after a rebuild. A change on disk comes from a terminal or another editor, not from mdame's editor. The test folder is a git repository that holds:

- `a.md` and `notes/b.md`;
- a `.gitignore` that lists `build/`, and `build/c.md`;
- a branch `other`, where `notes/` holds only `d.md`;
- in `perf/`, the files of the harness of step 10: a 195 KB changelog, a dense 1 MB file, a 943 KB JSON file, a file with 7 diagrams and a second copy of one, and `morph.md`, with text after an HTML block and a `<details>`.

Live updates:

1. Write `build/c.md`: no entry in the list of changes, and `build/` stays out of the tree.
2. Run `mkdir new && echo '# N' > new/n.md`: `new/n.md` shows in the tree and in the list of changes. Open it, then change it on disk: the page updates.
3. Run `git checkout other`, open `notes/d.md`, then change it on disk: the page updates. Undo that change with `git checkout -- notes/d.md`: otherwise git refuses to switch back. Run `git checkout -`, open `notes/b.md`, then change it on disk: the page updates.
4. Empty the `.gitignore`: `build/` shows in the tree, and `build/c.md` in the list of changes. Open `build/c.md` and change it on disk: the page updates.

Large workspace:

5. Run mdame on `mdn/content`: the page opens at once. In DevTools, after a minute, the Network tab shows no new request to `/api/tree`. Open the page of `Array`, `files/en-us/web/javascript/reference/global_objects/array/index.md`, wait 20 s, then change its file on disk: the page updates.
6. In `mdn/content`, run `git checkout HEAD~200`, then `git checkout -`: the tree reloads a few times, then stops. Change the file of `Array` on disk: the page updates.

Editor:

7. Open `a.md` in the editor and type a word. Save the file from vim with `:w`: the notice of a change on disk shows. Click Overwrite: the save works, and Revisions lists the version from vim. These steps run through `fd_path`, which now reads the link count with `fstat`.

Performance, in Chrome, with the Performance and Network panels of DevTools. Each check gives the time that the harness of step 10 measured after the fix, and before it in brackets. A time near the first passes. To measure an action, click Record in the Performance panel, do the action, then click Stop. The time is that of the long tasks on the Main track: the grey blocks with a red corner. For the keys of check 8, the Interactions track gives the time of each key.

On `mdn/content`:

8. Type `i` in the filter: the list shows 100 results, then "N more files match: type more letters." Each key paints in about 60 ms (6.9 s).
9. Open the page of `input`, `files/en-us/web/html/reference/elements/input/index.md`: the tab is blocked about 220 ms (310 ms).
10. Open the folder `files/en-us/web/api`, then click a file in it: about 130 ms (665 ms). Press `s`, search `XPathResult`, and open a result in another folder of `web/api`: that folder opens, in about the same time. mdn links its pages by absolute URLs, which mdame does not follow, but a search result opens a file the same way.
11. On the page of `Array`, drag the edge of the sidebar: about 60 fps with few folders open (17), and about 22 fps with `web/api` open (7). Below 900 px, the overlay of the sidebar is 280 px wide.
12. Reload: `/api/tree` takes about 180 ms (1 s), and the page loads about 440 KB of JavaScript (760 KB). `editor-*.js` loads only on the first `e`.

In the test folder:

13. Open `perf/changelog.md`: about 320 ms (740 ms). Append a line to the file: the update blocks the tab about 380 ms (600 ms). Choose Full width, and append a line again: the column keeps its place beside the outline.
14. Open `perf/dense.md`, and append a paragraph to the file: the update blocks the tab about 1.6 s (6.4 s).
15. Open `perf/big.json`: it shows as plain text, with about 370 ms of long tasks (3.4 s).
16. Open `perf/diagrams.md`, and change its last paragraph on disk: no long task over 100 ms (320 to 406 ms). Choose Dark, and open the file again: the diagrams are dark. Choose Light, and open it again: they are light. The diagrams on screen keep their theme until the next render. Under "Two copies", the second copy shows its arrow while the `<details>` above it is closed.
17. Open `perf/morph.md`, and open its `<details>`. Change "The last paragraph." on disk, then "Caption one": the page shows each change, and the `<details>` stays open.
18. With Disable cache on in the Network tab, reload the page and stop mdame. Press `e`: the page says "Reload the page once mdame is back: the editor did not load." Start mdame again: the editor opens.

Measured on 8 November 2026, with a load average of 2 to 7:

- 8: 100 results and the count of the others. After the first key, which took 120 ms, each key takes 66 ms of long task.
- 9: one long task of 156 ms.
- 10: opening `web/api` takes one long task of 121 ms. A click on a file in it, and a page in a closed folder of `web/api`, take no long task. Opening a result of the search panel takes 289 ms, in the panel: a follow-up.
- 11: 22 fps with `web/api` open, and 36 fps with 347 rows, after step 10.11. Before it, 7 and 23 fps.
- 12: 429 KB of JavaScript, without the editor. Over HTTP, `/api/tree` takes 0.32 s, and 1.18 s with the server from before step 10.6, on the same machine. The bench of step 10.6 gave 176 ms and 1,009 ms.
- 13: the changelog opens in 531 to 614 ms. An update takes 140 ms, and 170 ms in Full width, where the column stays in place.
- 14: an update takes 1.54 s. The first open takes 3.9 s.
- 15: plain text, in one long task of 557 ms.
- 16: an update takes no long task. The diagrams are dark after Dark and an open, and light after Light and an open. The second copy has its own ids, and its arrow shows.
- 17: both changes show, and the `<details>` stays open.
- 18: the message shows, and the editor opens after the restart.

Release, after 0.1.0 is published:

19. `brew install KamalF/tap/mdame` on Linux gives a working mdame. The job "Check release" passes on its Linux and macOS runners.
20. `mise use -g github:KamalF/mdame` and `cargo install --locked mdame` give a working mdame.
21. On GitHub, the README shows the demo, and the link "a known issue" leads to Known issues.

## Milestone 11: fixes for 0.1.1

Decided on 9 November 2026, before the milestone started. `docs/SPEC.md` holds the scope: milestone 11 in the build order.

- Milestone 11 takes the fixes that 0.1.0 needs, from the release and from the open points, and releases 0.1.1.
- The small Later items become milestone 12, released as 0.2.0. Toasts stay in Later until a feature needs them.
- The Show HN waits for 0.2.0.
- The watcher items of milestone 10 and the folder deletes on macOS wait, under Open points.

Rules, as test names, by commit. The names are a first guess, which each commit settles. Each commit also updates the README and the spec where they describe what it changes. Done when: the watcher tests pass on the macOS runner of CI, except the cases that the README lists as known issues. `brew install` gives a working 0.1.1 on Linux and macOS.

1. A favicon (done). The page linked no icon, and no route served `/favicon.ico`. `web/favicon.svg` holds Lucide's `file-text`. The `web` task copies it to `web/dist/assets/`, and `web/index.html` links `/assets/favicon.svg`. `the_favicon_is_served_as_svg`, in `tests/assets.rs`.
   - Lucide icons draw with `currentColor`, which is black in a favicon and hard to see on a dark tab. So the SVG sets its own colours: the accent of the light theme, `#0969da`, and of the dark theme, `#4493f8`, with a `prefers-color-scheme: dark` rule.
   - The glyph uses the same version of Lucide as the `file` icon of `icons.ts`: `file` with three lines.
   - The `/assets/` route already serves SVG with an ETag, and the CSP allows it. The README's notice for Lucide covers its licence.
2. Live updates on macOS: the disk check (done). On FSEvents only, `events()` takes the kind of an event from the disk. A missing path is `removed`. If the path is present, a creation or a rename gives `created`, and any other event gives `changed`. `on_fsevents_the_disk_gives_the_kind_of_an_event`, `on_fsevents_the_flags_of_a_path_give_one_event`.
   - It fixes deletes, renames and saves through a temporary file. A rename becomes `removed` and `created`, so the tab still does not follow a renamed file.
   - A write still gives `created`: FSEvents keeps the creation flag of a file for many seconds. It costs a reload of the tree.
   - `events()` takes a `fsevents` flag, which `forward` sets from `watches_whole_trees()`. The two tests pass `true` on a temporary folder, so the macOS branch runs on Linux too. The other unit tests pass `false`: their paths, such as `/ws/a.md`, do not exist, and would all give `removed`.
   - The check reads the disk with `symlink_metadata()`, which does not follow a link, for the reason of the nit of milestone 10 on `is_dir()` and `exists()`.
   - The cause is under Open points.
3. The watcher tests on macOS (done). `tests/watch.rs` runs on macOS too, and so does `file_change_reaches_the_tab_with_a_relative_path` of `tests/ws.rs`. The README's known issue shrinks to folder deletes and renamed files.
   - Changed from the plan: no case gets `ignore` for its kinds. Where FSEvents gives other events, the test expects them on macOS: `per_os(linux, macos)` picks the expected events. So every case runs on macOS. Only `folder_delete_is_one_removal` gets `ignore` on macOS: it gets no event there, and expecting none would hide the bug.
   - On macOS, a rename gives `removed` and `created`, and the entries of a renamed folder come as `created`. A delete then a create of one path gives `created` only. A save through a temporary file also gives `removed` for the temporary file.
   - On macOS, a write gives `created` while FSEvents still reports the creation of the file, for some seconds, and then `changed`. A first version expected `created`: on the Mac, one test failed in each run, and one in one run of three. So on macOS, the tests accept `created` where they expect `changed`.
   - A fix that the tests found: a folder swapped for another one sent no entries of the new one on macOS. FSEvents gives `RenameMode::Any`, which did not count as gone, so the folder kept its place in the watched folders. `Any` now counts. inotify never gives it.
   - Kamal ran the tests on a Mac, through `ssh sachamac`, with the runbook `~/dev/claude/runbooks/2026-11-09-mdame-m11-macos.md`. On commit 2, 13 of the 25 tests failed, all as above. With this commit, the watcher and WebSocket tests passed in 5 runs of 5, and all the tests passed once, with 2 ignored: the folder delete, and the save test that needs `O_PATH`.
   - At the end of the review, `burst_gives_resync` failed in 1 run of 5 on the Mac. That run took 13.8 s, against 7.3 s for the others: the Mac was busy. The burst threshold applies to each batch, and the debouncer sends a batch every 50 ms. So slow writes spread over batches of 100 events or fewer. mdame then sends each event instead of one `resync`: it costs more, but loses nothing. The test now tries 3 bursts, each in a new workspace. On the Mac, 5 runs of 5 passed after it, but the Mac was not busy then.
   - The first CI run on the macOS runner, an Apple Silicon machine, failed 8 watcher tests. FSEvents reported the creation of the files of each test workspace after the watch started, with the events of the test. In mdame, such a late `created` costs a reload of the tree. On macOS, the test helper now drops the events that come in the first 2 s, and then until none came for 500 ms. The second run found the same in `file_change_reaches_the_tab_with_a_relative_path` of `tests/ws.rs`, which now drops them too.
   - After the release, the CI run of `main` failed once more on macOS: in `folder_deleted_then_created_is_removed_and_created`, FSEvents also reported a change of `docs`, before its creation. On macOS, that test now accepts it. In mdame, a `changed` for a folder costs no more than the `created` after it.
4. The rules of hidden folders apply to the root (done). `mdame ~/.claude` listed `settings.json`, and a leaked token could rewrite it: the hidden and `.git`/`.mdame` rules looked only below the root. They now look at the whole real path, the root's own path included. In a hidden root, the tree lists and the editor edits markdown only. If the root is in `.git` or `.mdame`, mdame stops at start: "mdame does not open a folder in .git or .mdame". `a_hidden_root_lists_only_markdown`, `a_hidden_root_edits_only_markdown`, `a_root_in_git_or_mdame_is_refused`.
   - The editor gets the root's path from the kernel, through `fd_path`, once per request, as the save already did for the file. `editable_name` checks the whole path, the root's included.
   - The editor takes the type of a file from its name alone: in a root whose path is not UTF-8, the whole path has no `&str`, and nothing was editable. The review found it.
   - A root in a hidden folder counts too, such as `~/.config/notes`. So does a Claude Code worktree in `.claude/worktrees/`: mdame opened there shows markdown only.
   - `tempfile::tempdir()` names its folders `.tmp…`, which are hidden. Four tests that need other types failed. `crate::workspace::tempdir()` and `common::tempdir()` make folders named `mdame…`, and the three files of those tests use them throughout. If `TMPDIR` is in a hidden folder, they stop with "set TMPDIR outside hidden folders": the third round of the review found that the recipe of cargo mutants, with `~/.cache`, made every test workspace hidden. The recipe now uses `target/mutants-tmp`. In the fourth round, a test of `create` turned out to check the hidden rule of its `.tmp…` root instead of the real path of a link: every test now makes its folders with these helpers, and `common::workspace` refuses a hidden root.
5. Cross-site requests (done). The guard refuses `/api/*` when `Sec-Fetch-Site` is `cross-site`. Browsers send this header on each request, also on the image and script loads that carry no `Origin`. It is a check beside the `Origin` check and the `SameSite=Strict` cookie. A request without the header, such as one from curl, passes. Six new cases in the matrix of `request_passes_only_with_own_host_own_origin_and_the_token`.
   - Wider than the plan: only `same-origin` and `none` pass, so `same-site` is refused too. A page on another port of the same host is same-site, and the browser sends it the `SameSite=Strict` cookie. The page itself only fetches from its own origin, and a typed address sends `none`.
   - `/raw/` gets the check too: it serves the files of the workspace, as `/api/` does. `is_private` holds the two prefixes, for this check and for `Cache-Control: no-store`.
   - Pages get no check of `Sec-Fetch-Site`. A link from another site still gets no cookie, as before: the cookie is `SameSite=Strict`.
6. Long lines in search answers (done). A search answer had no limit on the length of a line, so a minified file could make it tens of MB. A line over 200 characters is now cut to 200, from 50 characters before its first match, with `…` where text was left out. A context line keeps its first 200 characters. `a_long_line_is_cut_around_the_match`, `a_cut_keeps_the_match_after_letters_that_lowercase_longer`.
   - An answer now holds at most 50 files of 100 lines of 202 characters: about 4 MB with 4-byte characters, and far less in practice.
   - Lowercasing can make a letter longer: `İ` becomes `i̇`, two characters. So without the case, the match's place in the lowercase line is not its place in the line. `first_match` adds up the length of each letter's lowercase until it reaches the match.
   - The page highlights the phrase in the text that it gets, so it needs no change.
7. Ignore files that are not regular files (done). A `.gitignore` or `.ignore` that is a symlink to `/dev/zero`, or a FIFO, made the walker read without end: mdame ran out of memory, or hung. A cloned repository can hold such a link. In the parallel walker of the `ignore` crate, `filter_entry` runs before the crate reads the ignore files of a folder. So the filter now skips such a folder, with a warning. `a_folder_with_a_bad_ignore_file_is_skipped`, `a_bad_ignore_file_at_or_above_the_root_gives_an_empty_tree`.
   - A bad file is any one that is not a regular file of 16 KiB at most, outside the pseudo file systems of the kernel (procfs, sysfs, tracefs, debugfs), through links: a FIFO, a link to a device, a link to `/proc/self/pagemap` (0 bytes by its size, gigabytes when read), or a large file. It covers `.gitignore`, `.ignore` and `.git/info/exclude`, the three files that the walker reads in a folder. The size and the pseudo file systems came from the review: the security reviewer ran out of memory with a link to `/proc/self/pagemap`, and measured 402 MB of memory for a 10 MB `.gitignore`.
   - A first version refused an ignore file on another device than its folder. The second round of the review showed that it refused legitimate links: on this Fedora machine, `/` and `/home` are two devices, and home-manager links `~/.gitignore` into `/nix/store`, a volume of its own on macOS. In a folder above the root, such a link emptied the tree.
   - One walk reads 1 MiB of ignore files at most; past that, a folder with ignore files is left out, with a warning. The walker keeps the globs of each folder above the one that it reads: in the review, 100 nested folders with a 1 MiB `.gitignore` each took 2.5 GB and 22 s for a walk. Which folders are left out can change from walk to walk, since the walk runs on 4 threads.
   - The third round of the review lowered the limits from 1 MiB per file and 8 MiB per walk: with crafted patterns such as `*a<N>b*`, the globs took about 700 times the file's size in memory, and the walker builds up to 4 files at once. 7 folders with 1 MiB each took 2.9 GB. It also replaced the test of the path, `/proc` or `/sys`, with the type of the file system, through `statfs`: a container such as toolbox mounts the host's procfs at `/run/host/proc`. On macOS, which has neither, the test is off.
   - The fourth round lowered the limit of a file to 64 KiB. Matching a name against crafted patterns, such as 5,349 lines of character classes in 256 KiB, next to 2,000 files with matching names, asked for an allocation of 11 GB: globset builds its regex set with capture groups, and its fallback engine then keeps tables that grow as the square of the number of patterns. At 64 KiB, the same walk took 0.6 s. tracefs and debugfs joined procfs and sysfs: as root, `/sys/kernel/tracing/trace_pipe` is a regular file that blocks.
   - The fifth round lowered it to 16 KiB: the cost grows as the square of the number of patterns, not of the bytes, so short lines pack more of them. 32 KiB of `?0`, `?1`… lines, next to 2,000 files, asked for 8 GB, and 32 KiB of `[a-z]0`… next to 10,000 files took 10.5 s and 5.6 GB. At 16 KiB, the reviewer's shapes took 25 MB. Real ignore files stay far under it: of 20 large projects, the largest root `.gitignore` is 10 KB (Firefox and Chromium), and most hold 1 to 4 KB, as measured on 9 November 2026. Any limit stays a bound found by trial; the fix is in globset.
   - The sixth round found crafted cases under every limit: a 15 KB `.gitignore` of the 3,844 lines `?XY`, next to 20,000 three-letter names, asked for 3.3 GB; for that shape the jump comes between 6 and 8 KiB, below real files. 170 nested folders with a 6 KiB `.gitignore` each, 1 MiB in all, took 14 s and 912 MB. Even with globset patched, the 15 KB case took 19.5 s. Decided by Kamal on 9 November 2026: a known limit, as in ripgrep, recorded in the spec's threat table and reported upstream. The limits stay: they stop the files that never end and the plain cases of large ones.
   - Left for later: a `.git` that is a file names a git folder, whose `commondir` and `info/exclude` the walker reads too. Only an archive can hold such a `.git`: git refuses the name in a clone.
   - The walker reads the ignore files of the root and of each folder above it, up to `/`, before any filter: `add_parents` of the `ignore` crate reads them as long as the git ignore files are on, even outside a repository, where it applies none of them. If one of them is bad, the walk gives nothing, with a warning: the tree is empty, and mdame keeps running. The first version checked only up to the repository's root; the review found it.
   - The tests link to `/dev/null`, not `/dev/zero`: if the check broke, `/dev/zero` would fill the memory of the test run. A FIFO test waits 5 s at most for the walk.
   - Cost, measured on 11,935 folders in `~/.cargo/registry/src`, as the median of 25 walks: 104 to 120 ms without the check, 137 to 150 ms with it. That is about 3 µs for each folder, for 3 `stat` calls. Checking `.gitignore` and `.ignore` only gave 127 ms.
8. Two notes in the README (done). "With a coding agent" repeats the advice of the spec: deny the agent reads of mdame's state folder, which holds the token, and of the browser profile. And spellcheck is on by default, but a browser's cloud spellcheck, such as Chrome's Enhanced spell check, may send the editor's text to its vendor.
9. `.github/check-release.sh` reads the port from the URL that mdame prints (done). If port 4891 was busy, mdame took the next free one, but the script still requested 4891. Check 19 found it: another mdame held 4891 and answered 403.
   - The script sends mdame's output to a file, and reads the address from the line `mdame on http://…/`. Rust's stdout writes each line at once, also into a file. `--port 4891` goes: it was the default.
   - Checked on the debug build, with a Python server on 4891: the old script got 404 from it, and the new one passed on 4892. shellcheck passes.
10. CI skips tags (done). CI ran twice for a release: on the branch and on the tag. `ci.yml` now leaves tags out.
    - `push` lists `branches: ['**']`. A trigger that names only branches does not run for tags. `tags-ignore` alone would do the opposite: it names only tags, so no branch would run CI.
    - Check, at the release of 0.1.1: the push of `main` runs CI, and the push of the tag does not.
11. Smaller release binaries, with attestations (done). `strip = true` in the `dist` profile removes the symbols, so the binaries get smaller than 18 MB. `github-attestations = true` in dist lets users check an archive with `gh attestation verify`. `dist plan` checks the config.
    - On x86_64 Linux with glibc, the `dist` build goes from 21.3 MB to 15.0 MB. A panic's backtrace then shows no function names.
    - `dist generate` adds an `Attest` step, with `actions/attest@v4`, and the permissions `id-token: write` and `attestations: write` for the build job. `github-action-commits` pins it to the commit of v4.2.2, published on 4 August 2026.
    - The README's Install tells how to check an archive.
    - Check, at the release of 0.1.1: `gh attestation verify` passes on a downloaded archive.
12. A licence that GitHub detects (done). GitHub's API returns `NOASSERTION` for mdame, and the sidebar shows "View license", not "MIT". `LICENSE` keeps the MIT text with its three copyright lines. The sentence on mdlive and the notices of Lucide, Feather and Primer move to `NOTICE`. The package and the release archives hold it: `include` in `Cargo.toml`, and `include` in `dist-workspace.toml`. crates.io reads `license = "MIT"` from `Cargo.toml`, so it is not affected.
    - `LICENSE` matches the MIT template of GitHub's API, `/licenses/mit`, word for word, once the title and the copyright lines are left out. `dist plan` lists `NOTICE` in each archive, and `cargo package --list` in the package.
    - Check, after the merge: `gh api repos/KamalF/mdame/license` returns `MIT`.
13. The licence texts of the Rust dependencies (done). The release archives held `LICENSE` and `README.md`, but not these texts, and MIT and Apache-2.0 ask for them in each copy. `cargo-about` now writes them into `THIRD-PARTY-LICENSES-RUST.txt`, which the archives hold. `web/dist/assets/THIRD-PARTY-LICENSES.txt` already holds the texts of the npm packages.
    - Decided by Kamal on 9 November 2026: a file of its own, beside the npm one, and written at the release, not committed. `.gitignore` lists it.
    - `about.toml` accepts 9 licences, MIT first: where a crate offers a choice, the first accepted one wins. A crate under any other licence stops the task, and CI runs `mise run licenses` on Linux to find it before a release. MPL-2.0 comes from `cssparser` and `dtoa-short`, through ammonia.
    - `targets` lists the 4 targets of the release, so that each archive gets the same file: 188 KB, 110 licence texts, of which 94 are MIT texts with their own copyright lines.
    - cargo-about 0.9.3, published on 26 October 2026: `mise.toml` installs its binary. It has no binary for Intel macOS, so each build of the release builds it with `cargo install --locked --features cli`, in `.github/build-setup.yml`: dist's `github-build-setup`. Locally, the build took 2 min 14 s, and gave the same file as the binary of mise.
    - `--features cli`: without it, `cargo install` builds cargo-about but installs no binary.
    - Check, at the release of 0.1.1: each archive holds the file.
14. `rust-version` in `Cargo.toml` (done). comrak needs Rust 1.89, and the let chains of mdame need 1.88. The plan said that an older Rust fails with a compile error. In fact, cargo stops before it compiles: on 1.88, it said that comrak and fearless_simd require 1.89, and did not name mdame. Builds with older toolchains found the real minimum: 1.89.
    - Checked on 9 November 2026: `cargo check --locked` passes with 1.89.0, tests included, and 1.88.0 stops at once: comrak 0.56.0 and fearless_simd 1.1.0 require 1.89. The highest `rust-version` of the dependencies is 1.89.
    - The toolchains went into a rustup home of their own, in the sandbox's temporary folder: `~/.rustup` is read-only there. rustup's own HTTP client lost the connection through the sandbox's proxy; `RUSTUP_USE_CURL=1` worked.
    - With edition 2024, cargo's resolver now prefers dependency versions that support 1.89: `cargo update` may hold back a crate that needs a newer Rust. To take it, raise `rust-version` first.
    - The README's Install says that Cargo needs Rust 1.89 or later.
15. `CHANGELOG.md`, with a section for 0.1.0 and one for 0.1.1 (done). dist takes the release notes of a version from it. Without it, the notes held only the install instructions.
    - `dist plan --tag=v0.1.0` takes its title and notes from the section `## 0.1.0 - 2026-11-08`. dist also adds `CHANGELOG.md` to each archive.
    - The section of 0.1.1 gets its date in commit 16. Its lines are for users: what changed for them, not how.
16. Version 0.1.1 (done). `Cargo.toml` says 0.1.1, and the section of 0.1.1 in `CHANGELOG.md` has the date of 10 November 2026. If the release comes on a later day, the date changes with it. The README calls 0.1.1 an early release.
    - Then checks 1 to 8 of the manual checklist, the merge into `main`, and the release: Kamal pushes `main` and the tag `v0.1.1`, and runs `cargo publish`. Then checks 9 to 12.
    - Done on 10 November 2026: mdame 0.1.1 is on GitHub, in the tap and on crates.io. Before the merge, the first CI runs of the branch on the macOS runner found the late events of FSEvents, under commit 3.

Kamal, with no commit:

- Done on 10 November 2026, after the release:
  - A ruleset on `main`: no deletion, no force push, and no update except by the repository's admins. Kamal's own pushes pass, as an admin.
  - GitHub's immutable releases. The release build runs `dist build`, so every build script and proc macro of the dependencies. Since commit 11, that job can read the repository's contents only, but it can write attestations. The jobs that can write the contents run no dependency's code. The ruleset and immutable releases still limit what a compromised action or tool could do: push to `main`, or replace the assets of earlier releases.
  - The topics `markdown`, `markdown-viewer` and `markdown-editor`.
  - The yank of mdame 0.0.1 on crates.io, the early build that held the name.
- Deferred on 10 November 2026, the reports to ripgrep. ripgrep has no security policy, and its private reporting of vulnerabilities is off, so they would be public issues. Report to the `ignore` crate, in BurntSushi/ripgrep, that an ignore file that is a FIFO or a link to `/dev/zero` makes the walker read without end, and so does a `.git` file whose `commondir` is one. ripgrep has the same problem. Report to globset, in the same repository, that `new_regex_set` keeps the capture groups: with crafted patterns, matching a name asked for 11 GB, and 82 MB with `which_captures(WhichCaptures::None)`. Even then, a 15 KB file of `?XY` lines next to 20,000 names took 19.5 s per walk: the lazy DFA gives up, and the PikeVM matches each name against each pattern.

### Manual checklist

Run on 10 November 2026, before the merge: checks 1 to 8 pass. Kamal ran checks 1 to 5 in Firefox. Claude ran checks 1 to 7 in the headless Chrome of agent-browser, on the release build. For check 8, mdame ran on the Mac from a debug build, Kamal made the changes through the runbook, and Claude watched the page in Chrome. Notes:

- 4: Chrome refused the image, and Firefox's DevTools showed 403 for a request that carried the cookie and `Sec-Fetch-Site: same-site`.
- 7: the page says "This folder has no file that mdame shows". Only the terminal gives the cause.
- 8: the delete ran before the create, since `n.md` was there when mdame started. Each change reached the page in a few seconds.

Run on 10 November 2026, after the release: checks 9 to 12 pass. Kamal ran them with the runbook `~/dev/claude/runbooks/2026-11-10-mdame-release-0.1.1.md`. Notes:

- 10: `gh attestation verify` prints its verdict only to a terminal. With `--format json`, it named the signer: `release.yml@refs/tags/v0.1.1`.
- 11: `mise which mdame` returned the binary of `cargo install`, in `~/.cargo/bin`. The check of mise ran the binary in mise's install folder instead. The global mise config now pins 0.1.1.

These checks cover what no test covers: the requests that Chrome and Firefox send through the guard against other sites, the page with a cut search line or a bad ignore file, live updates on a Mac, and the release as a user gets it. Run mdame with `cargo run --release -- -p 4996 <folder>`, in Chrome and Firefox, and reload each open tab after a rebuild. A change on disk comes from a terminal, not from mdame's editor. The test folder holds:

- `a.md`, which shows the image `pic.png`;
- `long.md`, with a line of 5,000 characters that holds the word `needle` near its middle;
- `bad/x.md`, and `bad/.gitignore`, a link to `/dev/zero`;
- `site/other.html`, a page that shows the image `http://127.0.0.1:4996/raw/pic.png`.

Page:

1. The tab shows the icon of mdame.
2. Open `a.md`: `pic.png` shows. Change `a.md` on disk: the page updates. Search `needle`, open the result, then edit `a.md` in the editor and save it: each step works.
3. Type the address `http://127.0.0.1:4996/raw/pic.png`: the image shows.
4. Run `python3 -m http.server 8000 --bind 127.0.0.1 -d site` in the test folder, and open `http://127.0.0.1:8000/other.html`: the image does not show, and DevTools shows 403 for it. A page on another port of the same host is same-site, so the browser sends the cookie: only the guard refuses the image.

Search and ignore files:

5. Search `needle`: the result shows about 200 characters of the long line, with `…` at each end, and `needle` highlighted.
6. The tree leaves out `bad/`, and the terminal of mdame shows a warning that names `bad/.gitignore`.
7. Run `ln -s /dev/zero .ignore` in the test folder, and reload the page: the tree is empty, and the terminal of mdame shows a warning that names `.ignore`. Remove the link, and restart mdame: the tree comes back.

Live updates on macOS, through `ssh -L 4997:127.0.0.1:4997 sachamac`, with mdame run on the Mac with `--no-open -p 4997`, and its address opened on Linux. The changes come from a terminal on the Mac:

8. Create `n.md`: it shows in the tree. Open it, then change it: the page updates. Replace it with `printf '# T\n' > t.tmp && mv t.tmp n.md`: the page updates. Delete it: the page shows "Not found". Rename `a.md` to `c.md`: the tree shows `c.md`, and no `a.md`.

Release, after 0.1.1 is published:

9. CI runs for the push of `main`, and not for the tag. The job "Check release" passes on its Linux and macOS runners.
10. The GitHub release of 0.1.1 shows the notes of its section in `CHANGELOG.md`. Each archive holds `NOTICE`, `CHANGELOG.md` and `THIRD-PARTY-LICENSES-RUST.txt`, and `gh attestation verify <archive> --repo KamalF/mdame` passes.
11. `brew upgrade mdame` on Linux, `mise use -g github:KamalF/mdame` and `cargo install --locked mdame` each give a mdame whose `--version` is 0.1.1.
12. `gh api repos/KamalF/mdame/license --jq .license.spdx_id` prints `MIT`.

## Milestone 12: later items for 0.2.0

Decided on 10 November 2026, before the milestone started. `docs/SPEC.md` holds the scope: milestone 12 in the build order, and the table of Later items.

Rules, as test names, by commit. The names are a first guess, which each commit settles. Each commit also updates the README, the spec and the shortcut help where they describe what it changes. A change with open design questions starts with a design session, right before its code. Done when: each item passes its check of the manual checklist in Chrome and Firefox, and `brew install` gives a working 0.2.0 on Linux and macOS.

1. Arrow keys in the sidebar tree (done). ↑↓ move the keyboard focus between the visible rows, and stop at the ends. → opens a closed folder, and moves into an open one, to its first row. ← closes an open folder, and moves from any other row to its parent folder. Enter opens a file, as a click does. If the filter is empty, ↓ in it focuses the row of the current file, or the first row if that row is not shown. With text in the filter, ↑↓ choose a result, as before. `arrowKey` is a pure function over the visible rows, in `sidebar.test.ts`: `up and down move between the visible rows, and stop at the ends`, `right opens a closed folder, then moves into it`, `left closes an open folder, then moves to its parent`.
   - Decided in a design session on 10 November 2026: the keys move the focus between the rows as they are, links for files and buttons for folders. Tab still stops at each row and at its buttons. A full ARIA tree, with one Tab stop and `aria-selected`, would take the copy-path and new-file buttons out of the Tab order.
   - The filter's arrow-key choice stays without `aria-selected`: see Open points.
   - The visible rows are the rows in the page: a closed folder has no list of its own. The keys work on the filter's results too. They are files, so → does nothing, and ← finds no folder.
   - The keys do nothing with Ctrl, Alt or Meta held: Alt+← is the browser's Back. Enter needs no code: a link opens on Enter, and a button clicks.
   - From Kamal's test in Firefox: a click on empty space in the sidebar left the focus on the page, so the arrows scrolled it. The sidebar now takes the focus, with `tabindex="-1"`, and an arrow key then enters the tree, as ↓ in the filter does. The arrows also work from a row's copy-path and new-file buttons.
   - The focused row gets a grey background, stronger than a hovered row. The row of the current file keeps its own background. The background replaces the browser's focus ring: the `content-visibility` of each line, from milestone 10, clipped the ring down to four blue corners.
   - The shortcut help gets a fourth group, Sidebar tree. Its arrow keys are now Lucide icons, the filter's ↑↓ too. The bundled IBM Plex Mono has only ↑ and ↓, so ← and → came from a smaller fallback font. Kamal chose the icons from a mock of the two.
   - The new icons rename most chunks of `web/dist`. The build stays reproducible: two runs give the same names.
2. Side-by-side diff in diff mode (done). A toggle in the header of the revisions panel shows the revision and the text side by side, through `MergeView` of `@codemirror/merge`. `localStorage` keeps the choice. No unit test: the code is all DOM and CodeMirror views, so the browser check covers it.
   - Decided in a design session on 10 November 2026: both panes are read-only. `MergeView` builds its own two editors and cannot take mdame's. An editable right pane would move the text into it and back at each switch: the undo history would be lost, and the save, the unsaved dot and the reload from disk would have to follow the move.
   - mdame's editor stays behind the panes, hidden, with its inline diff. So the counts and the restore read it as before, and each change to its text, from the disk or a restore, goes to the right pane as the same changes.
   - The panes share the editor's look: `basicSetup`, the palette, markdown and the line wrapping. The palette gives the left pane `--danger`, as the inline diff does for removed text.
   - The panes come with the first revision on screen. A choice of another revision builds them again, at the same scroll position.
   - The gutters of the panes stop after the last line, while the editor's gutter runs to the bottom. `MergeView` forces each editor to the height of its text.
3. The mono toggle (done). View options gets a Font heading, with Default and Mono. Mono shows the content in `--font-mono`, at `--content-width-mono`. `localStorage` keeps the choice. `font.test.ts` tests the stored choice, as `width.test.ts` does for the width.
   - With the width: Mono changes only Default, to `--content-width-mono`, 72ch. Wide and Full keep 80ch and the whole pane: they set `--content-width` on `<html>`, which wins over the class of Mono.
   - Mono is the class `mdame-mono` on `<html>`. The rule `:root.mdame-mono` in `base.css` wins over the `:root` of a theme, so a theme's `--font-content` gives way too.
   - A heading of its own, not a toggle under Show: Show holds what shows or hides. Default and Mono read as the Width choices do.
   - `base.css` sets `--content-width-mono` beside `--content-width`, since the built-in themes set neither.
4. Wide blocks (done). Tables, code blocks, Mermaid diagrams and standalone images grow past the text column, and the text keeps its width. `wide.test.ts` tests the room beside the text: without the outline, beside it, and in a narrow pane.
   - Decided in a design session on 10 November 2026: images grow too, besides the three kinds of the plan. A wide block is centred on the text, and shifts left when it reaches the outline. The outline keeps its place, and blocks stop at it. The spec has the rules.
   - The blocks get no style of their own: `wide.ts` sets three variables on the article, and one CSS rule sizes and moves every wide block. The morph keys each block on its HTML, so a style on a block would make every wide block look changed. A `ResizeObserver` on the article and its pane measures again; the outline measures too, after it moves the column.
   - The variables are registered with `@property` as not inherited, and only the wide blocks inherit them. An inherited variable on the article would restyle each element of the article at each frame of a resize: 370 ms on a dense 1 MB file, as measured for the outline in milestone 10.
   - With the outline beside the column, the room on the right is only the article's padding, 32 px. So in practice a wide block grows to the left. At 1280 px with the sidebar open, the room on the left is 189 px: a table gets 761 px instead of 540.
   - Mermaid draws its SVG at a width of 100%, with its own width as `max-width`, which gives the figure no width of its own to grow to. `renderDiagrams` gives the figure that width.
   - `markImages` in `view.ts` marks a paragraph that holds only an image, maybe in a link, with `mdame-image`. CSS cannot tell a paragraph with only an image from one with text around it.
   - The change bar of a grown block sits 18 px left of the block, as for a block in the column. When a measure moves the wide blocks, `placeBars` places the bars again: a block can move while the article keeps its size.
   - Checked in Chrome: an image in a paragraph with text stays in the column, a table narrower than the column does not move, and Full gives no room.
5. The Catppuccin and Minimal themes (done). Catppuccin Latte, Frappé, Macchiato and Mocha, and Minimal Light and Minimal Dark, built in beside Light and Dark. `BUILT_INS` in `themes.rs` lists them, in the order of the menu, and the `web` task copies every file of `web/themes`. `each_built_in_theme_is_listed_and_served` in `tests/themes.rs`, and `contrast.test.ts`, which checks each pair of colours that the screens use, in every built-in theme.
   - Decided in a design session on 10 November 2026: every built-in theme passes the pairs. The three dark Catppuccin flavours passed as they are, as Light and Dark do. Latte failed 15 pairs, Minimal Light 8 and Minimal Dark 3. Each failing colour keeps its hue and saturation, and its lightness moves until each of its pairs passes. Its comment gives the original. The other choices were the palettes as they are, the failing roles taken from Light or Dark, or no Latte and no Minimal Light.
   - Minimal comes in light and dark, as Minimal itself does.
   - The pairs: body and muted text on each background, links, the text of a main button, errors and the added count on their backgrounds, and each code colour on `--code-bg`, at 4.5:1. The change bars and the borders of alerts, at 3:1. Light and Dark passed them all.
   - The roles of Catppuccin come from its style guide: base, mantle for the panes and code blocks, overlay2 at 25% for the selection, blue for links, and its syntax colours. Minimal's come from its variables: bg1, bg2, tx1, tx2, ax1, hl1.
   - `NOTICE` carries the MIT notices of Catppuccin and Minimal. The menu names come from `LABELS` in `theme.ts`; a test checks that each file of `web/themes` has one.
   - Kamal's own Gruvbox themes stay out of the repository, in `~/.config/mdame/themes/`. They passed the same checks after the same kind of change.
6. Paste or drop an image into the editor (done). The image goes in the folder of the file, and `![](<name>)` goes where it lands. `POST /api/image?path=` takes the bytes of the image. `tests/image.rs`: `an_image_is_saved_where_it_is_asked`, `a_taken_name_gets_the_next_number`, `only_an_image_type_is_saved`, `an_image_never_goes_in_a_hidden_folder`, `an_image_outside_the_workspace_is_refused`, `an_image_in_a_missing_folder_is_not_found`, `an_image_over_the_limit_is_refused`. `paste.test.ts` tests the names and the link.
   - Decided in a design session on 10 November 2026: the folder of the file, as VS Code does; a pasted image is named `pasted-<date>-<time>`; the cursor goes between the brackets of the alt text.
   - The server picks the free name: it opens `name.png`, then `name-2.png`, and so on, with `create_new`, so two pastes at once never write over each other. It gives up after 100 names.
   - The limit is 16 MB. A screenshot is a few MB, and the 8 MB of the editor's text did not fit a photo.
   - The rules of `image_name` mirror those of `editable_name`: the whole real path counts, so a link with a plain name into `.claude` is refused too. A hidden folder gets no image at all, since its tree shows only markdown.
   - A paste with text keeps CodeMirror's paste: copying part of a web page brings its images with the text. A drop of an image of another type, such as BMP or HEIC, shows an error: CodeMirror would insert the bytes of the file as text.
   - The error of a failed image shows in the status bar of the editor, as a failed save does.
   - Found by the browser check: a second paste right after the first landed in the empty alt text of the first, as `![![](b.png)](a.png)`, since the cursor waits there. With the cursor in an empty alt text and nothing selected, a new image now goes on the next line. `skipEmptyAlt` in `paste.test.ts`.
7. The print stylesheet (done). Ctrl+P prints the whole file alone, without the sidebar, the status bar, the outline, the change bars and the copy buttons. `print.css`. No test: CSS only, so the browser check and the manual checklist cover it.
   - Paper always takes the built-in Light theme, whatever the screen shows: light text of a dark theme would be faint on white paper, and browsers leave out backgrounds when they print. `index.html` loads `light.css` once more, last, for print, and a user or built-in theme other than Light and Dark loads for the screen only.
   - On screen the content scrolls inside its pane, which would print only the part in view: on paper, the page, the frame and the pane grow to the whole file.
   - The page gives the width: the column takes it, without the outline's margins, and the wide blocks lose their shift. A long code line wraps, and a block is not cut across two pages when it fits on one.
   - In the editor, the preview prints. CodeMirror draws only the lines on screen, so with the preview hidden, the text prints in part: print from the view.
   - A Mermaid diagram prints in the theme it was drawn in, as on screen: from a dark theme, it prints dark. The browser prints before an async redraw could end. Tried and dropped: an inversion of the dark drawing on paper (`filter: invert(1) hue-rotate(180deg)`). Kamal did not like it: who minds can pick a light theme before printing. The README says so.
   - Found by the check, a print to PDF from Catppuccin Mocha: the wide blocks kept their shift, and were cut at the left edge of the page. On paper, the room of the wide blocks is now 0, as with Full.
8. Word count and reading time in the status bar (done). The view of a markdown file shows "1,234 words · 6 min" after its time, at 200 words a minute, and at least a minute. `words.test.ts`: `words are counted without punctuation, numbers included`, `words are counted in a script with no spaces`, `the label gives the words and the reading time, at least a minute`.
   - Decided with Kamal on 10 November 2026: the rendered text counts, without code blocks and diagrams. The source would count the URLs of links and the marks of markdown.
   - `Intl.Segmenter` finds the words, so a text in Chinese or Thai, with no spaces, counts too. Punctuation does not count, and numbers do.
   - Markdown only: other types render as code, or as a table of data. The editor shows no count: its status bar is rebuilt at each keystroke.
   - The count runs at each render, and at each live update of the file.
9. Version 0.2.0. `Cargo.toml` and `CHANGELOG.md` say 0.2.0. Then the manual checklist, the merge into `main`, and the release, as for 0.1.1. Then the Show HN.
   - Checked on 10 November 2026: the release job of dist works with GitHub's immutable releases. Immutable releases freeze the assets of a release once it is published. The `host` job creates the release with one `gh release create … artifacts/*`, and gh creates a draft, uploads the archives, and then publishes it. The jobs after it push the formula to the tap and download the archives, so none changes the release.

### Manual checklist

These checks cover what no test covers: the keys, the layouts and the paper in Chrome and Firefox, the paste and the drop of a real browser, and the release as a user gets it. Run mdame with `cargo run --release -- -p 4996 <folder>`, in a window about 1280 px wide, and reload each open tab after a rebuild. A change on disk comes from a terminal, not from mdame's editor. The test folder holds:

- `a.md`, with three `##` headings, a few paragraphs, a table of 10 columns, a code line of 200 characters, a Mermaid flowchart of 8 nodes in a row, the image `wide.png` alone in a paragraph, and the image `small.png` inside a sentence;
- `wide.png`, 1,200 px wide, and `small.png`, 32 px wide;
- `docs/b.md` and `docs/sub/c.md`;
- `.notes/n.md`, and `data.json`;
- `photo.jpg` and `pic.bmp`, to drop from the file manager.

Sidebar tree:

1. Open `a.md`, press `/`, then ↓: the row of `a.md` gets a grey background. ↑ and ↓ move between the rows, and stop at the first and the last. On `docs`, → opens it, and → again moves to `docs/b.md`. ← moves back to `docs`, and ← again closes it. Enter on a file opens it. Click empty space in the sidebar, then press ↓: the row of the current file gets the focus. Alt+← goes back in the history. `?` shows the group Sidebar tree, with the arrows as icons.

Revisions:

2. Edit `a.md` and save it twice, with a change each time. Press `h`, then the Side by side button in the header of the revisions panel: the revision shows on the left and the text on the right, with the colours of the inline diff, and neither pane takes typing. Choose the other revision: the panes show it, at the same scroll position. Change `a.md` on disk: the right pane shows the change. Reload the page and press `h`: the panes come back. Press the button again, type a word, switch to side by side and back, and press Ctrl+Z: the word goes.

View options:

3. Choose Font: Mono. The text of `a.md` shows in IBM Plex Mono, in a wider column. Choose Width: Wide, then Full: the column grows each time. Reload: Mono stays. Open the editor: the preview shows Mono too. Choose Font: Default and Width: Default.
4. The theme list holds Light, Dark, Catppuccin Latte, Frappé, Macchiato and Mocha, then Minimal Light and Minimal Dark. In each, on `a.md` after a change on disk: the text, the links, the code and the change bars read well, and so does the diff of the editor.

Wide blocks:

5. With the sidebar open and the outline beside the column: the table, the code block, the diagram and `wide.png` grow past the column, mostly to the left, and stop before the outline. The text keeps its width, and `small.png` stays in its sentence. Hide the outline in View options: the blocks centre on the text. Narrow the window: the blocks shrink back, and the table scrolls inside. With Width: Full, no block grows. Add a column to the table on disk: its change bar sits at the left of the grown table.

Editor:

6. In the editor of `a.md`, take a screenshot to the clipboard and paste it: `pasted-<date>-<time>.png` shows beside `a.md` in the tree, and `![](pasted-….png)` lands at the cursor, with the cursor between the brackets. Paste again at once: the second link goes on the next line. Drop `photo.jpg` twice: `![](photo.jpg)` and `![](photo-2.jpg)`. The preview shows the three images. Drop `pic.bmp`: the status bar says "mdame saves PNG, JPEG, GIF, WebP and SVG images", and the text stays as it was. Copy part of a web page with an image in it, and paste it: the text comes, and no image file. In the editor of `.notes/n.md`, paste the screenshot: the status bar says that mdame saves no image in a hidden folder.

Print and word count:

7. Pick Catppuccin Mocha, and print `a.md` to a PDF: the PDF shows the whole file in the Light theme, without the sidebar, the status bar, the outline, the change bars or the copy buttons. The table and the code fit the width of the page, and the left edge cuts nothing. The diagram keeps its dark colours. In the editor, the print shows the preview.
8. The status bar of `a.md` shows its words and its reading time, such as "312 words · 2 min". Add a paragraph on disk: the count grows. The status bar of the editor and that of `data.json` show no count.

Release, after 0.2.0 is published:

9. CI runs for the push of `main`, and the job "Check release" passes on its Linux and macOS runners. The release job passes, and GitHub shows the release of 0.2.0 as immutable, with the notes of its section in `CHANGELOG.md`.
10. `brew upgrade mdame` on Linux and on the Mac, `mise use -g github:KamalF/mdame@0.2.0`, and `cargo install --locked mdame` each give a mdame whose `--version` is 0.2.0, and that opens a folder.

## Public repository and crate

Decided on 29 October 2026, before milestone 8:

- The repository goes public on GitHub as `KamalF/mdame`, with `main` only. The `backup/*` branches stay local.
- Every commit uses the GitHub noreply address, `8170277+KamalF@users.noreply.github.com`. `git filter-repo` rewrote the history before the first push, so the hashes of older commits changed.
- crates.io gets the current code as `mdame` 0.0.1, to hold the name. 0.1.0 stays for the release.
- The package holds `src/`, `web/dist/`, `LICENSE` and `README.md` only. `LICENSE` now carries the notices of Lucide and Feather.
- `mise run web` writes `web/dist/THIRD-PARTY-LICENSES.txt`, with the licence texts of the 111 npm packages in the bundle: MIT, ISC, BSD-3-Clause, Apache-2.0, EPL-2.0 (elkjs, through Mermaid) and others. It comes before the push, since the crate's 0.0.1 is permanent.

Done on 29 October 2026: https://github.com/KamalF/mdame is public, and crates.io has `mdame` 0.0.1.

## Next

1. Milestone 12, on the `m12-later` branch: the review of the milestone, then commit 9, version 0.2.0, then checks 1 to 8 of the manual checklist.
2. Release 0.2.0, then the Show HN.
3. Milestone 13.

## Open points

- Live updates on macOS, for milestone 13: two known issues are left after commits 2 and 3 of milestone 11. A tab does not follow a renamed file, and a folder delete sends nothing, so the folder stays in the tree.
  - The cause. For each path, FSEvents reports all the flags that the path collected, in no order, and never the side of a rename. notify turns each flag into its own event, always in the same order: creation, removal, rename, change. notify-debouncer-full then drops a creation that a removal follows, and a change that follows a creation. Since commit 2, the disk gives the kinds, so a rename gives `removed` and `created`.
  - For some seconds after the creation of a file, FSEvents keeps reporting it, so a write gives `created`. It costs a reload of the tree. Measured on an Intel Mac with macOS 15.7.9, on 8 and 9 November 2026.
  - A folder delete: the debouncer drops its events before mdame sees them. Its fix: on macOS, use notify's FSEvents watcher without the debouncer, batch its events in mdame, and check the disk for each path.
- From the review of milestone 3: screen readers do not hear the filter's arrow-key choice. `aria-selected` needs the listbox pattern, and a listbox may hold only options: the copy-path button beside each result breaks it. Left open on 10 November 2026, in the design session of commit 1 of milestone 12.
- From check 7 of milestone 11: if a bad ignore file at or above the root empties the tree, the page says only "This folder has no file that mdame shows". The cause is in the terminal only. The page could name the file.
- From the release of 0.1.1: `brew audit` asks for a `test do` block in the formula that dist writes, such as one that runs `mdame --version`. Find out whether dist can write it.
- From milestone 10, the watcher:
  - Move to notify-debouncer-full 0.8 once it is final. Its watches no longer take quadratic time, so live updates would start at once on a large workspace, and the watches after an overflow would come back at once. Its unwatching stays linear for each folder, so hiding many folders stays slow.
  - A gitignored file in a folder that the tree shows still sends events, so the list of changes can show a markdown file that the tree hides.
  - A change to `.git/info/exclude`, or to the global gitignore, updates the watches only at the next walk.
  - A folder renamed over an empty shown folder, from a hidden folder or from outside the workspace, sends nothing, and is not watched again until an overflow or a restart: notify-debouncer-full 0.7 drops the creation and the removal of one path in one batch. `main` watched it, through notify's recursive watch. Only a program that calls `rename` on a folder does it; `mv` moves the folder into the empty one. A fix: keep each folder's inode from the walk, and watch again a folder whose inode changed, at the next walk.
  - notify-debouncer-full keeps a root for each folder that mdame ever watched, even after notify dropped its watch: it has no call to drop one. In 0.7, each new watch scans the roots, so over a long session with many folders made and removed, watching gets slower, and so does the watching after an overflow. 0.8 searches them, so only their memory stays.
- A write to an existing `.gitignore` or `.ignore` that hides folders changes the watched folders, but the tab gets only `changed`, which does not reload the tree. `main` has the same gap in the tree. One that shows folders sends `created` for their files.
- dist's shell installer, from 0.33.0: in a flat layout such as `~/.local/bin`, it migrates any `<install dir>/env` that matches dist's template, so it takes over the env file of another tool that dist built, such as uv. Report it to axodotdev/cargo-dist: the migration should touch only an env file that this app wrote. mdame is no longer affected: `4a20fb7` dropped the shell installer, so the report is all that is left.

- Nits deferred by the review of milestone 10:
  - The watcher's `is_dir()` in `changed_by` and `exists()` in `watch_folders` follow symlinks out of the workspace: a link to a hung or automounted path can block the watcher. `symlink_metadata()` would not follow it. Since milestone 11, the disk check of `kind_from_disk` uses it.
- From the review of milestone 9, for later:
  - On vfat, the short names `CLAUDE~1` and `MDAME~1`, and a trailing dot such as `.git.`, pass the name check. On HFS+, so do names with an ignorable code point, such as `.mdam\u{200C}e`: macOS editing, new in milestone 10, makes it reachable. Git guards the same aliases. Not checked.
  - A git worktree in a hidden folder that is not gitignored, such as Claude Code's `.claude/worktrees/`, shows its copy of the repository in the tree, the search and the list of changes. Decided on 6 November 2026: no option of mdame's own. The README says to list such a folder in `.ignore` or `.git/info/exclude`.
- Nits deferred by the review of milestone 9:
  - `marks()` costs blocks × lines, and the outline's `entries()` costs marks × headings. A crafted file can block the tab for seconds at each change.
  - The version last seen follows a rename only for the file on screen.
  - "Last seen" of a file that was not UTF-8 holds U+FFFD, and its Restore writes them.
  - A blank line that splits a paragraph in two gets no bar.
  - A list item added two lines above another change gets a "changed" bar, not "added": the line diff merges the two changes. Found by check 4 of the manual checklist.
  - `spy()` in the outline reads the box of every heading at each scroll frame.
  - `forget()` keeps the article that the editor replaced in memory until the next file shows.
  - `highlight` in `search.ts` could return the `Part` type of `sidebar.ts`. The `write` helper of the search tests copies the one of the tree tests.
- Nits deferred by the review and the over-engineering check of milestone 8:
  - A stored theme applies only when `main.js` runs, so a reload may show the system's theme first. Check 2 of the manual checklist watches for it.
  - The `failed` flag of `editor.ts` may say no more than `editor.openPath() === null` on an editing route. Needs a browser check of a reconnection during a mount.

- From the review of milestone 7, for later:
  - `choose()` in `revisions.ts` builds the merge view again to switch revisions. The `updateOriginalDoc` effect of `@codemirror/merge` would change it in place. Needs a browser check.
  - The panel's error line and Restore button copy the dialog's `errorLine()` and button styles.
- Nits deferred by the review of milestone 7:
  - A link inside the history, such as `.mdame/history/a.md -> b.md`, joins the revisions of two files.
  - Choosing a revision with the keyboard moves the focus to the page body.
  - With `snapshots_per_file = 0`, a save in diff mode keeps the diff of a revision that it pruned.
  - An `id` over 255 bytes gives 500 "File name too long", not 404.
- From the review of milestone 6, for later:
  - No header-read or idle timeout: idle connections can hold every file descriptor, and keep the browser out after a theft.
  - Above about 55,000 distinct lines, or a changed middle of 160,000 lines, the silent reload replaces the whole text and the cursor jumps. A patience diff would lift the limit.
  - The editor uses the markdown language for every file family.
  - `e` opens the editor at line 1, and Esc shows the view from the top.
  - `split.ts` copies the sidebar's resize handle and its CSS.
  - Each preview render runs Mermaid again on every diagram, with new ids, so the morph rewrites them all.
  - The check after our own save downloads the whole file to compare its `ETag`. `If-None-Match` and a 304 would skip the body.
  - A 1–8 MB text goes to `/api/render` at each typing pause, only to get the notice back.
- Nits deferred by the review of milestone 6:
  - Ctrl+B and Ctrl+I: a marker next to a backslash is escaped; Ctrl+I strips the stars inside a code span; between `**a**` and `**b**`, Ctrl+B merges them. Neither undoes itself when a `*` is inside the selection or right next to it.
  - The editor's status bar has no Copy path or Copy content. It is rebuilt at each keystroke, so Save loses the focus and an error is announced again. A failed disk check leaves its error until a save succeeds.
  - The view's notice for a 1–8 MB file says "Open it in the editor" for a hidden file that is not markdown, or for a file that is not UTF-8.
  - A file rewritten during editing as non-UTF-8, or past 8 MB, gives a status error or a 413, and no notice.
  - A `changed` event during `editor.mount` is lost: a later save gets 412.
  - Two quick Backs with unsaved edits open two dialogs. `e`, a `#…` link in the preview, then Esc leave [view, edit, view] in the history.
  - An unedited Ctrl+S rewrites a file with mixed line breaks.
  - If the state check of a reconnection fails once, the page holds its requests while its socket stays open.
  - Ctrl+S on non-Latin keyboard layouts (not checked).
  - The scroll sync reads one rect per `[data-sourcepos]` element at each scroll frame.
  - A file swapped for a FIFO between the type check and the open hangs the save, and the saves after it: the `O_NONBLOCK` fix of milestone 4's open point must cover the save's open too.
  - mdame writes `.mdame/.gitignore` only when it creates `.mdame`.
  - A save that writes nothing still opens the file for writing, so inotify reports `IN_CLOSE_WRITE`.
  - A text full of control characters escapes past the 32 MB body limit.
  - `history::snapshot` keeps a branch for paths with no extension, which the editor's routes refuse.
  - Tests: five permission tests fail as root; `tests/source.rs` and `tests/save.rs` repeat one table.
- The editor does not follow a rename of its file, as the view does: it shows the deleted notice.
- Development only: `/assets` sends an `ETag` but no `Cache-Control`, so after a rebuild Chrome may reuse its cached `main.js` for one page load without asking the server. This misled one browser check in milestone 6. Release builds are not affected, since their files change only with the binary.
- Backup branches, to delete once they are no longer needed: `backup/before-typescript` and `backup/m4-viewing-before-typescript` (the JavaScript history, before the rewrite of 18 October 2026), `backup/m4-before-dist-fix`, `backup/m6-before-import-fixup`, and `backup/m6-before-history-rewrite` (milestone 6 before its review commits were regrouped, 25 October 2026).
- From the review of milestone 5, for later:
  - notify 8.2 (inotify): a folder replaced by a symlink right after its creation is still watched, with its target: its events reach the tabs, and the watches use up the inotify limit. Report upstream to notify-rs. To check again: since `2f2a6e9` in milestone 10, Linux watches only the folders that mdame's own walk finds, and the walk does not follow links. A swap between the walk and the watch may still watch one target.
  - No test fails if `with_follow_symlinks(false)` is removed: the event filter hides it, and only the number of inotify watches shows it. To check again since `2f2a6e9`: with a watch per folder, the setting may change nothing on Linux.
  - `HEAD /raw` runs the GET handler and reads the file (up to 64 MB) only to answer whether it exists.
- `mise run dev -- -v`: argument passing to mdame not checked yet.
- From the review of milestone 4, for later: stream `/raw` instead of reading the file whole (capped at 64 MB now); open files with `O_NONBLOCK` so that a file swapped for a FIFO between the type check and the open cannot block a thread; "Copy content" fetches before it writes to the clipboard, which Safari may refuse, and the failure tooltip then blames localhost.
- Handlers all live in `server.rs`; the spec's `api.rs` + `api/` split (`files.rs`, `history.rs`, `workspace.rs`) is not done. Do it when `server.rs` gets hard to read, in a commit of its own.
- Debug builds render a dense 1 MB markdown file in about 10 s. If `mise run dev` feels slow, `[profile.dev.package."*"] opt-level = 2` optimizes the dependencies only.
- From the review of 18 October 2026, for later:
  - Usability: unknown `/api/*` routes and wrong methods should use the spec's error shape; `-p 80` gets 403.
- From the review of milestone 3, for later:
  - Sidebar: `mount` and `setupLayout` return controller objects instead of setting module-level functions.
  - Big workspaces: latinized names computed once for the filter. The limit on the filter results, the cached icons and a faster `/api/tree` came in milestone 10.
- From the second review of the performance fixes, and the run of the manual checklist of milestone 10, for after 0.1.0:
  - Tree: a virtual tree, which builds only the rows in view. A drag of the sidebar runs at 22 fps with 1,614 rows.
  - Tree: a refetch compares the whole text of `/api/tree`, the times included. Under the name sort, a change of time renders all the rows: compare what the tree draws instead.
  - Server: one walk for the tabs that ask at the same time. Today, N tabs wait N walks.
  - Server: with notify 9, which can leave out the events of opened folders, revisit the 4 threads of the walk, the `WALKING` lock and the filters of Access events.
  - Morph: key the blocks on the server's HTML, before `prepare`, and highlight and draw only the changed blocks.
  - Morph: match the equal nodes of the middle before the pairs by position, so that an open `<details>` stays open when blocks change on both sides of it.
  - Mermaid: the cache holds 50 drawings, so a file with more diagrams misses on each one. A Gantt chart keeps the width of its first drawing. The diagrams on screen keep their theme until the next render.
  - Search panel: opening a result with `web/api` open takes 289 ms, in the panel itself.
