# mdame

A local markdown viewer and editor, served to your browser by one Rust binary.

mdame is early work. Version 0.0.1 holds the name on crates.io, and the first
real release is 0.1.0. It is tested on Linux only.

## Install

```sh
cargo install mdame
```

## Usage

```sh
mdame [PATH]
```

mdame opens the folder or file at `PATH` in your browser. Without `PATH`, it
starts at a folder picker. By default, it listens on 127.0.0.1. `mdame --help`
lists the options.

- It renders GitHub-flavoured markdown, with alerts, footnotes and Mermaid
  diagrams, and updates the page when a file changes on disk.
- It edits files in the browser, with CodeMirror.
- It keeps revisions of each file that it saves (the last 20 by default), and
  restores them.

## Credits

mdame is a rebuild of [mdlive](https://github.com/bearded-giant/mdlive), itself
a fork of Jose Fernandez's [mdserve](https://github.com/jfernandez/mdserve).
Both are MIT licensed. The icons come from [Lucide](https://lucide.dev) (ISC),
and some of them derive from [Feather](https://github.com/feathericons/feather)
(MIT). `LICENSE` carries their notices. The page also bundles npm packages,
such as CodeMirror and Mermaid: `web/dist/THIRD-PARTY-LICENSES.txt` carries
their licence texts.

## License

MIT. See `LICENSE`.
