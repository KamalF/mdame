import { expect, test } from "bun:test";
import { BUILT_INS, chosen, media } from "./theme.ts";

test("system follows prefers-color-scheme", () => {
  expect(media("dark", null)).toBe("(prefers-color-scheme: dark)");
  expect(media("light", null)).toBe("not all and (prefers-color-scheme: dark)");
});

test("a stored choice wins", () => {
  expect(chosen("light", BUILT_INS)).toBe("light");
  expect(chosen("nord", [...BUILT_INS, "nord"])).toBe("nord");
  expect(media("light", "light")).toBe("all");
  expect(media("dark", "light")).toBe("not all");
});

test("an unknown stored theme falls back to system", () => {
  for (const stored of ["nothing", 42, null]) {
    expect(chosen(stored, BUILT_INS)).toBe(null);
  }
});
