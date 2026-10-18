import { api, type State } from "./api.ts";
import { icon } from "./icons.ts";

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
  const items: Item[] = [];
  for (const recent of recents) {
    const path = tildify(recent.path, home);
    if ([recent.path, path].some((form) => form.toLowerCase().includes(needle))) {
      items.push({ path, kind: "recent" });
    }
  }
  const seen = new Set(items.map((item) => item.path));
  for (const completion of completions) {
    if (seen.has(tildify(completion.path.replace(/\/$/, ""), home))) continue;
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
  let highlight = -1;
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
    if (items[highlight]) {
      input.setAttribute("aria-activedescendant", `mdame-suggestion-${highlight}`);
      list.children[highlight].scrollIntoView({ block: "nearest" });
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }

  async function suggest() {
    const typed = input.value;
    const current = ++request;
    highlight = -1;
    render();
    let completions: Suggestion[] = [];
    if (typed.includes("/")) {
      completions = await api<Suggestion[]>("GET", `/api/complete?prefix=${encodeURIComponent(typed)}`).catch(
        () => [],
      );
    }
    // A slower answer to an older prefix must not replace a newer one.
    if (current !== request) return;
    items = merge(recents, completions, typed, state.home);
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
    error.textContent = "";
    const chosen = items[highlight];
    if (event.key === "ArrowDown" && items.length > 0) {
      highlight = (highlight + 1) % items.length;
      render();
    } else if (event.key === "ArrowUp" && items.length > 0) {
      highlight = highlight <= 0 ? items.length - 1 : highlight - 1;
      render();
    } else if (event.key === "Tab" && items.length > 0) {
      input.value = (chosen ?? items[0]).path;
      suggest();
    } else if (event.key === "Enter") {
      open(chosen ? chosen.path : input.value);
    } else if (event.key === "Escape") {
      items = [];
      highlight = -1;
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
