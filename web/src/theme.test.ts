import { expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { BUILT_INS, media } from "./stylesheets.ts";
import { chosen, label } from "./theme.ts";

test("each built-in theme has a name in the menu, and a user theme shows its file name", () => {
  for (const file of readdirSync(`${import.meta.dir}/../themes`).filter((f) => f.endsWith(".css"))) {
    const theme = file.slice(0, -".css".length);
    expect(label(theme)).not.toBe(theme);
  }
  expect(label("catppuccin-frappe")).toBe("Catppuccin Frappé");
  expect(label("gruvbox-dark")).toBe("gruvbox-dark");
});

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
