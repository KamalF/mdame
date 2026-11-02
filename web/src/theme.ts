import { api, type State } from "./api.ts";
import { icon, iconButton } from "./icons.ts";
import { load, store } from "./storage.ts";

const KEY = "mdame:theme";
const DARK = "(prefers-color-scheme: dark)";
export const BUILT_INS = ["light", "dark"] as const;
type BuiltIn = (typeof BUILT_INS)[number];

/** The stored theme if mdame knows it, or null for the system's. */
export function chosen(stored: unknown, known: readonly string[]): string | null {
  return typeof stored === "string" && known.includes(stored) ? stored : null;
}

/** The `media` of the link to the built-in `name`, when `scheme` is the
 * built-in to show. With none, the system's scheme picks it, live. */
export function media(name: BuiltIn, scheme: BuiltIn | null): string {
  if (scheme === null) return name === "dark" ? DARK : `not all and ${DARK}`;
  return name === scheme ? "all" : "not all";
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

/** Shows the stored theme. A user theme goes over the built-in of its own
 * scheme, so that it may set only the variables that it changes. */
export function apply() {
  const stored = load<unknown>(KEY, null);
  const theme = typeof stored === "string" ? stored : null;
  document.getElementById("mdame-theme-user")?.remove();
  if (theme === null || isBuiltIn(theme)) {
    showBuiltIn(theme);
    return;
  }
  const link = document.createElement("link");
  link.id = "mdame-theme-user";
  link.rel = "stylesheet";
  link.href = `/themes/${encodeURIComponent(theme)}.css`;
  link.addEventListener("load", () => {
    const dark = getComputedStyle(document.documentElement).colorScheme === "dark";
    showBuiltIn(dark ? "dark" : "light");
  });
  // Deleted since it was chosen: the system's theme.
  link.addEventListener("error", () => {
    link.remove();
    showBuiltIn(null);
  });
  document.head.append(link);
}

function choose(theme: string | null) {
  store(KEY, theme);
  apply();
}

function label(theme: string): string {
  return isBuiltIn(theme) ? theme[0].toUpperCase() + theme.slice(1) : theme;
}

/** The theme button of the status bar, with its menu. */
export function themeButton(): HTMLElement {
  const menu = document.createElement("div");
  menu.className = "mdame-menu";
  menu.popover = "auto";
  // As the menu's invoker, the button is outside its light dismiss: a click
  // on it closes the open menu rather than opening it again.
  const button = iconButton("Theme", "palette", () => {});
  button.popoverTargetElement = menu;
  let known: readonly string[] = BUILT_INS;

  function render() {
    const current = chosen(load(KEY, null), known);
    const items = [null, ...known].map((theme) => {
      const item = document.createElement("button");
      item.setAttribute("aria-pressed", String(theme === current));
      item.append(icon("check"), theme === null ? "System" : label(theme));
      item.addEventListener("click", () => {
        choose(theme);
        menu.hidePopover();
        button.focus();
      });
      return item;
    });
    menu.replaceChildren(...items);
  }

  menu.addEventListener("beforetoggle", (event) => {
    if ((event as ToggleEvent).newState !== "open") return;
    render();
    // Above the button, at its right edge: the status bar is at the bottom.
    const rect = button.getBoundingClientRect();
    menu.style.right = `${innerWidth - rect.right}px`;
    menu.style.bottom = `${innerHeight - rect.top + 4}px`;
    // The server reads the themes folder again: a new theme shows now.
    api<State>("GET", "/api/state").then(
      ({ themes }) => {
        const changed = themes.join("\n") !== known.join("\n");
        known = themes;
        if (changed && menu.matches(":popover-open")) render();
      },
      () => {},
    );
  });
  const wrapper = document.createElement("span");
  wrapper.append(button, menu);
  return wrapper;
}
