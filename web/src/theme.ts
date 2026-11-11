import { api, type State } from "./api.ts";
import { statusMenu } from "./dialogs.ts";
import { chooseFont, currentFont, FONTS } from "./font.ts";
import { icon, iconButton } from "./icons.ts";
import { chooseOutline, layoutOutline, outlineOn } from "./outline.ts";
import { chooseSpellcheck, spellcheckOn } from "./spellcheck.ts";
import { load, store } from "./storage.ts";
import { apply, KEY } from "./stylesheets.ts";
import { chooseWidth, currentWidth, WIDTHS } from "./width.ts";

/** The stored theme if mdame knows it, or null for the system's. */
export function chosen(stored: unknown, known: readonly string[]): string | null {
  return typeof stored === "string" && known.includes(stored) ? stored : null;
}

function choose(theme: string | null) {
  store(KEY, theme);
  apply();
}

function capitalize(word: string): string {
  return word[0].toUpperCase() + word.slice(1);
}

/** The menu names of the built-in themes, whose files are in `web/themes`.
 * A user theme shows its file name. */
const LABELS: Record<string, string> = {
  light: "Light",
  dark: "Dark",
  "catppuccin-latte": "Catppuccin Latte",
  "catppuccin-frappe": "Catppuccin Frappé",
  "catppuccin-macchiato": "Catppuccin Macchiato",
  "catppuccin-mocha": "Catppuccin Mocha",
  "minimal-light": "Minimal Light",
  "minimal-dark": "Minimal Dark",
};

export function label(theme: string): string {
  // A user theme may be named `constructor`.
  return Object.hasOwn(LABELS, theme) ? LABELS[theme] : theme;
}

/** The View options button of the status bar: its menu holds the theme,
 * with the user `themes`, the font and the width of the content, the
 * outline and the spellcheck. */
export function themeButton(themes: readonly string[]): HTMLElement {
  // As the menu's invoker, the button is outside its light dismiss: a click
  // on it closes the open menu rather than opening it again.
  const button = iconButton("View options", "palette", () => {});
  const menu = statusMenu(button, () => {
    render();
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
    const font = currentFont();
    const width = currentWidth();
    menu.replaceChildren(
      heading("Theme"),
      ...[null, ...known].map((theme) =>
        item(theme === null ? "System" : label(theme), theme === current, () => choose(theme)),
      ),
      heading("Font"),
      ...FONTS.map((choice) => item(capitalize(choice), choice === font, () => chooseFont(choice))),
      heading("Width"),
      ...WIDTHS.map((choice) =>
        item(capitalize(choice), choice === width, () => {
          chooseWidth(choice);
          // From Full, the outline's margin keeps the article's width, so
          // its observer sees no change.
          layoutOutline();
        }),
      ),
      heading("Show"),
      item("Outline", outlineOn(), () => chooseOutline(!outlineOn())),
      item("Spellcheck", spellcheckOn(), () => chooseSpellcheck(!spellcheckOn())),
    );
  }

  const wrapper = document.createElement("span");
  wrapper.append(button, menu);
  return wrapper;
}
