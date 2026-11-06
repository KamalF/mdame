import { modal } from "./dialogs.ts";

const REPOSITORY = "https://github.com/KamalF/mdame";

/** Keys in CodeMirror's notation: "Mod-s" is ⌘S on macOS and Ctrl+S
 * elsewhere. */
interface Shortcut {
  keys: string[];
  action: string;
}

export const HELP: { group: string; shortcuts: Shortcut[] }[] = [
  {
    group: "Anywhere",
    shortcuts: [
      { keys: ["e"], action: "Edit the file" },
      { keys: ["h", "r"], action: "Compare with a revision" },
      { keys: ["s"], action: "Search the contents of the files" },
      { keys: ["/"], action: "Filter the files by name" },
      { keys: ["b"], action: "Hide or show the sidebar" },
      { keys: ["?"], action: "Show this help" },
      { keys: ["Escape"], action: "Close a dialog, a panel or the editor" },
    ],
  },
  {
    group: "Editor",
    shortcuts: [
      { keys: ["Mod-s"], action: "Save" },
      { keys: ["Mod-b"], action: "Bold" },
      { keys: ["Mod-i"], action: "Italic" },
      { keys: ["Tab", "Shift-Tab"], action: "Indent, or indent less" },
    ],
  },
  {
    group: "Filter and search",
    shortcuts: [
      { keys: ["ArrowUp", "ArrowDown"], action: "Choose a result" },
      { keys: ["Enter"], action: "Open the result" },
      { keys: ["Escape"], action: "Clear the filter, or close the search" },
    ],
  },
];

const NAMES: Record<string, string> = { ArrowUp: "↑", ArrowDown: "↓", Escape: "Esc" };

/** How `key` shows in the help: ⌘ and ⇧ on macOS, Ctrl and Shift
 * elsewhere. */
export function keyLabel(key: string, mac: boolean): string {
  const [name, ...modifiers] = key.split("-").reverse();
  if (modifiers.length === 0) return NAMES[name] ?? name;
  const symbols: Record<string, string> = mac
    ? { Mod: "⌘", Shift: "⇧" }
    : { Mod: "Ctrl", Shift: "Shift" };
  // A letter shows in upper case, as on the key.
  const shown = name.length === 1 ? name.toUpperCase() : name;
  return [...modifiers.reverse().map((modifier) => symbols[modifier]), shown].join(mac ? "" : "+");
}

/** Opens the shortcut help, with `version` in its footer. */
export function openHelp(version: string) {
  const mac = /Mac/.test(navigator.platform);
  const body: Node[] = [];
  for (const { group, shortcuts } of HELP) {
    const title = document.createElement("h3");
    title.textContent = group;
    const list = document.createElement("dl");
    for (const { keys, action } of shortcuts) {
      const term = document.createElement("dt");
      for (const key of keys) {
        const kbd = document.createElement("kbd");
        kbd.textContent = keyLabel(key, mac);
        term.append(kbd);
      }
      const description = document.createElement("dd");
      description.textContent = action;
      list.append(term, description);
    }
    body.push(title, list);
  }
  const note = document.createElement("p");
  note.className = "mdame-dialog-note";
  const [find, undo] = [keyLabel("Mod-f", mac), keyLabel("Mod-z", mac)];
  note.textContent =
    "The editor also keeps the keys of CodeMirror, such as " +
    `${find} to find and ${undo} to undo.`;
  const footer = document.createElement("p");
  footer.className = "mdame-help-footer";
  footer.append(
    `mdame ${version} · `,
    link("Repository", REPOSITORY),
    " · ",
    link("Licences", "/assets/THIRD-PARTY-LICENSES.txt"),
  );
  const close = document.createElement("button");
  close.textContent = "Close";
  const dialog = modal("mdame-help-title", "Keyboard shortcuts", [...body, note, footer], [close]);
  dialog.classList.add("mdame-help");
  close.focus();
  dialog.addEventListener("close", () => dialog.remove());
}

function link(text: string, href: string): HTMLAnchorElement {
  const element = document.createElement("a");
  element.href = href;
  element.target = "_blank";
  element.rel = "noopener";
  element.textContent = text;
  return element;
}
