# mdame themes

A theme is one CSS file that sets the variables below on `:root`, and nothing
else.

## Add a theme

Put the file in `~/.config/mdame/themes/`, or in `$XDG_CONFIG_HOME/mdame/themes/`
if you set that variable. The palette button at the right of the status bar
opens View options, whose Theme section lists the file by its name without
`.css`. The menu reads the folder each time it opens, so a new theme shows
without a restart. A
symbolic link counts too, so a dotfile manager can keep the file elsewhere.

Use only themes that you trust. A theme can load images from the web. Through
them, its author can learn when you use mdame, the names of your files, and the
headings and links of the open file.

Each browser keeps its own choice for each port: a second mdame, on the next
port, starts from System.

## How a theme loads

Set `color-scheme` to `light` or `dark`. mdame loads its built-in theme of that
scheme first, then your file over it. So your file needs only the variables that
it changes. `color-scheme` also picks the theme of Mermaid diagrams, and the
browser draws scrollbars and form controls to match.

A file named `light.css` or `dark.css` replaces that built-in theme, with nothing
under it, so it must set every variable. Start from a copy of `light.css` or
`dark.css` in this folder. A file with the name of another built-in theme, such
as `catppuccin-mocha.css`, replaces that theme over `light` or `dark`.

A theme sets no diff, change bar, hover or focus colours. The diff of revisions
mixes `--success` and `--danger` into the background, and a hovered or focused
row mixes in `--fg`. The change bars use `--success` for an added block,
`--accent` for a changed one and `--danger` where text was removed. Shadows and
backdrops stay translucent black.

## Template

The comment on each line says where the variable shows. The values are those
of the built-in dark theme, and of the fonts that mdame bundles. Delete the
lines that you do not change.

```css
:root {
  /* light or dark: the built-in theme under this file */
  color-scheme: dark;

  /* Surfaces and text */
  --bg: #0d1117; /* the page */
  --bg-raised: #010409; /* dialogs, menus, tooltips, the filter field */
  --bg-sunken: #010409; /* sidebar, status bar, gutters, table headers */
  --fg: #f0f6fc; /* text */
  --fg-muted: #9198a1; /* secondary text, line numbers */
  --border: #3d444d; /* lines between regions, borders of fields */
  --selection: #1f6febb3; /* selected text, the current file */

  /* Meaning */
  --accent: #4493f8; /* links, focus, main buttons, changed blocks, the outline */
  --accent-fg: #010409; /* text on a button of --accent colour */
  --danger: #f85149; /* errors, removed lines and text, caution alerts */
  --warning: #d29922; /* warning alerts, search matches */
  --success: #3fb950; /* added lines and blocks */

  /* Type */
  --font-ui: "IBM Plex Sans Variable", system-ui, sans-serif; /* the interface */
  --font-content: var(--font-ui); /* rendered files */
  --font-mono: "IBM Plex Mono", ui-monospace, monospace; /* code */
  --content-width: 60ch; /* the column of rendered files, with Width: Default */
  --content-width-mono: 72ch; /* the same, with Font: Mono */

  /* Code, in the editor and in rendered files */
  --code-bg: #151b23; /* code blocks and inline code */
  --hl-keyword: #ff7b72; /* keywords, operators */
  --hl-string: #a5d6ff; /* strings, URLs */
  --hl-number: #79c0ff; /* numbers, booleans */
  --hl-comment: #9198a1; /* comments */
  --hl-title: #d2a8ff; /* headings, class names, definitions */
  --hl-type: #ffa657; /* type names, namespaces */
  --hl-attr: #7ee787; /* properties, labels */
  --hl-meta: #ffa657; /* meta tags, macros */
}
```
