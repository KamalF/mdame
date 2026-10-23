import { expect, test } from "bun:test";
import { concerns, type LiveEvent, isWithin, movedPath, react, retryDelay } from "./live.ts";

test("retryDelay doubles from 500 ms and stops at 10 s", () => {
  expect([0, 1, 2, 3, 4, 5, 6].map(retryDelay)).toEqual([
    500, 1000, 2000, 4000, 8000, 10000, 10000,
  ]);
});

test("isWithin matches the path itself and what a folder holds", () => {
  expect(isWithin("docs/a.md", "docs/a.md")).toBe(true);
  expect(isWithin("docs/a.md", "docs")).toBe(true);
  expect(isWithin("docs-old/a.md", "docs")).toBe(false);
  expect(isWithin("docs", "docs/a.md")).toBe(false);
});

test("movedPath follows a file and a file inside a moved folder", () => {
  expect(movedPath("a.md", "a.md", "b.md")).toBe("b.md");
  expect(movedPath("docs/sub/a.md", "docs", "guide")).toBe("guide/sub/a.md");
  expect(movedPath("docs-old/a.md", "docs", "guide")).toBe(null);
});

test("react reloads on resync, and on a workspace only from the picker", () => {
  const workspace: LiveEvent = { type: "workspace", root: "/ws" };
  expect(react(workspace, null, true, () => false)).toEqual({ kind: "reload" });
  expect(react(workspace, "a.md", false, () => false)).toEqual({ kind: "ignore" });
  expect(react({ type: "resync" }, "a.md", false, () => false)).toEqual({ kind: "reload" });
});

test("react reloads the tree unless a change keeps the sort", () => {
  const changed: LiveEvent = { type: "changed", path: "a.md" };
  expect(react(changed, null, false, () => false)).toMatchObject({ tree: false });
  expect(react(changed, null, false, () => true)).toMatchObject({ tree: true });
  const created: LiveEvent = { type: "created", path: "a.md" };
  expect(react(created, null, false, () => false)).toMatchObject({ tree: true });
});

test("react refreshes or follows the open file", () => {
  const cases: [LiveEvent, Partial<{ refresh: boolean; followTo: string | null }>][] = [
    [{ type: "changed", path: "docs/a.md" }, { refresh: true }],
    [{ type: "changed", path: "docs/b.md" }, { refresh: false }],
    [{ type: "removed", path: "docs" }, { refresh: true }],
    [{ type: "created", path: "docs/a.md" }, { refresh: true }],
    [{ type: "renamed", from: "docs/a.md", to: "b.md" }, { followTo: "b.md" }],
    [{ type: "renamed", from: "docs", to: "guide" }, { followTo: "guide/a.md" }],
    // A save through a rename: the file stays where it is.
    [{ type: "renamed", from: "docs/a.md.tmp", to: "docs/a.md" }, { refresh: true, followTo: null }],
    [{ type: "renamed", from: "docs/b.md", to: "c.md" }, { refresh: false, followTo: null }],
  ];
  for (const [event, expected] of cases) {
    expect(react(event, "docs/a.md", false, () => false)).toMatchObject(expected);
  }
});

test("concerns names the open file, a folder holding it, and either end of a rename", () => {
  const cases: [LiveEvent, boolean][] = [
    [{ type: "changed", path: "docs/a.md" }, true],
    [{ type: "removed", path: "docs" }, true],
    [{ type: "renamed", from: "docs/a.md", to: "b.md" }, true],
    [{ type: "renamed", from: "docs/a.md.tmp", to: "docs/a.md" }, true],
    [{ type: "changed", path: "docs/b.md" }, false],
    [{ type: "resync" }, false],
  ];
  for (const [event, expected] of cases) {
    expect(concerns(event, "docs/a.md")).toBe(expected);
  }
});
