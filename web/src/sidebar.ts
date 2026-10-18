import uFuzzy from "@leeoniya/ufuzzy";
import { api } from "./api.ts";
import { fileIcon, icon } from "./icons.ts";

/** A node of `/api/tree`. `modified` is in Unix seconds; for a folder, its newest file. */
export interface TreeNode {
  name: string;
  /** Relative to the workspace root, with `/` between parts. */
  path: string;
  kind: "dir" | "file";
  modified: number;
  children?: TreeNode[];
}

export interface Part {
  text: string;
  matched: boolean;
}

export interface Match {
  file: TreeNode;
  parts: Part[];
}

export const SORTS = ["name-asc", "name-desc", "date-desc", "date-asc"];

const SORT_LABELS: Record<string, string> = {
  "name-asc": "name, A to Z",
  "name-desc": "name, Z to A",
  "date-desc": "newest first",
  "date-asc": "oldest first",
};

export function nextSort(order: string): string {
  return SORTS[(SORTS.indexOf(order) + 1) % SORTS.length];
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function byName(a: TreeNode, b: TreeNode) {
  return collator.compare(a.name, b.name);
}

const COMPARE: Record<string, (a: TreeNode, b: TreeNode) => number> = {
  "name-asc": byName,
  "name-desc": (a, b) => byName(b, a),
  "date-desc": (a, b) => b.modified - a.modified || byName(a, b),
  "date-asc": (a, b) => a.modified - b.modified || byName(a, b),
};

/** A copy of the tree with each folder's children in `order`, folders first. */
export function sortTree(node: TreeNode, order: string): TreeNode {
  const compare = COMPARE[order];
  const children = (node.children ?? []).map((child) => sortTree(child, order));
  children.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
    return compare(a, b);
  });
  return { ...node, children };
}

export function files(node: TreeNode): TreeNode[] {
  return node.kind === "file" ? [node] : (node.children ?? []).flatMap(files);
}

/** `docs/api/a.md` gives `["docs", "docs/api"]`: the folders to open. */
export function ancestors(path: string): string[] {
  const parts = path.split("/").slice(0, -1);
  return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
}

// By default uFuzzy allows no letters between matched ones, and treats
// `.`, `-` and `_` as breaks: "mto" would not find "mise.toml". Its
// default classes are ASCII only; `\p{L}` lets "rsm" find "résumé.md".
const fuzzy = new uFuzzy({
  unicode: true,
  interSplit: "[^\\p{L}\\d']+",
  intraSplit: "\\p{Ll}\\p{Lu}",
  intraBound: "\\p{L}\\d|\\d\\p{L}|\\p{Ll}\\p{Lu}",
  intraContr: "'\\p{L}{1,2}\\b",
  intraIns: Infinity,
  intraChars: "[\\p{L}\\d'._ -]",
});

/**
 * Files whose name matches `query`, best first, accents ignored. `parts`
 * splits the name into matched and unmatched pieces, for bold letters.
 */
export function filterFiles(list: TreeNode[], query: string): Match[] {
  // NFC first: latinize knows only precomposed letters, and a name saved on
  // macOS can hold "e" plus a combining accent. latinize then changes one
  // letter for one letter, so the ranges still fit the NFC names.
  const names = list.map((file) => file.name.normalize("NFC"));
  const [indexes, info, order] = fuzzy.search(
    uFuzzy.latinize(names),
    uFuzzy.latinize(query.normalize("NFC")),
  );
  if (!indexes) return [];
  // uFuzzy skips ranking when too many names match.
  if (!info) return indexes.map((index) => ({ file: list[index], parts: [plain(names[index])] }));
  return order.map((rank) => {
    const index = info.idx[rank];
    const parts = uFuzzy.highlight<Part[], Part>(
      names[index],
      info.ranges[rank],
      (text, matched) => ({ text, matched }),
      [],
      (all, part) => [...all, part],
    );
    return { file: list[index], parts: parts.filter((part) => part.text) };
  });
}

function plain(name: string): Part {
  return { text: name, matched: false };
}

/** `docs/a b.md` gives `/view/docs/a%20b.md`: each part is encoded, not the slashes. */
export function viewUrl(path: string): string {
  return "/view/" + path.split("/").map(encodeURIComponent).join("/");
}

export function pathFromUrl(pathname: string): string | null {
  if (!pathname.startsWith("/view/")) return null;
  try {
    return decodeURIComponent(pathname.slice(6));
  } catch {
    return null;
  }
}

// Storage can be missing or full (private windows, blocked site data); the
// sidebar then works without memory.
function load<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

let select: (path: string | null) => void = () => {};
let focusField = () => {};

/** Highlights `path` as the current file. */
export function setCurrent(path: string | null) {
  select(path);
}

interface MountOptions {
  root: string;
  current: string | null;
  onOpen: (path: string) => void;
}

