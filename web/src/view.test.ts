import { expect, test } from "bun:test";
import { rawPath, rawUrl } from "./view.ts";

test("rawPath decodes a /raw/ URL path", () => {
  expect(rawPath("/raw/docs/a%20b.md")).toBe("docs/a b.md");
  expect(rawPath("/raw/%E0")).toBe(null);
  expect(rawPath("/view/a.md")).toBe(null);
});

test("rawUrl encodes each part and keeps the slashes", () => {
  expect(rawUrl("docs/a b#1.md")).toBe("/raw/docs/a%20b%231.md");
  expect(rawPath(rawUrl("docs/a b#1.md"))).toBe("docs/a b#1.md");
});
