import uFuzzy from "@leeoniya/ufuzzy";

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