export async function mount(el: HTMLElement, { root, current, onOpen }: MountOptions) {
  const openKey = `mdame:open:${root}`;
  const open = new Set([...load(openKey, []), ...ancestors(current ?? "")]);
  let order = load("mdame:sort", "name-asc");
  if (!SORTS.includes(order)) order = "name-asc";

  const filter = document.createElement("input");
  filter.placeholder = "Filter  /";
  filter.setAttribute("aria-label", "Filter files");
  filter.autocomplete = "off";
  filter.spellcheck = false;
  const filterField = document.createElement("label");
  filterField.className = "mdame-filter";
  filterField.append(icon("search"), filter);
  const sortButton = document.createElement("button");
  sortButton.className = "mdame-icon-button";
  const header = document.createElement("div");
  header.className = "mdame-sidebar-header";
  header.append(filterField, sortButton);
  const list = document.createElement("ul");
  list.className = "mdame-tree";
  el.replaceChildren(header, list);

  const fetched = await api<TreeNode>("GET", "/api/tree");
  const allFiles = files(fetched);
  let tree = sortTree(fetched, order);
  let results: Match[] = [];
  let highlight = -1;

  function showSort() {
    const label = `Sort: ${SORT_LABELS[order]}`;
    sortButton.setAttribute("aria-label", label);
    sortButton.title = label;
    // The icons are named after the orders.
    sortButton.replaceChildren(icon(order));
  }

  sortButton.addEventListener("click", () => {
    order = nextSort(order);
    store("mdame:sort", order);
    tree = sortTree(fetched, order);
    showSort();
    render();
  });

  filter.addEventListener("input", () => {
    const query = filter.value.trim();
    results = query ? filterFiles(allFiles, query) : [];
    highlight = -1;
    render();
  });

  filter.addEventListener("keydown", (event) => {
    // Enter and the arrows belong to the input method while it composes.
    if (event.isComposing) return;
    if (event.key === "ArrowDown" && results.length > 0) {
      highlight = (highlight + 1) % results.length;
      render();
    } else if (event.key === "ArrowUp" && results.length > 0) {
      highlight = highlight <= 0 ? results.length - 1 : highlight - 1;
      render();
    } else if (event.key === "Enter" && results.length > 0) {
      onOpen((results[highlight] ?? results[0]).file.path);
    } else if (event.key === "Escape") {
      if (filter.value) {
        filter.value = "";
        filter.dispatchEvent(new Event("input"));
      } else {
        filter.blur();
      }
    } else {
      return;
    }
    event.preventDefault();
  });

  function render() {
    if (!filter.value.trim()) {
      list.replaceChildren(...items(tree.children!, 0));
      return;
    }
    if (results.length === 0) {
      const none = document.createElement("li");
      none.className = "mdame-tree-empty";
      none.textContent = "No file matches.";
      list.replaceChildren(none);
      return;
    }
    list.replaceChildren(...results.map(resultItem));
    list.children[highlight]?.scrollIntoView({ block: "nearest" });
  }

  function resultItem(result: Match, index: number) {
    const name = document.createElement("span");
    name.className = "mdame-tree-name";
    for (const part of result.parts) {
      // textContent only: file names can hold markup.
      const piece = document.createElement(part.matched ? "b" : "span");
      piece.textContent = part.text;
      name.append(piece);
    }
    const folder = document.createElement("span");
    folder.className = "mdame-tree-folder";
    folder.textContent = result.file.path.split("/").slice(0, -1).join("/");
    const row = fileRow(result.file, name);
    row.style.paddingLeft = "8px";
    row.append(folder);
    row.classList.toggle("is-highlighted", index === highlight);
    const item = document.createElement("li");
    item.append(line(row, result.file.path));
    return item;
  }

  function items(nodes: TreeNode[], depth: number): HTMLLIElement[] {
    return nodes.map((node) => {
      const item = document.createElement("li");
      const row = node.kind === "dir" ? folderRow(node) : fileRow(node);
      row.style.paddingLeft = `${8 + depth * 16}px`;
      item.append(line(row, node.path));
      if (node.kind === "dir" && open.has(node.path)) {
        const children = document.createElement("ul");
        children.append(...items(node.children!, depth + 1));
        item.append(children);
      }
      return item;
    });
  }

  function folderRow(node: TreeNode) {
    const expanded = open.has(node.path);
    const row = document.createElement("button");
    row.className = "mdame-tree-row";
    row.setAttribute("aria-expanded", String(expanded));
    row.append(icon(expanded ? "chevron-down" : "chevron-right"), label(node.name));
    row.addEventListener("click", () => {
      if (expanded) open.delete(node.path);
      else open.add(node.path);
      store(openKey, [...open]);
      render();
    });
    return row;
  }

  function fileRow(node: TreeNode, name = label(node.name)) {
    const row = document.createElement("a");
    row.className = "mdame-tree-row";
    row.href = viewUrl(node.path);
    if (node.path === current) row.setAttribute("aria-current", "page");
    row.append(icon(fileIcon(node.name)), name);
    row.addEventListener("click", (event) => {
      // A modified click (new tab, new window) stays a normal link.
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault();
      onOpen(node.path);
    });
    return row;
  }

  showSort();
  focusField = () => filter.focus();
  select = (path) => {
    current = path;
    for (const folder of ancestors(path ?? "")) open.add(folder);
    render();
  };
  render();
}

