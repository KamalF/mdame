import { api } from "./api.ts";
import type { Block } from "./changes.ts";

/** What `/api/search` answers. */
interface Results {
  files: FileMatches[];
  /** More files match than `files` holds. */
  more: boolean;
}

interface FileMatches {
  path: string;
  modified: number;
  lines: Line[];
  /** The file has more matches than `lines` holds. */
  more: boolean;
}

export interface Line {
  number: number;
  text: string;
  matched: boolean;
}

/**
 * `text` cut into parts, each marked when it matches `phrase`. As on the
 * server, the case counts only if `phrase` has an uppercase letter.
 */
export function highlight(text: string, phrase: string): { text: string; match: boolean }[] {
  const flags = /\p{Uppercase}/u.test(phrase) ? "gu" : "giu";
  const pattern = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);
  const parts: { text: string; match: boolean }[] = [];
  let last = 0;
  for (const found of text.matchAll(pattern)) {
    if (found.index > last) parts.push({ text: text.slice(last, found.index), match: false });
    parts.push({ text: found[0], match: true });
    last = found.index + found[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), match: false });
  return parts;
}

/** The lines cut where their numbers jump: the preview shows a break there. */
export function runs<T extends { number: number }>(lines: readonly T[]): T[][] {
  const result: T[][] = [];
  for (const line of lines) {
    const run = result[result.length - 1];
    if (run && run[run.length - 1].number + 1 === line.number) run.push(line);
    else result.push([line]);
  }
  return result;
}

/**
 * The block to scroll to for source line `line`: the innermost block that
 * holds it, else the innermost block that ends nearest above it, or -1.
 * Blocks nest, so the last one in document order is the innermost.
 */
export function blockAt(blocks: readonly Block[], line: number): number {
  const holder = blocks.findLastIndex((block) => block.start <= line && line <= block.end);
  if (holder !== -1) return holder;
  let above = -1;
  blocks.forEach((block, index) => {
    if (block.end < line && (above === -1 || block.end >= blocks[above].end)) above = index;
  });
  return above;
}

/**
 * Opens the search panel. `onOpen` gets the file and the line that the
 * user picked.
 */
export function openSearch(onOpen: (path: string, line: number) => void) {
  const dialog = document.createElement("dialog");
  dialog.className = "mdame-dialog mdame-search";
  dialog.setAttribute("aria-label", "Search in files");
  const field = document.createElement("input");
  field.type = "search";
  field.placeholder = "Search in files";
  field.setAttribute("aria-label", "Search in files");
  field.autocomplete = "off";
  field.spellcheck = false;
  const status = document.createElement("p");
  status.className = "mdame-search-status";
  status.setAttribute("role", "status");
  const list = document.createElement("ul");
  list.className = "mdame-search-files";
  list.setAttribute("aria-label", "Matching files");
  const preview = document.createElement("div");
  preview.className = "mdame-search-preview";
  const body = document.createElement("div");
  body.className = "mdame-search-body";
  body.append(list, preview);
  dialog.append(field, status, body);
  document.body.append(dialog);

  let phrase = "";
  let files: FileMatches[] = [];
  let chosen = 0;
  let inFlight: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function open(path: string, line: number) {
    dialog.close();
    onOpen(path, line);
  }

  function choose(index: number) {
    chosen = index;
    for (const [at, item] of [...list.children].entries()) {
      item.querySelector("button")!.setAttribute("aria-current", String(at === chosen));
    }
    list.children[chosen]?.scrollIntoView({ block: "nearest" });
    showPreview();
  }

  function showPreview() {
    const file = files[chosen];
    if (!file) {
      preview.replaceChildren();
      return;
    }
    preview.replaceChildren(
      ...runs(file.lines).map((run) => {
        const block = document.createElement("div");
        block.className = "mdame-search-run";
        block.append(...run.map((line) => lineButton(file.path, line)));
        return block;
      }),
    );
    preview.scrollTop = 0;
  }

  function lineButton(path: string, line: Line): HTMLButtonElement {
    const button = document.createElement("button");
    button.className = "mdame-search-line";
    button.classList.toggle("is-match", line.matched);
    const number = document.createElement("span");
    number.className = "mdame-search-number";
    number.textContent = String(line.number);
    const text = document.createElement("span");
    text.className = "mdame-search-text";
    const parts = line.matched ? highlight(line.text, phrase) : [{ text: line.text, match: false }];
    for (const part of parts) {
      if (!part.match) {
        text.append(part.text);
        continue;
      }
      const mark = document.createElement("mark");
      mark.textContent = part.text;
      text.append(mark);
    }
    button.append(number, text);
    button.addEventListener("click", () => open(path, line.number));
    return button;
  }

  function show(results: Results) {
    files = results.files;
    const count = files.length;
    status.textContent =
      count === 0
        ? "No file holds this text."
        : `${count}${results.more ? "+" : ""} ${count === 1 ? "file" : "files"}`;
    list.replaceChildren(
      ...files.map((file, index) => {
        const matches = file.lines.filter((line) => line.matched).length;
        const button = document.createElement("button");
        const path = document.createElement("span");
        path.className = "mdame-search-path";
        path.textContent = file.path;
        const number = document.createElement("span");
        number.className = "mdame-search-count";
        number.textContent = `${matches}${file.more ? "+" : ""}`;
        button.append(path, number);
        button.addEventListener("click", () => {
          choose(index);
          // ↑↓ and Enter work in the field.
          field.focus();
        });
        const item = document.createElement("li");
        item.append(button);
        return item;
      }),
    );
    choose(0);
  }

  async function search() {
    inFlight?.abort();
    inFlight = null;
    phrase = field.value;
    if (phrase.length < 3) {
      files = [];
      list.replaceChildren();
      preview.replaceChildren();
      status.textContent = phrase ? "Type 3 characters or more." : "";
      return;
    }
    const controller = new AbortController();
    inFlight = controller;
    try {
      const url = `/api/search?q=${encodeURIComponent(phrase)}`;
      const results = await api<Results>("GET", url, undefined, controller.signal);
      if (inFlight === controller) show(results);
    } catch (error) {
      if (inFlight === controller) status.textContent = (error as Error).message;
    }
  }

  field.addEventListener("input", () => {
    clearTimeout(timer);
    // The server does not stop a search that the page aborts: only a pause
    // in typing starts one.
    timer = setTimeout(search, 150);
  });
  field.addEventListener("keydown", (event) => {
    // Enter, Esc and the arrows belong to the input method while it composes.
    if (event.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      if (files.length > 0) choose((chosen + step + files.length) % files.length);
    } else if (event.key === "Escape") {
      // In Chrome, Esc in a search field first clears it.
      event.preventDefault();
      dialog.close();
    } else if (event.key === "Enter" && files[chosen]) {
      event.preventDefault();
      const first = files[chosen].lines.find((line) => line.matched);
      open(files[chosen].path, first?.number ?? 1);
    }
  });
  dialog.addEventListener("close", () => {
    clearTimeout(timer);
    inFlight?.abort();
    dialog.remove();
  });
  dialog.showModal();
  field.focus();
}
