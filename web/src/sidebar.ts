import uFuzzy from "@leeoniya/ufuzzy";
import { api } from "./api.ts";
import { copyButton } from "./copy.ts";
import { fileIcon, icon } from "./icons.ts";
import { isPlainClick } from "./keys.ts";
import { load, store } from "./storage.ts";

/** A node of `/api/tree`. `modified` is in Unix seconds; for a folder, its newest file. */
export interface TreeNode {
  name: string;
  /** Relative to the workspace root, with `/` between parts. */
  path: string;
  kind: "dir" | "file";
  family?: string;
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

const SORT_LABELS: Record<string, string> = {
  "name-asc": "name, A to Z",
  "name-desc": "name, Z to A",
  "date-desc": "newest first",
  "date-asc": "oldest first",
};

export const SORTS = Object.keys(SORT_LABELS);

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
  if (!info) {
    return indexes.map((index) => ({
      file: list[index],
      parts: [{ text: names[index], matched: false }],
    }));
  }
  return order.map((rank) => {
    const index = info.idx[rank];
    const parts = uFuzzy.highlight<Part[], Part>(
      names[index],
      info.ranges[rank],
      (text, matched) => ({ text, matched }),
      [],
      (all, part) => {
        all.push(part);
        return all;
      },
    );
    return { file: list[index], parts: parts.filter((part) => part.text) };
  });
}

/** `docs/a b.md` gives `docs/a%20b.md`: each part is encoded, not the slashes. */
export function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export function viewUrl(path: string): string {
  return "/view/" + encodePath(path);
}

export function pathFromUrl(pathname: string, prefix = "/view/"): string | null {
  if (!pathname.startsWith(prefix)) return null;
  try {
    return decodeURIComponent(pathname.slice(prefix.length));
  } catch {
    return null;
  }
}

let select: (path: string | null) => void = () => {};
let focusField = () => {};
let datedFile: (path: string) => boolean = () => false;

/** Whether a change to `path` can move it in the tree: a date sort orders
 * by the time a file changed. */
export function orderDependsOn(path: string): boolean {
  return datedFile(path);
}

let refetch: () => Promise<number | null> = async () => null;

// The current file, also while the tree is still loading.
let latest: string | null;

/** Highlights `path` as the current file. */
export function setCurrent(path: string | null) {
  latest = path;
  select(path);
}

/** Loads the tree again, keeping the open folders, the sort and the filter.
 * Returns the number of files, or null when a later call replaced this one. */
export function refreshTree(): Promise<number | null> {
  return refetch();
}

/** Shows the tree in `el`, and returns its number of files. */
interface MountOptions {
  root: string;
  current: string | null;
  onOpen: (path: string) => void;
}

export async function mount(el: HTMLElement, { root, current, onOpen }: MountOptions) {
  latest = current;
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

  let fetched = await api<TreeNode>("GET", "/api/tree");
  // The page can show another file while the tree loads.
  current = latest;
  for (const folder of ancestors(current ?? "")) open.add(folder);
  let allFiles = files(fetched);
  let tree = sortTree(fetched, order);
  let query = "";
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

  function applyFilter() {
    query = filter.value.trim();
    results = query ? filterFiles(allFiles, query) : [];
    highlight = -1;
    render();
  }

  // Moves the highlight without rebuilding the list.
  function moveHighlight(next: number) {
    list.children[highlight]?.querySelector(".mdame-tree-row")!.classList.remove("is-highlighted");
    highlight = next;
    const item = list.children[highlight];
    item.querySelector(".mdame-tree-row")!.classList.add("is-highlighted");
    item.scrollIntoView({ block: "nearest" });
  }

  filter.addEventListener("input", applyFilter);

  filter.addEventListener("keydown", (event) => {
    // Enter and the arrows belong to the input method while it composes.
    if (event.isComposing) return;
    if (event.key === "ArrowDown" && results.length > 0) {
      moveHighlight((highlight + 1) % results.length);
    } else if (event.key === "ArrowUp" && results.length > 0) {
      moveHighlight(highlight <= 0 ? results.length - 1 : highlight - 1);
    } else if (event.key === "Enter" && results.length > 0) {
      onOpen((results[highlight] ?? results[0]).file.path);
    } else if (event.key === "Escape") {
      if (filter.value) {
        filter.value = "";
        applyFilter();
      } else {
        filter.blur();
      }
    } else {
      return;
    }
    event.preventDefault();
  });

  function render() {
    if (!query) {
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
    row.append(icon(fileIcon(node.family)), name);
    row.addEventListener("click", (event) => {
      // A modified click (new tab, new window) stays a normal link.
      if (!isPlainClick(event)) return;
      event.preventDefault();
      onOpen(node.path);
    });
    return row;
  }

  let fetches = 0;
  refetch = async () => {
    const id = ++fetches;
    const next = await api<TreeNode>("GET", "/api/tree");
    if (id !== fetches) return null;
    fetched = next;
    allFiles = files(next);
    tree = sortTree(next, order);
    // The arrow-key choice and the keyboard focus follow their file, which
    // may move or be gone.
    const chosen = results[highlight]?.file.path;
    const focused = list.contains(document.activeElement)
      ? document.activeElement!.closest<HTMLElement>(".mdame-tree-line")?.dataset.path
      : undefined;
    results = query ? filterFiles(allFiles, query) : [];
    highlight = results.findIndex((result) => result.file.path === chosen);
    render();
    if (focused !== undefined) {
      const row = `.mdame-tree-line[data-path="${CSS.escape(focused)}"] > .mdame-tree-row`;
      list.querySelector<HTMLElement>(row)?.focus();
    }
    return allFiles.length;
  };

  datedFile = (path) => order.startsWith("date") && allFiles.some((file) => file.path === path);
  showSort();
  focusField = () => filter.focus();
  select = (path) => {
    current = path;
    for (const folder of ancestors(path ?? "")) open.add(folder);
    render();
  };
  render();
  return allFiles.length;
}

/** A row with its hover action. HTML allows no button inside a link, so
 * the button sits next to the row. */
function line(row: HTMLElement, path: string) {
  const wrapper = document.createElement("div");
  wrapper.className = "mdame-tree-line";
  wrapper.dataset.path = path;
  const copy = copyButton({ label: `Copy path ${path}`, iconName: "link", text: () => path });
  copy.classList.add("mdame-copy");
  wrapper.append(row, copy);
  return wrapper;
}

function label(text: string) {
  const span = document.createElement("span");
  span.className = "mdame-tree-name";
  span.textContent = text;
  return span;
}

export const MIN_WIDTH = 180;
export const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 260;

export function clampWidth(width: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));
}

let toggle = () => {};
let show = () => {};
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
  show();
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
  setWidth(Number(load("mdame:sidebar-width", DEFAULT_WIDTH)) || DEFAULT_WIDTH);

  handle.addEventListener("pointerdown", (event) => {
    // Capture keeps the moves coming while the pointer is over the content.
    handle.setPointerCapture(event.pointerId);
    const left = frame.getBoundingClientRect().left;
    const move = (moved: PointerEvent) => setWidth(moved.clientX - left);
    // Without it, the drag selects the text that the pointer passes over.
    frame.classList.add("is-resizing");
    handle.addEventListener("pointermove", move);
    // Fires after pointerup and after pointercancel.
    handle.addEventListener(
      "lostpointercapture",
      () => {
        handle.removeEventListener("pointermove", move);
        frame.classList.remove("is-resizing");
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
  show = () => {
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
