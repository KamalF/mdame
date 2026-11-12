import { expect, test } from "bun:test";
import fc from "fast-check";
import { overRenderLimit, RENDER_LIMIT, utf8Length } from "./preview.ts";

test("utf8Length gives the length of the text in UTF-8", () => {
  const encoder = new TextEncoder();
  fc.assert(fc.property(fc.string({ unit: "grapheme" }), (text) => utf8Length(text) === encoder.encode(text).length));
});

test("overRenderLimit counts bytes, not characters", () => {
  expect(overRenderLimit("a".repeat(RENDER_LIMIT))).toBe(false);
  expect(overRenderLimit("a".repeat(RENDER_LIMIT + 1))).toBe(true);
  // 2 bytes each.
  expect(overRenderLimit("é".repeat(RENDER_LIMIT / 2))).toBe(false);
  expect(overRenderLimit("é".repeat(RENDER_LIMIT / 2 + 1))).toBe(true);
  // 4 bytes each, in 2 units.
  expect(overRenderLimit("😀".repeat(RENDER_LIMIT / 4 + 1))).toBe(true);
});
