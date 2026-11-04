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
| 5 | Live updates | Done 19 October 2026, merged into `main` 20 October | 56, with the review fixes |
| 6 | Editor | Done 25 October 2026, merged into `main` the same day | 68, with the review fixes |
| 7 | Revisions | Done 29 October 2026, merged into `main` the same day | 31, with the review fixes |
| 8 | Themes and polish | Done 3 November 2026, merged into `main` the same day | 31, with the review fixes |
| 9 | Agent workflow | Planned 3 November 2026 | About 12, without the review fixes |
| 10 | Release, then Show HN | — | About 10, without the review fixes |
| 11 | Small Later items | — | About 10, without the review fixes |

The commits of milestones 9 to 11 are estimates, made on 3 November 2026. Before their reviews, milestones 7 and 8 made one commit for each commit of their plan. The plan of milestone 9 has 12 commits before its review. Milestones 10 and 11 have no plan yet; each has about 10 items in the build order of `docs/SPEC.md`.

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
3. The source in `/api/file`: `source` holds the text that was rendered, and is `null` for an image and over 1 MB. `file_returns_the_source_that_it_rendered`, `an_image_and_a_large_file_have_no_source`.
4. Change bars: a pure module finds the marks from the version last seen, the current source and the blocks' `data-sourcepos`. The page keeps the version last seen of each file in memory. `an added paragraph is marked added`, `a changed list item marks the item, not the list`, `removed text marks the place where it was`, `an undone change loses its bar`, `a file shown for the first time has no bars`, `leaving a file makes the version on screen the one last seen`.
5. "Last seen" in diff mode: the first entry of the revision list when the file differs from the version last seen. Its Restore saves that text through `PUT /api/file` with `If-Match`. `last seen comes first when the file changed`, `no last seen entry when the file is unchanged`, `restoring last seen saves its text`.
6. The list of changes: a pure module keeps the list, and the status bar shows it, with a menu when it holds several files. `a created or changed markdown file is listed`, `other types are not listed`, `the file on screen is not listed`, `a second change moves the file to the top`, `opening a file removes it`, `a rename keeps the entry under the new name`, `a removed file leaves the list`, `resync adds nothing`, `clear empties the list`.
7. `GET /api/search`, in a new `search.rs`, with a row in the routes matrix. `a_phrase_matches_in_any_case`, `an_uppercase_letter_makes_the_case_count`, `search_reads_what_the_tree_shows` (gitignored files out, hidden markdown in, `.git` out), `images_and_files_over_1_mb_are_skipped`, `a_file_that_is_not_utf8_is_skipped`, `newest_files_come_first`, `results_stop_at_50_files_and_20_matches_per_file`, `context_lines_are_merged_where_they_overlap`, `an_empty_query_is_400`.
8. The search panel: `s` and a button beside the filter open it. A new keystroke aborts the request in flight. `the match is bold whatever its case`, `the preview breaks where the line numbers jump`, `a line maps to the block that holds it`.
9. The content width: the palette menu gains a Width section, and its tooltip says "View options". `a stored width wins`, `default sets no width`, `an unknown stored width falls back to default`.
10. The outline: a pure module lists the headings and places the outline. `only h2 and h3 are listed`, `fewer than 3 headings give no outline`, `a section with a change bar gets a dot`, `the outline fits beside a centred column`, `without room the column moves left`, `with full the column narrows`, `when moving is not enough the outline hides`. Its toggle in View options.
11. Spellcheck: the editor's `spellcheck` attribute sits in a CodeMirror compartment, so its toggle in View options applies with no reload. `spellcheck follows the stored choice`.
12. Shortcut help: one list of the keys, and `?` opens the dialog, with the footer line. `every key that the page binds is in the help`, `macos shows ⌘ and the others ctrl`.
13. Manual checklist, `cargo mutants`, review loop.
   - For the "done when" check: this repository's `.git/info/exclude` lists `/.claude/`, and ignore rules apply in hidden folders too, so its `.claude/plans` stays out of the tree. Run the check in another workspace.

## Public repository and crate

Decided on 29 October 2026, before milestone 8:

