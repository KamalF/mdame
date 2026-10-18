import { api, type State } from "./api.ts";

/** An entry of `/api/recents`. */
export interface Recent {
  path: string;
  last_opened_secs: number;
}

/** An entry of `/api/complete`. */
export interface Suggestion {
  path: string;
  dir: boolean;
}

interface Item {
  path: string;
  kind: string;
}

const ICONS: Record<string, string> = {
  folder:
    '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
  recent:
    '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
};

function icon(name: string) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [key, value] of Object.entries({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.75",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
    class: "mdame-icon",
  })) {
    svg.setAttribute(key, value);
  }
  svg.innerHTML = ICONS[name];
  return svg;
}

/** `/home/me/notes` becomes `~/notes` when `home` is `/home/me`. */
export function tildify(path: string, home: string | null): string {
  if (!home) return path;
  if (path === home) return "~";
  if (path.startsWith(home + "/")) return "~" + path.slice(home.length);
  return path;
}

/**
 * Recents that contain the typed text come first, then the completions,
 * without a path twice.
 */
export function merge(
  recents: Recent[],
  completions: Suggestion[],
  typed: string,
  home: string | null,
): Item[] {
  const needle = typed.toLowerCase();
  const items = recents
    .map((recent) => ({ path: tildify(recent.path, home), kind: "recent" }))
    .filter((item) => item.path.toLowerCase().includes(needle));
  const seen = new Set(items.map((item) => item.path));
  for (const completion of completions) {
    if (seen.has(completion.path.replace(/\/$/, ""))) continue;
    items.push({ path: completion.path, kind: completion.dir ? "folder" : "file" });
  }
  return items;
}

let teardown: (() => void) | null = null;

export function mount(
  el: HTMLElement,
  { state, onOpen }: { state: State; onOpen: (state: State) => void },
) {
  el.replaceChildren();
  const box = document.createElement("div");
  box.className = "mdame-picker";

  const title = document.createElement("h1");
  title.textContent = "mdame";

  const field = document.createElement("div");
  field.className = "mdame-picker-field";
  const label = document.createElement("label");
  label.htmlFor = "mdame-path";
  label.append(icon("folder"));
  const input = document.createElement("input");
  input.id = "mdame-path";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", "Folder or file to open");
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-controls", "mdame-suggestions");
  input.setAttribute("aria-autocomplete", "list");
  label.append(input);
  const list = document.createElement("ul");
  list.id = "mdame-suggestions";
  list.setAttribute("role", "listbox");
  field.append(label, list);

  const error = document.createElement("p");
  error.className = "mdame-picker-error";
  error.setAttribute("role", "alert");

  const hint = document.createElement("p");
  hint.className = "mdame-picker-hint";
  hint.textContent = "Enter opens · Tab completes · ↑↓ choose";

  box.append(title, field, error, hint);
  el.append(box);

  let recents: Recent[] = [];
  let items: Item[] = [];
  let highlight = 0;
  let request = 0;

  function render() {
    list.replaceChildren(
      ...items.map((item, index) => {
        const option = document.createElement("li");
        option.id = `mdame-suggestion-${index}`;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", String(index === highlight));
        const path = document.createElement("span");
        path.className = "mdame-picker-path";
        // textContent, never innerHTML: file names can hold markup.
        path.textContent = item.path;
        option.append(icon(item.kind), path);
        if (item.kind === "recent") {
          const tag = document.createElement("span");
          tag.className = "mdame-picker-tag";
          tag.textContent = "recent";
          option.append(tag);
        }
        option.addEventListener("mousedown", (event) => {
          event.preventDefault();
          open(item.path);
        });
        return option;
      }),
    );
    input.setAttribute("aria-expanded", String(items.length > 0));
    if (items.length > 0) {
      input.setAttribute("aria-activedescendant", `mdame-suggestion-${highlight}`);
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }

  async function suggest() {
    const typed = input.value;
    const current = ++request;
    let completions: Suggestion[] = [];
    if (typed.includes("/")) {
      completions = await api<Suggestion[]>("GET", `/api/complete?prefix=${encodeURIComponent(typed)}`).catch(
        () => [],
      );
    }
    // A slower answer to an older prefix must not replace a newer one.
    if (current !== request) return;
    items = merge(recents, completions, typed, state.home);
    highlight = 0;
    render();
  }

  async function open(path: string) {
    try {
      onOpen(await api<State>("POST", "/api/workspace", { path }));
    } catch (failure) {
      error.textContent = (failure as Error).message;
    }
  }

  input.addEventListener("input", () => {
    error.textContent = "";
    suggest();
  });

  input.addEventListener("keydown", (event) => {
    const chosen = items[highlight];
    if (event.key === "ArrowDown" && items.length > 0) {
      highlight = (highlight + 1) % items.length;
      render();
    } else if (event.key === "ArrowUp" && items.length > 0) {
      highlight = (highlight - 1 + items.length) % items.length;
      render();
    } else if (event.key === "Tab" && chosen) {
      input.value = chosen.path;
      suggest();
    } else if (event.key === "Enter") {
      open(chosen ? chosen.path : input.value);
    } else if (event.key === "Escape") {
      items = [];
      render();
    } else {
      return;
    }
    event.preventDefault();
  });

  api<Recent[]>("GET", "/api/recents")
    .then((loaded) => {
      recents = loaded;
      suggest();
    })
    .catch(() => {});
  input.focus();

  teardown = () => {
    request++;
  };
}

export function unmount() {
  teardown?.();
  teardown = null;
}
