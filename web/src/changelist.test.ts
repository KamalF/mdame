import { expect, test } from "bun:test";
import { ChangeList } from "./changelist.ts";

function listAfter(events: Parameters<ChangeList["apply"]>[0][], open: string | null = null) {
  const list = new ChangeList();
  for (const event of events) list.apply(event, open);
  return list;
}

test("a created or changed markdown file is listed", () => {
  const list = listAfter([
    { type: "created", path: "a.md" },
    { type: "changed", path: ".claude/plans/b.MARKDOWN" },
  ]);
  expect(list.paths).toEqual([".claude/plans/b.MARKDOWN", "a.md"]);
});

test("other types are not listed", () => {
  const list = listAfter([
    { type: "changed", path: "a.json" },
    { type: "created", path: "notes" },
    { type: "renamed", from: "a.txt", to: "b.txt" },
  ]);
  expect(list.paths).toEqual([]);
});

test("the file on screen is not listed", () => {
  const list = listAfter([{ type: "changed", path: "a.md" }], "a.md");
  expect(list.paths).toEqual([]);
});

test("a second change moves the file to the top", () => {
  const list = listAfter([
    { type: "changed", path: "a.md" },
    { type: "changed", path: "b.md" },
    { type: "changed", path: "a.md" },
  ]);
  expect(list.paths).toEqual(["a.md", "b.md"]);
});

test("opening a file removes it", () => {
  const list = listAfter([
    { type: "changed", path: "a.md" },
    { type: "changed", path: "b.md" },
  ]);
  list.opened("a.md");
  expect(list.paths).toEqual(["b.md"]);
});

test("a rename keeps the entry under the new name", () => {
  const list = listAfter([
    { type: "changed", path: "a.md" },
    { type: "changed", path: "docs/b.md" },
    { type: "renamed", from: "a.md", to: "c.md" },
    // A folder moves its files.
    { type: "renamed", from: "docs", to: "notes" },
  ]);
  expect(list.paths).toEqual(["notes/b.md", "c.md"]);
  // Moved over a listed file, it keeps one entry.
  list.apply({ type: "renamed", from: "c.md", to: "notes/b.md" }, null);
  expect(list.paths).toEqual(["notes/b.md"]);
});

test("a file saved by renaming a new file over it is listed", () => {
  const list = listAfter([
    { type: "created", path: ".a.md.tmp" },
    { type: "renamed", from: ".a.md.tmp", to: "a.md" },
  ]);
  expect(list.paths).toEqual(["a.md"]);
});

test("a removed file leaves the list", () => {
  const list = listAfter([
    { type: "changed", path: "a.md" },
    { type: "changed", path: "docs/b.md" },
    { type: "removed", path: "a.md" },
    { type: "removed", path: "docs" },
  ]);
  expect(list.paths).toEqual([]);
});

test("resync adds nothing", () => {
  const list = listAfter([{ type: "changed", path: "a.md" }, { type: "resync" }]);
  expect(list.paths).toEqual(["a.md"]);
});

test("clear empties the list", () => {
  const list = listAfter([{ type: "changed", path: "a.md" }]);
  list.clear();
  expect(list.paths).toEqual([]);
});