- The repository goes public on GitHub as `KamalF/mdame`, with `main` only. The `backup/*` branches stay local.
- Every commit uses the GitHub noreply address, `8170277+KamalF@users.noreply.github.com`. `git filter-repo` rewrote the history before the first push, so the hashes of older commits changed.
- crates.io gets the current code as `mdame` 0.0.1, to hold the name. 0.1.0 stays for the release.
- The package holds `src/`, `web/dist/`, `LICENSE` and `README.md` only. `LICENSE` now carries the notices of Lucide and Feather.
- `mise run web` writes `web/dist/THIRD-PARTY-LICENSES.txt`, with the licence texts of the 111 npm packages in the bundle: MIT, ISC, BSD-3-Clause, Apache-2.0, EPL-2.0 (elkjs, through Mermaid) and others. It comes before the push, since the crate's 0.0.1 is permanent.

Done on 29 October 2026: https://github.com/KamalF/mdame is public, and crates.io has `mdame` 0.0.1.

## Next

1. Milestone 9, on the `m9-agent-workflow` branch: commit 3 of its plan.

## Open points

- From the review of milestone 8, for milestone 10:
  - CI: pin `jdx/mise-action` and `Swatinem/rust-cache` by commit SHA, and set `persist-credentials: false` on the checkout.
  - `web/themes/README.md`: say to use only themes that you trust. A theme can load images from the web, and so tell its author when mdame is used and which links a page holds.
- Nits deferred by the review and the over-engineering check of milestone 8:
  - `LICENSE` has no notice for `@primer/primitives` (MIT), whose colour values the built-in themes copy. For milestone 10.
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
  - The editor's routes read `/proc/self/fd`, so on macOS every edit is refused. `F_GETPATH` would do there.
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
  - notify 8.2 (inotify): a folder replaced by a symlink right after its creation is still watched, with its target: its events reach the tabs, and the watches use up the inotify limit. Report upstream to notify-rs.
  - macOS: the debouncer's `FileIdMap` cache walks symlinked folders (macOS is not a target).
  - No test fails if `with_follow_symlinks(false)` is removed: the event filter hides it, and only the number of inotify watches shows it.
  - A folder deleted between notify's inotify add and its stat gives `Io(NotFound)` with no path, which still turns live updates off; skipping it needs a retry.
  - A crafted chain of 1000–2000 nested folders with an unreadable one at the bottom takes 10–77 s to open.
  - `HEAD /raw` runs the GET handler and reads the file (up to 64 MB) only to answer whether it exists.
- The watcher watches gitignored folders too (`target/`, `node_modules/`: 2 600 of this repo's 2 900 folders), so a `cargo build` in the workspace sends events and `resync`s for files the tree never shows. Measure in the browser after milestone 5 before filtering.
- `mise run dev -- -v`: argument passing to mdame not checked yet.
- From the review of milestone 4, for later: stream `/raw` instead of reading the file whole (capped at 64 MB now); open files with `O_NONBLOCK` so that a file swapped for a FIFO between the type check and the open cannot block a thread; "Copy content" fetches before it writes to the clipboard, which Safari may refuse, and the failure tooltip then blames localhost.
- Handlers all live in `server.rs`; the spec's `api.rs` + `api/` split (`files.rs`, `history.rs`, `workspace.rs`) is not done. Do it when `server.rs` gets hard to read, in a commit of its own.
- Debug builds render a dense 1 MB markdown file in about 10 s. If `mise run dev` feels slow, `[profile.dev.package."*"] opt-level = 2` optimizes the dependencies only.
- From the review of 18 October 2026, for later:
  - Security: refuse `/api/*` when `Sec-Fetch-Site: cross-site`.
  - Usability: unknown `/api/*` routes and wrong methods should use the spec's error shape; `-p 80` gets 403.
- From the review of milestone 3, for later:
  - Sidebar: `mount` and `setupLayout` return controller objects instead of setting module-level functions; `aria-selected` for the arrow-key choice.
  - Big workspaces: a limit on the filter results, latinized names computed once, cached icons; `/api/tree` walks the whole folder on each request. Measure with the milestone 5 refetches first.
