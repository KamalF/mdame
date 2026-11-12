import uFuzzy from "@leeoniya/ufuzzy";
import { send } from "./api.ts";
import { copyButton } from "./copy.ts";
import { fileIcon, icon, iconButton } from "./icons.ts";
import { isPlainClick, shouldHandle } from "./keys.ts";
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

const SORTS = Object.keys(SORT_LABELS);

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

/** Each result is a row of about 16 elements, and in a large repository
 * one letter matches thousands of names. */
export const FILTER_LIMIT = 100;

/**
 * The first `FILTER_LIMIT` files whose name matches `query`, best first,
 * accents ignored, and how many more match. `parts` splits the name into
 * matched and unmatched pieces, for bold letters.
 */
export function filterFiles(list: TreeNode[], query: string): { matches: Match[]; more: number } {
  // NFC first: latinize knows only precomposed letters, and a name saved on
  // macOS can hold "e" plus a combining accent. latinize then changes one
  // letter for one letter, so the ranges still fit the NFC names.
  const names = list.map((file) => file.name.normalize("NFC"));
  const [indexes, info, order] = fuzzy.search(
    uFuzzy.latinize(names),
    uFuzzy.latinize(query.normalize("NFC")),
  );
  if (!indexes) return { matches: [], more: 0 };
  const more = Math.max(0, indexes.length - FILTER_LIMIT);
  // uFuzzy skips ranking when too many names match.
  if (!info) {
    const matches = indexes.slice(0, FILTER_LIMIT).map((index) => ({
      file: list[index],
      parts: [{ text: names[index], matched: false }],
    }));
    return { matches, more };
  }
  const matches = order.slice(0, FILTER_LIMIT).map((rank) => {
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
  return { matches, more };
}

/** A row of the tree on screen. `open` is set for a folder only. */
export interface VisibleRow {
  path: string;
  open?: boolean;
}

/**
 * What an arrow key does on row `index` of `rows`, top to bottom: the index
 * of the row to focus, "toggle" to open or close that folder, or null.
 * As in the WAI-ARIA tree pattern, ↑↓ do not wrap.
 */
export function arrowKey(rows: VisibleRow[], index: number, key: string): number | "toggle" | null {
  const row = rows[index];
  switch (key) {
    case "ArrowDown":
      return index + 1 < rows.length ? index + 1 : null;
    case "ArrowUp":
      return index > 0 ? index - 1 : null;
    case "ArrowRight":
      if (row.open === false) return "toggle";
      return row.open && rows[index + 1]?.path.startsWith(`${row.path}/`) ? index + 1 : null;
    case "ArrowLeft": {
      if (row.open) return "toggle";
      // Filter results show no folders, so their files find no parent.
      const parent = ancestors(row.path).at(-1);
      const found = rows.findIndex((other) => other.path === parent);
      return found === -1 ? null : found;
    }
  }
  return null;
}

/** The height of a row of the tree, and the padding of the list: the CSS
 * gives them too. */
export const ROW_HEIGHT = 26;
const LIST_PADDING = 6;
/** The rows built past each edge of the view, so that a scroll shows them
 * before the next paint. */
const OVERSCAN = 10;

/** A row of the tree. `size` and `position` place the node among its
 * siblings: the list is flat, so screen readers learn the nesting from
 * them and from `depth`. */
export interface Row {
  node: TreeNode;
  depth: number;
  size: number;
  position: number;
}

/** The rows of `nodes`, top to bottom, with the rows of the open folders
 * under them. */
export function treeRows(nodes: TreeNode[], open: Set<string>, depth = 0, rows: Row[] = []): Row[] {
  nodes.forEach((node, index) => {
    rows.push({ node, depth, size: nodes.length, position: index + 1 });
    if (node.kind === "dir" && open.has(node.path)) treeRows(node.children!, open, depth + 1, rows);
  });
  return rows;
}

/** The rows to build, `[first, last)` of `count`, for a view `height` px
 * high whose top is `top` px below the top of the list. */
export function rowsInView(top: number, height: number, count: number): [number, number] {
  const first = Math.max(0, Math.floor((top - LIST_PADDING) / ROW_HEIGHT) - OVERSCAN);
  const last = Math.min(count, Math.ceil((top + height - LIST_PADDING) / ROW_HEIGHT) + OVERSCAN);
  return [first, Math.max(first, last)];
}

/** A row's key on screen: a path can change from a file to a folder. */
function rowKey({ kind, path }: Pick<TreeNode, "kind" | "path">): string {
  return `${kind}:${path}`;
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

/** `/api/tree` as text: a refetch compares it with the last one before it
 * parses it. */
async function treeText() {
  return (await send("GET", "/api/tree")).text();
}

/** Shows the tree in `el`, and returns its number of files. */
interface MountOptions {
  root: string;
  current: string | null;
  onOpen: (path: string) => void;
  /** Gets the folder, "" for the workspace folder. */
  onNewFile: (folder: string) => void;
  onSearch: () => void;
}

export async function mount(
  el: HTMLElement,
  { root, current, onOpen, onNewFile, onSearch }: MountOptions,
) {
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
  const searchButton = iconButton("Search in files", "search", onSearch, "Search in files (s)");
  header.append(filterField, searchButton, newFileButton(""), sortButton);
  const list = document.createElement("ul");
  list.className = "mdame-tree";
  el.replaceChildren(header, list);

  let fetchedText = await treeText();
  let fetched: TreeNode = JSON.parse(fetchedText);
  // The page can show another file while the tree loads.
  current = latest;
  for (const folder of ancestors(current ?? "")) open.add(folder);
  let allFiles = files(fetched);
  let tree = sortTree(fetched, order);
  let query = "";
  let results: Match[] = [];
  let more = 0;
  let highlight = -1;
  /** The rows of the tree, built on screen only near the view: 1,600 rows
   * made each drag of the sidebar lay out 1,600 elements. */
  let rows: Row[] = [];
  let rowIndex = new Map<string, number>();

  function showSort() {
    const label = `Sort: ${SORT_LABELS[order]}`;
    sortButton.setAttribute("aria-label", label);
    sortButton.title = label;
    // The icons are named after the orders.
    sortButton.replaceChildren(icon(order));
  }

  sortButton.addEventListener("click", () => {
    order = SORTS[(SORTS.indexOf(order) + 1) % SORTS.length];
    store("mdame:sort", order);
    tree = sortTree(fetched, order);
    showSort();
    render();
  });

  function match() {
    ({ matches: results, more } = query ? filterFiles(allFiles, query) : { matches: [], more: 0 });
  }

  function applyFilter() {
    query = filter.value.trim();
    match();
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
    } else if (event.key === "ArrowDown" && !query) {
      if (!enterTree()) return;
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

  /** Focuses the row of the current file, or else the first row. */
  function enterTree() {
    if (!query) {
      if (rows.length === 0) return false;
      focusRow(current === null ? 0 : (rowIndex.get(rowKey({ kind: "file", path: current })) ?? 0));
      return true;
    }
    const row =
      list.querySelector<HTMLElement>('[aria-current="page"]') ??
      list.querySelector<HTMLElement>(".mdame-tree-row");
    row?.focus();
    return row !== null;
  }

  /** Builds row `index` if it is out of view, and focuses it: the browser
   * then scrolls it into view. */
  function focusRow(index: number) {
    paint(index);
    rowOf(rows[index].node.path)?.focus();
  }

  // A click on empty space focuses the sidebar, and an arrow key then
  // enters the tree.
  el.tabIndex = -1;
  el.addEventListener("keydown", (event) => {
    if (event.target !== el || !event.key.startsWith("Arrow") || !shouldHandle(event)) return;
    if (enterTree()) event.preventDefault();
  });

  list.addEventListener("keydown", (event) => {
    // Also from the row's copy-path and new-file buttons.
    const line = (event.target as HTMLElement).closest<HTMLElement>(".mdame-tree-line");
    // Alt+← is the browser's Back.
    if (!line || !event.key.startsWith("Arrow") || !shouldHandle(event)) return;
    if (query) {
      // The results of the filter: all on screen, with no folder.
      const lines = [...list.querySelectorAll<HTMLElement>(".mdame-tree-line")];
      const next = arrowKey(lines.map((each) => ({ path: each.dataset.path! })), lines.indexOf(line), event.key);
      if (typeof next !== "number") return;
      event.preventDefault();
      (lines[next].firstElementChild as HTMLElement).focus();
      return;
    }
    const visible = rows.map(({ node }) => ({
      path: node.path,
      open: node.kind === "dir" ? open.has(node.path) : undefined,
    }));
    const next = arrowKey(visible, rowIndex.get(line.parentElement!.dataset.key!)!, event.key);
    if (next === null) return;
    event.preventDefault();
    if (next === "toggle") (line.firstElementChild as HTMLElement).click();
    else focusRow(next);
  });

  // The rows in view change with the scroll and the height of the sidebar.
  el.addEventListener("scroll", () => query || paint(), { passive: true });
  new ResizeObserver(() => query || paint()).observe(el);

  function render() {
    if (!query) {
      rows = treeRows(tree.children!, open);
      rowIndex = new Map(rows.map((row, index) => [rowKey(row.node), index]));
      list.classList.add("is-virtual");
      list.style.height = `${rows.length * ROW_HEIGHT}px`;
      paint();
      return;
    }
    list.classList.remove("is-virtual");
    list.style.height = "";
    if (results.length === 0) {
      const none = document.createElement("li");
      none.className = "mdame-tree-empty";
      none.textContent = "No file matches.";
      list.replaceChildren(none);
      return;
    }
    list.replaceChildren(...results.map(resultItem));
    if (more > 0) {
      const rest = document.createElement("li");
      rest.className = "mdame-tree-empty";
      const count = more === 1 ? "1 more file matches" : `${more.toLocaleString("en")} more files match`;
      rest.textContent = `${count}: type more letters.`;
      list.append(rest);
    }
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

  /**
   * Builds the rows in view, and `extra` if it is a row, and drops the
   * others. The focused row stays, even out of view: the arrow keys move
   * from it. A row on screen stays as it is, so that it keeps the focus.
   */
  function paint(extra = -1) {
    // Below the top of the view, while the header shows.
    const top = el.getBoundingClientRect().top + el.clientTop - list.getBoundingClientRect().top;
    const [first, last] = rowsInView(top, el.clientHeight, rows.length);
    const indexes = [];
    for (let index = first; index < last; index++) indexes.push(index);
    const active = document.activeElement;
    const focused = list.contains(active) ? active!.closest("li")!.dataset.key : undefined;
    for (const index of [extra, focused === undefined ? -1 : (rowIndex.get(focused) ?? -1)]) {
      if (index >= 0 && !indexes.includes(index)) indexes.push(index);
    }
    indexes.sort((a, b) => a - b);
    const shown = new Map<string, HTMLLIElement>();
    for (const item of list.children as HTMLCollectionOf<HTMLLIElement>) {
      if (item.dataset.key) shown.set(item.dataset.key, item);
    }
    const wanted = indexes.map((index) => {
      const row = rows[index];
      const item = shown.get(rowKey(row.node)) ?? rowItem(row);
      place(item, row, index);
      return item;
    });
    const kept = new Set(wanted);
    for (const item of [...list.children]) if (!kept.has(item as HTMLLIElement)) item.remove();
    // Inserts the new rows around those on screen, which do not move.
    let next = list.firstElementChild;
    for (const item of wanted) {
      if (item === next) next = next.nextElementSibling;
      else list.insertBefore(item, next);
    }
  }

  function rowItem({ node, depth }: Row) {
    const item = document.createElement("li");
    item.dataset.key = rowKey(node);
    const row = node.kind === "dir" ? folderRow(node) : fileRow(node);
    row.style.paddingLeft = `${8 + depth * 16}px`;
    const newFile = node.kind === "dir" ? newFileButton(node.path) : undefined;
    newFile?.classList.add("mdame-new-file");
    item.append(line(row, node.path, newFile));
    return item;
  }

  /** Puts `item` at row `index`, with the state of its row now: a refetch
   * or a new current file can change a row that stays on screen. */
  function place(item: HTMLLIElement, { node, depth, size, position }: Row, index: number) {
    const top = `${LIST_PADDING + index * ROW_HEIGHT}px`;
    if (item.style.top !== top) item.style.top = top;
    setAttribute(item, "aria-level", String(depth + 1));
    setAttribute(item, "aria-setsize", String(size));
    setAttribute(item, "aria-posinset", String(position));
    const row = item.querySelector<HTMLElement>(".mdame-tree-row")!;
    if (node.kind === "dir") showOpen(row, open.has(node.path));
    else if (node.path === current) setAttribute(row, "aria-current", "page");
    else row.removeAttribute("aria-current");
  }

  function newFileButton(folder: string) {
    const label = folder ? `New file in ${folder}` : "New file";
    return iconButton(label, "file-plus", () => onNewFile(folder));
  }

  function folderRow(node: TreeNode) {
    const row = document.createElement("button");
    row.className = "mdame-tree-row";
    row.append(icon("chevron-right"), label(node.name));
    row.addEventListener("click", () => {
      if (!open.delete(node.path)) open.add(node.path);
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

  function rowOf(path: string) {
    return list.querySelector<HTMLElement>(
      `.mdame-tree-line[data-path="${CSS.escape(path)}"] > .mdame-tree-row`,
    );
  }

  let fetches = 0;
  refetch = async () => {
    const id = ++fetches;
    const text = await treeText();
    if (id !== fetches) return null;
    // An event in a large folder gives the same tree, often.
    if (text === fetchedText) return allFiles.length;
    fetchedText = text;
    fetched = JSON.parse(text);
    allFiles = files(fetched);
    tree = sortTree(fetched, order);
    // The arrow-key choice and the keyboard focus follow their file, which
    // may move or be gone.
    const chosen = results[highlight]?.file.path;
    const focused = list.contains(document.activeElement)
      ? document.activeElement!.closest<HTMLElement>(".mdame-tree-line")?.dataset.path
      : undefined;
    match();
    highlight = results.findIndex((result) => result.file.path === chosen);
    render();
    if (focused !== undefined) rowOf(focused)?.focus();
    return allFiles.length;
  };

  datedFile = (path) => order.startsWith("date") && allFiles.some((file) => file.path === path);
  showSort();
  focusField = () => filter.focus();
  select = (path) => {
    current = path;
    const closed = ancestors(path ?? "").filter((folder) => !open.has(folder));
    for (const folder of closed) open.add(folder);
    if (closed.length > 0) store(openKey, [...open]);
    if (!query) {
      if (closed.length > 0) render();
      else paint();
      return;
    }
    // The results of the filter.
    list.querySelector('[aria-current="page"]')?.removeAttribute("aria-current");
    if (path !== null) rowOf(path)?.setAttribute("aria-current", "page");
  };
  render();
  return allFiles.length;
}

/** A row with its hover actions. HTML allows no button inside a link, so
 * the buttons sit next to the row. */
function line(row: HTMLElement, path: string, newFile?: HTMLButtonElement) {
  const wrapper = document.createElement("div");
  wrapper.className = "mdame-tree-line";
  wrapper.dataset.path = path;
  const copy = copyButton({ label: `Copy path ${path}`, iconName: "link", text: () => path });
  copy.classList.add("mdame-copy");
  wrapper.append(row);
  if (newFile) wrapper.append(newFile);
  wrapper.append(copy);
  return wrapper;
}

/** The chevron and `aria-expanded` of a folder's row. */
function showOpen(row: HTMLElement, expanded: boolean) {
  if (row.getAttribute("aria-expanded") === String(expanded)) return;
  row.setAttribute("aria-expanded", String(expanded));
  row.firstElementChild!.replaceWith(icon(expanded ? "chevron-down" : "chevron-right"));
}

/** Writes only a change: a scroll frame places each row again. */
function setAttribute(element: Element, name: string, value: string) {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
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
let overlayOpen = () => false;

/** Hides or shows the sidebar; below 900 px, opens or closes the overlay. */
export function toggleSidebar() {
  toggle();
}

export function closeSidebarOverlay() {
  closeOverlay();
}

export function isOverlayOpen(): boolean {
  return overlayOpen();
}

/** Shows the sidebar if needed, then focuses the filter field. */
export function focusFilter() {
  show();
  focusField();
}

interface LayoutElements {
  frame: HTMLElement;
  nav: HTMLElement;
  handle: HTMLElement;
  backdrop: HTMLElement;
  button: HTMLButtonElement;
}

export function setupLayout({ frame, nav, handle, backdrop, button }: LayoutElements) {
  const narrow = matchMedia("(max-width: 899px)");
  let width = MIN_WIDTH;

  function setWidth(next: number) {
    width = clampWidth(next);
    // The sidebar's own width: a custom property on the frame would
    // restyle the whole page at each move of a drag.
    nav.style.width = `${width}px`;
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
  overlayOpen = () => frame.classList.contains("overlay-open");

  frame.classList.toggle("sidebar-hidden", load<boolean>("mdame:sidebar-hidden", false) === true);
  button.addEventListener("click", toggle);
  backdrop.addEventListener("click", closeOverlay);
  addEventListener("keydown", (event: KeyboardEvent) => {
    // The filter uses its first Esc to clear itself.
    // Esc on an open dialog closes the dialog only.
    const dialog = document.querySelector("dialog[open]");
    if (event.key === "Escape" && !event.defaultPrevented && !dialog && frame.classList.contains("overlay-open")) {
      closeOverlay();
    }
  });
  narrow.addEventListener("change", closeOverlay);
  showButton();
}
