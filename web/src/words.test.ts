import { expect, test } from "bun:test";
import { countWords, wordLabel } from "./words.ts";

test("words are counted without punctuation, numbers included", () => {
  expect(countWords("Hello, world! It's 2026 — a new day.")).toBe(7);
  expect(countWords("  ")).toBe(0);
});

test("words are counted in a script with no spaces", () => {
  expect(countWords("我喜欢读书")).toBeGreaterThan(1);
});

test("the label gives the words and the reading time, at least a minute", () => {
  expect(wordLabel(0)).toBe(null);
  expect(wordLabel(1)).toBe("1 word · 1 min");
  expect(wordLabel(1234)).toBe("1,234 words · 6 min");
});
