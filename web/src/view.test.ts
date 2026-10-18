import { expect, test } from "bun:test";
import { rawPath } from "./view.ts";

test("rawPath decodes a /raw/ URL path", () => {
  expect(rawPath("/raw/docs/a%20b.md")).toBe("docs/a b.md");
  expect(rawPath("/raw/%E0")).toBe(null);
  expect(rawPath("/view/a.md")).toBe(null);
});
