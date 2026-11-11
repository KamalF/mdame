import { load } from "./storage.ts";

// The links of the theme stylesheets: one for each built-in, Light and
// Dark, and one for another theme.

export const KEY = "mdame:theme";
const DARK = "(prefers-color-scheme: dark)";
export const BUILT_INS = ["light", "dark"] as const;
type BuiltIn = (typeof BUILT_INS)[number];
const USER = "mdame-theme-user";

/** The `media` of the link to the built-in `name`, when `scheme` is the
 * built-in to show. With none, the system's scheme picks it, live. */
export function media(name: BuiltIn, scheme: BuiltIn | null): string {
  if (scheme === null) return name === "dark" ? DARK : `not all and ${DARK}`;
  return name === scheme ? "all" : "not all";
}

/** Whether the theme on screen is dark. */
export function isDark(): boolean {
  return getComputedStyle(document.documentElement).colorScheme === "dark";
}

function isBuiltIn(theme: string): theme is BuiltIn {
  return (BUILT_INS as readonly string[]).includes(theme);
}

function showBuiltIn(scheme: BuiltIn | null) {
  for (const name of BUILT_INS) {
    const link = document.getElementById(`mdame-theme-${name}`) as HTMLLinkElement;
    link.media = media(name, scheme);
  }
}

/** Shows the stored theme. Another theme goes over the built-in of its own
 * scheme, so that it may set only the variables that it changes. `boot`:
 * from `boot.ts`, which writes the links before the first paint. */
export function apply(boot = false) {
  const stored = load<unknown>(KEY, null);
  const theme = typeof stored === "string" ? stored : null;
  // Until another theme loads, the system's scheme picks the built-in.
  const scheme = theme !== null && isBuiltIn(theme) ? theme : null;
  // Paper takes the built-in light theme.
  const user =
    theme === null || scheme !== null
      ? ""
      : `<link id="${USER}" rel="stylesheet" media="screen" href="/themes/${encodeURIComponent(theme)}.css">`;
  // Before it paints, the browser waits for a link that the parser
  // inserts, if its media matches then. A link that a script appends, or
  // whose media changes later, does not hold the paint.
  if (boot) {
    const link = (name: BuiltIn) =>
      `<link id="mdame-theme-${name}" rel="stylesheet" href="/themes/${name}.css" media="${media(name, scheme)}">`;
    document.write(BUILT_INS.map(link).join("") + user);
  } else {
    document.getElementById(USER)?.remove();
    // Another theme sets the built-ins once it loads. Until then, they keep
    // showing the previous theme, not the system's scheme.
    if (user === "") showBuiltIn(scheme);
    document.head.insertAdjacentHTML("beforeend", user);
  }
  const link = document.getElementById(USER) as HTMLLinkElement | null;
  if (!link) return;
  link.addEventListener("load", () => {
    showBuiltIn(isDark() ? "dark" : "light");
  });
  // Deleted since it was chosen: the system's theme.
  link.addEventListener("error", () => {
    link.remove();
    showBuiltIn(null);
  });
}
