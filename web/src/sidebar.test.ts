import { expect, test } from "bun:test";
import {
  ancestors,
  clampWidth,
  files,
  filterFiles,
  pathFromUrl,
  sortTree,
  viewUrl,
  type TreeNode,
} from "./sidebar.ts";

const file = (path: string, modified: number): TreeNode => ({
  name: path.split("/").at(-1)!,
  path,
  kind: "file",
  modified,
});
const dir = (path: string, children: TreeNode[]): TreeNode => ({
  name: path.split("/").at(-1)!,
  path,
  kind: "dir",
  modified: Math.max(...children.map((child) => child.modified)),
  children,
});

const tree = dir("", [
  file("b.md", 30),
  dir("docs", [file("docs/z.md", 10), file("docs/a.md", 20)]),
  file("A2.md", 5),
  file("a10.md", 40),
]);

const names = (node: TreeNode) => node.children!.map((child) => child.name);

test("sort puts folders first, then names in natural order", () => {
  const sorted = sortTree(tree, "name-asc");
  expect(names(sorted)).toEqual(["docs", "A2.md", "a10.md", "b.md"]);
  expect(names(sorted.children![0])).toEqual(["a.md", "z.md"]);
  expect(names(sortTree(tree, "name-desc"))).toEqual(["docs", "b.md", "a10.md", "A2.md"]);
});

test("sort by date, newest or oldest first", () => {
  expect(names(sortTree(tree, "date-desc"))).toEqual(["docs", "a10.md", "b.md", "A2.md"]);
  expect(names(sortTree(tree, "date-asc").children![0])).toEqual(["z.md", "a.md"]);
});

test("sort does not change the tree it gets", () => {
  sortTree(tree, "name-asc");
  expect(names(tree)).toEqual(["b.md", "docs", "A2.md", "a10.md"]);
});

test("files lists every file, at any depth", () => {
  expect(files(tree).map((f) => f.path)).toEqual([
    "b.md",
    "docs/z.md",
    "docs/a.md",
    "A2.md",
    "a10.md",
  ]);
});

test("ancestors gives the folders to open for a path", () => {
  expect(ancestors("docs/api/a.md")).toEqual(["docs", "docs/api"]);
  expect(ancestors("a.md")).toEqual([]);
});

test("filter matches names fuzzily and marks the matched letters", () => {
  const list = [file("docs/api/rate-limiting.md", 1), file("notes/separate-tokens.md", 1)];
  const results = filterFiles(list, "rate");
  expect(results[0].file.path).toBe("docs/api/rate-limiting.md");
  expect(results[0].parts[0]).toEqual({ text: "rate", matched: true });
  expect(results[0].parts.map((part) => part.text).join("")).toBe("rate-limiting.md");
  expect(filterFiles(list, "zzz")).toEqual([]);
});

test("filter skips letters and separators between matched letters", () => {
  const list = [file("mise.toml", 1), file("Cargo.toml", 1)];
  expect(filterFiles(list, "mto").map((result) => result.file.name)).toEqual(["mise.toml"]);
});

test("filter handles accented names, with or without the accents", () => {
  const list = [file("résumé.md", 1), file("ÉTÉ.md", 1), file("Cargo.toml", 1)];
  const names = (query: string) => filterFiles(list, query).map((result) => result.file.name);
  expect(names("rsm")).toEqual(["résumé.md"]);
  expect(names("ete")).toEqual(["ÉTÉ.md"]);
  expect(names("été")).toEqual(["ÉTÉ.md"]);
  const parts = filterFiles(list, "res")[0].parts;
  expect(parts[0]).toEqual({ text: "rés", matched: true });
});

test("filter finds names saved with combining accents (NFD)", () => {
  const list = [file("résumé.md".normalize("NFD"), 1)];
  for (const query of ["resume", "rsm", "rés"]) {
    expect(filterFiles(list, query).map((result) => result.file.path)).toEqual([list[0].path]);
  }
});

test("view URLs encode each part and keep the slashes", () => {
  expect(viewUrl("docs/a b.md")).toBe("/view/docs/a%20b.md");
  expect(pathFromUrl("/view/docs/a%20b.md")).toBe("docs/a b.md");
  expect(pathFromUrl("/view/%E0")).toBe(null);
  expect(pathFromUrl("/")).toBe(null);
});

test("clampWidth keeps the sidebar between 180 and 480 px", () => {
  expect(clampWidth(100)).toBe(180);
  expect(clampWidth(300.6)).toBe(301);
  expect(clampWidth(900)).toBe(480);
});
