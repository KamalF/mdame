# mdame

A local markdown viewer and editor, served to your browser by one Rust binary.

mdame is early work. Version 0.0.1 holds the name on crates.io, and the first
real release is 0.1.0. Its tests run on Linux and macOS, but it has been used
on Linux only.

## Install

```sh
cargo install mdame
```

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
  plans of a coding agent in `.claude/plans/`. `.git` and `.mdame` stay out.
- When a file changes on disk, a bar at the left marks each block that changed
  since you last saw the file. The status bar lists the other markdown files
  that changed, and a click opens one.
- `s` searches the contents of the files.
- It edits files in the browser, with CodeMirror.
- It keeps revisions of each file that it saves (the last 20 by default), and
  restores them. Its diff mode also shows the version that you last saw, and
  restores it.

Files that `.gitignore` hides stay out of the tree and the search. To hide
more, such as the git worktrees that an agent keeps in `.claude/worktrees/`,
list them in a `.ignore` file at the root of the folder, or in
`.git/info/exclude`. Both use the syntax of `.gitignore`.

For the keyboard shortcuts, press `?` or click the keyboard button in the status bar.

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
options turns this off.

## Credits

mdame is a rebuild of [mdlive](https://github.com/bearded-giant/mdlive), itself
a fork of Jose Fernandez's [mdserve](https://github.com/jfernandez/mdserve).
Both are MIT licensed. The icons come from [Lucide](https://lucide.dev) (ISC),
and some of them derive from [Feather](https://github.com/feathericons/feather)
(MIT). `LICENSE` carries their notices. The built-in themes take their colours
from GitHub's [Primer](https://primer.style) (`@primer/primitives`, MIT). The
fonts are IBM Plex Sans and IBM Plex Mono, under the SIL Open Font License 1.1.
The page bundles them and other npm packages, such as CodeMirror and Mermaid:
`web/dist/assets/THIRD-PARTY-LICENSES.txt` carries their licence texts.

## License

MIT. See `LICENSE`.
