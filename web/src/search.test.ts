import { expect, test } from "bun:test";
import { blockAt, highlight, runs } from "./search.ts";

test("the match is highlighted whatever its case", () => {
  expect(highlight("Retry, then RETRY.", "retry")).toEqual([
    { text: "Retry", match: true },
    { text: ", then ", match: false },
    { text: "RETRY", match: true },
    { text: ".", match: false },
  ]);
  // An uppercase letter makes the case count, as on the server.
  expect(highlight("Retry, then retry", "Retry")).toEqual([
    { text: "Retry", match: true },
    { text: ", then retry", match: false },
  ]);
  // The phrase is literal.
  expect(highlight("a.b axb", "a.b")).toEqual([
    { text: "a.b", match: true },
    { text: " axb", match: false },
  ]);
});

test("the preview breaks where the line numbers jump", () => {
  const lines = [1, 2, 3, 5, 6, 9].map((number) => ({ number }));
  expect(runs(lines).map((run) => run.map((line) => line.number))).toEqual([
    [1, 2, 3],
    [5, 6],
    [9],
  ]);
});

test("a line maps to the block that holds it", () => {
  // A heading, a list, its item with a nested list, and that nested item.
  const blocks = [
    { start: 1, end: 1 },
    { start: 3, end: 5 },
    { start: 3, end: 5 },
    { start: 5, end: 5 },
    { start: 5, end: 5 },
  ];
  expect(blockAt(blocks, 1)).toBe(0);
  expect(blockAt(blocks, 4)).toBe(2);
  expect(blockAt(blocks, 5)).toBe(4);
  // A blank line, or a raw HTML block: the nearest block above.
  expect(blockAt(blocks, 2)).toBe(0);
  expect(blockAt(blocks, 9)).toBe(4);
  // Front matter, above every block.
  expect(blockAt([{ start: 4, end: 4 }], 2)).toBe(-1);
});
