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

const fuzzy = new uFuzzy();

/**
 * Files whose name matches `query`, best first. `parts` splits the name
 * into matched and unmatched pieces, for bold letters.
 */
export function filterFiles(list: TreeNode[], query: string): Match[] {
  const [indexes, info, order] = fuzzy.search(
    list.map((file) => file.name),
    query,
  );
  if (!indexes) return [];
  // uFuzzy skips ranking when too many names match.
  if (!info) return indexes.map((index) => ({ file: list[index], parts: [plain(list[index])] }));
  return order.map((rank) => {
    const file = list[info.idx[rank]];
    const parts = uFuzzy.highlight<Part[], Part>(
      file.name,
      info.ranges[rank],
      (text, matched) => ({ text, matched }),
      [],
      (all, part) => [...all, part],
    );
    return { file, parts: parts.filter((part) => part.text) };
  });
}

function plain(file: TreeNode): Part {
  return { text: file.name, matched: false };
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
  const list = document.createElement("ul");
  list.className = "mdame-tree";
  el.replaceChildren(list);
  const tree = sortTree(await api<TreeNode>("GET", "/api/tree"), "name-asc");

  function render() {
    list.replaceChildren(...items(tree.children!, 0));
  }

  function items(nodes: TreeNode[], depth: number): HTMLLIElement[] {
    return nodes.map((node) => {
      const item = document.createElement("li");
      const row = node.kind === "dir" ? folderRow(node) : fileRow(node);
      row.style.paddingLeft = `${8 + depth * 16}px`;
      item.append(row);
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

  function fileRow(node: TreeNode) {
    const row = document.createElement("a");
    row.className = "mdame-tree-row";
    row.href = viewUrl(node.path);
    if (node.path === current) row.setAttribute("aria-current", "page");
    row.append(icon(fileIcon(node.name)), label(node.name));
    row.addEventListener("click", (event) => {
      // A modified click (new tab, new window) stays a normal link.
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault();
      onOpen(node.path);
    });
    return row;
  }

  select = (path) => {
    current = path;
    for (const folder of ancestors(path ?? "")) open.add(folder);
    render();
  };
  render();
}

function label(text: string) {
  const span = document.createElement("span");
  span.className = "mdame-tree-name";
  span.textContent = text;
  return span;
}
