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

/** The `media` of the link to the built-in `name`. With no theme chosen,
 * the system's scheme picks the built-in, and the page follows it live. */
export function media(name: BuiltIn, theme: string | null): string {
  if (theme === null) return name === "dark" ? DARK : `not all and ${DARK}`;
  return name === theme ? "all" : "not all";
}

/** Shows the stored theme. */
export function apply() {
  const theme = chosen(load(KEY, null), BUILT_INS);
  for (const name of BUILT_INS) {
    const link = document.getElementById(`mdame-theme-${name}`) as HTMLLinkElement;
    link.media = media(name, theme);
  }
}

function choose(theme: string | null) {
  store(KEY, theme);
  apply();
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
  menu.addEventListener("beforetoggle", (event) => {
    if ((event as ToggleEvent).newState !== "open") return;
    const current = chosen(load(KEY, null), BUILT_INS);
    const items = [null, ...BUILT_INS].map((theme) => {
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
    // Above the button, at its right edge: the status bar is at the bottom.
    const rect = button.getBoundingClientRect();
    menu.style.right = `${innerWidth - rect.right}px`;
    menu.style.bottom = `${innerHeight - rect.top + 4}px`;
  });
  const wrapper = document.createElement("span");
  wrapper.append(button, menu);
  return wrapper;
}

function label(theme: string): string {
  return theme[0].toUpperCase() + theme.slice(1);
}
