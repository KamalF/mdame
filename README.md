# mdame

A markdown viewer and editor in your browser, beside your terminal, lighter
than VS Code.

Run `mdame` in a folder, and its markdown opens in a browser tab: rendered,
with Mermaid diagrams, and updated as the files change on disk. It is made for
work in the terminal, with a coding agent that writes its plans and specs in
markdown. You read them as they change, and fix a line in place. mdame is one
Rust binary, and with its tab it takes 64 MB of memory on a small folder, where
VS Code takes 1 GB.

I was looking for a markdown editor, and I tried
[mdlive](https://github.com/bearded-giant/mdlive) for a short time. Then I built
my own, as a learning project: a way to practise software engineering with a
coding agent.

![An agent rewrites its plan, and mdame updates the page: a bar marks each
changed block, and the status bar lists another file that changed. Then diff
mode shows the text that you last saw.](docs/demo.gif)

0.1.0 is the first release. I have used it on Linux only. On macOS, live
updates have [two known issues](#known-issues). The tests pass on macOS too,
except one that needs a Linux feature, and one of the known issues. mdame does
not run on Windows.

## Install

With Homebrew, on macOS or Linux:

```sh
brew install KamalF/tap/mdame
```

With mise, from the release archives:

```sh
mise use -g github:KamalF/mdame
```

With Cargo, from the source:

```sh
cargo install --locked mdame
```

On Linux, you can also download the archive for your system from the
[latest release](https://github.com/KamalF/mdame/releases/latest), and put
`mdame` in a folder of your `PATH`, such as `~/.local/bin`. The binaries are
static, so they run on any distribution. On macOS, use Homebrew or mise: the
binaries are not notarized, so macOS blocks one that a browser downloaded.

From 0.1.1, each archive has an attestation: a record, signed by GitHub, that
the release workflow of this repository built it. To check an archive:

```sh
gh attestation verify mdame-x86_64-unknown-linux-musl.tar.xz --repo KamalF/mdame
```

## With a coding agent

mdame shows the markdown files in hidden folders too, where agents keep their
plans. To see the plans of Claude Code, set `plansDirectory` in
`.claude/settings.json`, so that it writes them in the project:

```json
{
  "plansDirectory": ".claude/plans"
}
```

If your `.gitignore` lists `.claude/`, mdame does not show it. To show it, but
not the git worktrees that Claude Code keeps there, add these lines to a
`.ignore` file at the root of the project:

```gitignore
!.claude/
.claude/worktrees/
```

Then run `mdame` at the root of the project, and ask Claude Code for a plan.

1. The plan shows in the status bar, which lists the files that changed. A
   click opens it.
2. Press `e` to edit it, for example to drop a step, and save with Ctrl+S (⌘S
   on macOS). Press Esc to go back to the view, and tell the agent to read the
   plan again.
3. When the agent rewrites the plan, a bar marks each block that changed. `h`
   opens diff mode, where "Last seen" shows the text that you last saw, and
   its Restore button brings it back.

Each request to mdame needs a token, so that other programs on your machine
cannot change your files through it. An agent that can read the token can use
it too. If your agent runs in a sandbox, deny it reads of
`~/.local/state/mdame/`, which holds the token, and of your browser's profile,
whose cookies hold it too.

## Usage

```sh
mdame [PATH]
```

mdame opens the folder or file at `PATH` in your browser. Without `PATH`, it
opens the current folder. By default, it listens on 127.0.0.1. `mdame --help`
lists the options.

- It renders GitHub-flavoured markdown, with alerts, footnotes and Mermaid
  diagrams, and updates the page when a file changes on disk.
- It shows and edits the markdown files in hidden folders too, such as the
  plans of a coding agent in `.claude/plans/`. Other files there stay out,
  also when mdame opens a hidden folder itself. `.git` and `.mdame` stay out.
- When a file changes on disk, a bar at the left marks each block that changed
  since you last saw the file. The status bar lists the other markdown files
  that changed, and a click opens one.
- `s` searches the contents of the files.
- It edits files in the browser, with CodeMirror.
- It keeps revisions of each file that it saves (the last 20 by default), and
  restores them. Its diff mode also shows the version that you last saw, and
  restores it. The revisions live in a `.mdame` folder at the root, which holds
  its own `.gitignore`.

Files that `.gitignore` hides stay out of the tree and the search. Changes in
the folders that it hides stay out of the list of changes. To hide more, such
as the git worktrees that an agent keeps in `.claude/worktrees/`, list them in
a `.ignore` file at the root of the folder, or in `.git/info/exclude`. Both
use the syntax of `.gitignore`.

For the keyboard shortcuts, press `?` or click the keyboard button in the status bar.

## Compared with VS Code

VS Code previews markdown and edits it, but it is a whole IDE. With the preview
open, it takes 16 times the memory of mdame and its tab on a small folder, and
8 times on a large one.

Measured on Linux on 7 November 2026, with
[scripts/memory.sh](scripts/memory.sh), as PSS: a memory page that several
processes share counts once, split between them. For mdame, the server and the
process of its tab in Chromium count; your browser is open anyway. For VS Code,
every process counts. It ran with no extension, and with the preview of the file
open beside the text.

| Folder and file | mdame 0.1.0-rc.2 | VS Code 1.145.2 |
| --- | --- | --- |
| This repository, `README.md`, after one minute | 64 MB | 1,003 MB |
| [mdn/content](https://github.com/mdn/content) (14,751 folders), the page of `Array`, after two minutes | 144 MB | 1,138 MB |

## Similar projects

- [mdserve](https://github.com/jfernandez/mdserve) shows the markdown that an
  agent writes, live in the browser. mdlive, and then mdame, come from it. It
  has no editor. In a folder, it lists only the files at the top level, so
  `.claude/plans/` stays out. It was archived in September 2026.
- [mdlive](https://github.com/bearded-giant/mdlive), a fork of mdserve, adds an
  editor, revisions, file operations and a macOS app. When a file changes, each
  tab reloads the whole page. mdame updates only the blocks that changed, keeps
  the scroll position, and marks what changed since you last saw the file.
- [grip](https://github.com/joeyespo/grip) shows a README as GitHub will show
  it. It sends the file to GitHub's markdown API, which limits the requests per
  hour. mdame renders on your machine.
- [glow](https://github.com/charmbracelet/glow) renders markdown in the
  terminal, where a Mermaid diagram stays code.
- [Obsidian](https://obsidian.md) is a notes app built on Electron, as VS Code
  is, and it is not open source.
- [SilverBullet](https://silverbullet.md) is a notes app in the browser, on
  markdown files too, with wiki links, queries, and Lua to program it. To me it
  is a great project: comprehensive, and a good fit if you like to tinker.
  mdame aims to be simpler.

mdame does not repeat what the browser and the terminal already do. Browser
tabs are its tabs, and browser zoom sets the text size. You rename, move and
delete files in the terminal, and mdame follows. For a documentation site, use
a generator such as [mdBook](https://rust-lang.github.io/mdBook/) or
[MkDocs](https://www.mkdocs.org).

## Themes

The palette button at the right of the status bar opens View options. There,
pick the theme: System, Light, Dark, or one of yours. System follows the light
or dark mode of your OS. A theme of yours is a CSS file in
`~/.config/mdame/themes/`. [web/themes/README.md](web/themes/README.md) lists
its variables, with a template.

View options also sets the width of the text: Default (the theme's width, 60
characters in the built-in themes), Wide (80 characters) or Full (the whole
pane).

At the right of the text, an outline lists the h2 and h3 headings of the file.
View options hides it.

The editor underlines spelling mistakes, with your browser's dictionary. View
options turns this off. If your browser checks spelling online, as Chrome does
with Enhanced spell check, it sends the text that you edit to its vendor.

## Known issues

- On Linux, on a large folder, live updates start some seconds after mdame
  starts: 12 to 18 s for 15,000 folders, as measured on one machine.
- On macOS, if a program renames the file on screen, the tab does not follow
  it. Open the new name from the tree.
- On macOS, a folder deleted outside mdame stays in the tree until you reload
  the page.

## Design, tests and reviews

I made the design decisions, and Claude Code wrote most of the code. mdame was
built in 10 milestones.

### Design

Each job goes to one well-tested library: comrak renders the markdown, ammonia
sanitizes the HTML, CodeMirror edits, and Mermaid draws the diagrams. The
server owns the files, and the browser owns the presentation. When a file
changes, the page updates only what changed. A feature that needs a new
subsystem goes to a list for later. The aim is a codebase that you can read in
an afternoon.

### Tests

Each test checks one rule, and its name states that rule. Each rule has its
tests at one layer: the lowest one that sees it. The tests use the real parts,
with no mocks: real files in a temporary folder, and the real HTTP router.
Rendering has snapshot tests, and paths and URLs have property tests. From
milestone 6, at the end of each milestone, `cargo mutants` changes the code to
find the rules that no test checks. CI runs the tests on Linux and macOS. On
macOS, it skips one test of saving, which needs a Linux feature, and the test
of a folder delete, a known issue. After each release, CI installs mdame with
Homebrew, and checks that it starts.

### Reviews

Before each commit, I read its code and checked that I understood it. At the
end of each milestone, fresh Claude Code sessions reviewed the whole milestone,
in rounds. The fixes got their own commits. The loop stopped when
a round found nothing that needed a fix, after 2 to 29 rounds. From milestone
5, a manual checklist in the browser then closed each milestone.

## Credits

mdame is a rebuild of [mdlive](https://github.com/bearded-giant/mdlive), itself
a fork of Jose Fernandez's [mdserve](https://github.com/jfernandez/mdserve).
Both are MIT licensed. The icons come from [Lucide](https://lucide.dev) (ISC),
and some of them derive from [Feather](https://github.com/feathericons/feather)
(MIT). The built-in themes take their colours from GitHub's
[Primer](https://primer.style) (`@primer/primitives`, MIT). `LICENSE` carries
the notices of all of these. The fonts are IBM Plex Sans and IBM Plex Mono,
under the SIL Open Font License 1.1. The page bundles them and other npm
packages, such as CodeMirror and Mermaid:
`web/dist/assets/THIRD-PARTY-LICENSES.txt` carries their licence texts.

## License

MIT. See `LICENSE`.
