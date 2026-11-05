import { api, type State } from "./api.ts";
import { icon, iconButton } from "./icons.ts";
import { load, store } from "./storage.ts";
import { chooseWidth, currentWidth, WIDTHS } from "./width.ts";

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
    showBuiltIn(isDark() ? "dark" : "light");
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

/** The View options button of the status bar: its menu holds the theme,
 * with the user `themes`, and the content width. */
export function themeButton(themes: readonly string[]): HTMLElement {
  const menu = document.createElement("div");
  menu.className = "mdame-menu";
  menu.popover = "auto";
  // As the menu's invoker, the button is outside its light dismiss: a click
  // on it closes the open menu rather than opening it again.
  const button = iconButton("View options", "palette", () => {});
  button.popoverTargetElement = menu;
  let known = themes;

  function item(text: string, pressed: boolean, onChoose: () => void) {
    const element = document.createElement("button");
    element.setAttribute("aria-pressed", String(pressed));
    element.append(icon("check"), text);
    element.addEventListener("click", () => {
      onChoose();
      menu.hidePopover();
      button.focus();
    });
    return element;
  }

  function heading(text: string) {
    const element = document.createElement("div");
    element.className = "mdame-menu-label";
    element.textContent = text;
    return element;
  }

  function render() {
    const current = chosen(load(KEY, null), known);
    const width = currentWidth();
    menu.replaceChildren(
      heading("Theme"),
      ...[null, ...known].map((theme) =>
        item(theme === null ? "System" : label(theme), theme === current, () => choose(theme)),
      ),
      heading("Width"),
      ...WIDTHS.map((choice) =>
        item(choice[0].toUpperCase() + choice.slice(1), choice === width, () =>
          chooseWidth(choice),
        ),
      ),
    );
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
        // Deleted since it was chosen: the page follows the menu, which
        // marks System.
        const stored = load<unknown>(KEY, null);
        if (stored !== null && chosen(stored, themes) === null) choose(null);
        if (changed && menu.matches(":popover-open")) render();
      },
      () => {},
    );
  });
  const wrapper = document.createElement("span");
  wrapper.append(button, menu);
  return wrapper;
}