/** A row with its hover action. HTML allows no button inside a link, so
 * the button sits next to the row. */
function line(row: HTMLElement, path: string) {
  const wrapper = document.createElement("div");
  wrapper.className = "mdame-tree-line";
  wrapper.append(row, copyButton(path));
  return wrapper;
}

function copyButton(path: string) {
  const button = document.createElement("button");
  button.className = "mdame-icon-button mdame-copy";
  button.setAttribute("aria-label", `Copy path ${path}`);
  button.title = "Copy path";
  button.append(icon("link"));
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(path);
      button.replaceChildren(icon("check"));
    } catch {
      // The clipboard API exists only on secure pages: localhost, not a LAN address.
      button.replaceChildren(icon("cross"));
      button.title = "Copy failed: the clipboard works only through localhost";
    }
    setTimeout(() => {
      button.replaceChildren(icon("link"));
      button.title = "Copy path";
    }, 1200);
  });
  return button;
}

function label(text: string) {
  const span = document.createElement("span");
  span.className = "mdame-tree-name";
  span.textContent = text;
  return span;
}

export const MIN_WIDTH = 180;
export const MAX_WIDTH = 480;

export function clampWidth(width: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));
}

let toggle = () => {};
let open = () => {};
let closeOverlay = () => {};

/** Hides or shows the sidebar; below 900 px, opens or closes the overlay. */
export function toggleSidebar() {
  toggle();
}

export function closeSidebarOverlay() {
  closeOverlay();
}

/** Shows the sidebar if needed, then focuses the filter field. */
export function focusFilter() {
  open();
  focusField();
}

interface LayoutElements {
  frame: HTMLElement;
  handle: HTMLElement;
  backdrop: HTMLElement;
  button: HTMLButtonElement;
}

export function setupLayout({ frame, handle, backdrop, button }: LayoutElements) {
  const narrow = matchMedia("(max-width: 899px)");
  let width = MIN_WIDTH;

  function setWidth(next: number) {
    width = clampWidth(next);
    frame.style.setProperty("--sidebar-width", `${width}px`);
    handle.setAttribute("aria-valuenow", String(width));
  }

  handle.setAttribute("role", "separator");
  handle.setAttribute("aria-orientation", "vertical");
  handle.setAttribute("aria-label", "Sidebar width");
  handle.setAttribute("aria-valuemin", String(MIN_WIDTH));
  handle.setAttribute("aria-valuemax", String(MAX_WIDTH));
  handle.tabIndex = 0;
  setWidth(Number(load("mdame:sidebar-width", 260)) || 260);

  handle.addEventListener("pointerdown", (event) => {
    // Capture keeps the moves coming while the pointer is over the content.
    handle.setPointerCapture(event.pointerId);
    const left = frame.getBoundingClientRect().left;
    const move = (moved: PointerEvent) => setWidth(moved.clientX - left);
    handle.addEventListener("pointermove", move);
    handle.addEventListener(
      "pointerup",
      () => {
        handle.removeEventListener("pointermove", move);
        store("mdame:sidebar-width", width);
      },
      { once: true },
    );
  });

  handle.addEventListener("keydown", (event) => {
    const step = ({ ArrowLeft: -16, ArrowRight: 16 } as Record<string, number>)[event.key];
    if (!step) return;
    event.preventDefault();
    setWidth(width + step);
    store("mdame:sidebar-width", width);
  });

  function isOpen() {
    return narrow.matches
      ? frame.classList.contains("overlay-open")
      : !frame.classList.contains("sidebar-hidden");
  }

  function showButton() {
    const label = `${isOpen() ? "Hide" : "Show"} sidebar (b)`;
    button.setAttribute("aria-label", label);
    button.title = label;
    button.setAttribute("aria-expanded", String(isOpen()));
  }

  toggle = () => {
    if (narrow.matches) {
      frame.classList.toggle("overlay-open");
    } else {
      store("mdame:sidebar-hidden", frame.classList.toggle("sidebar-hidden"));
    }
    showButton();
  };
  open = () => {
    if (!isOpen()) toggle();
  };
  closeOverlay = () => {
    frame.classList.remove("overlay-open");
    showButton();
  };

  frame.classList.toggle("sidebar-hidden", load<boolean>("mdame:sidebar-hidden", false) === true);
  button.addEventListener("click", toggle);
  backdrop.addEventListener("click", closeOverlay);
  addEventListener("keydown", (event: KeyboardEvent) => {
    // The filter uses its first Esc to clear itself.
    if (event.key === "Escape" && !event.defaultPrevented && frame.classList.contains("overlay-open")) {
      closeOverlay();
    }
  });
  narrow.addEventListener("change", closeOverlay);
  showButton();
}
