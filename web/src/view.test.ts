import { expect, test } from "bun:test";
import fc from "fast-check";
import { workspacePath } from "./arbitrary.ts";
import { viewUrl } from "./sidebar.ts";
import { rawUrl, viewHref } from "./view.ts";

test("rawUrl encodes each part and keeps the slashes", () => {
  expect(rawUrl("docs/a b#1.md")).toBe("/raw/docs/a%20b%231.md");
});

test("viewHref sends links to /raw/ to the app, others as they are", () => {
  fc.assert(fc.property(workspacePath, (path) => viewHref(rawUrl(path)) === viewUrl(path)));
  expect(viewHref("/raw/docs/a%20b.md#usage")).toBe("/view/docs/a%20b.md#usage");
  expect(viewHref("https://example.com/raw/a.md")).toBe("https://example.com/raw/a.md");
  expect(viewHref("#top")).toBe("#top");
});
