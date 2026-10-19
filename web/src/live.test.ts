import { expect, test } from "bun:test";
import { isWithin, movedPath, retryDelay } from "./live.ts";

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
