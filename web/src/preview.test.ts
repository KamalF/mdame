import { expect, test } from "bun:test";
import { overRenderLimit, RENDER_LIMIT } from "./preview.ts";

test("overRenderLimit counts bytes, not characters", () => {
  expect(overRenderLimit("a".repeat(RENDER_LIMIT))).toBe(false);
  expect(overRenderLimit("a".repeat(RENDER_LIMIT + 1))).toBe(true);
  // 2 bytes each.
  expect(overRenderLimit("é".repeat(RENDER_LIMIT / 2))).toBe(false);
  expect(overRenderLimit("é".repeat(RENDER_LIMIT / 2 + 1))).toBe(true);
  // 4 bytes each, in 2 units.
  expect(overRenderLimit("😀".repeat(RENDER_LIMIT / 4 + 1))).toBe(true);
});
