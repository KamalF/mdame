import { expect, test } from "bun:test";
import fc from "fast-check";
import { anchorTable, lineToTop, topToLine } from "./scrollsync.ts";

// Blocks at lines 3, 10 and 20 of a 29-line source, in a 1000 px preview.
const table = anchorTable(
  [
    { line: 3, top: 100 },
    { line: 10, top: 400 },
    { line: 20, top: 600 },
  ],
  29,
  1000,
);

test("maps a line to the last block starting at or before it", () => {
  expect(lineToTop(table, 10)).toBe(400);
  expect(lineToTop(table, 20)).toBe(600);
});

test("interpolates towards the next block", () => {
  expect(lineToTop(table, 15)).toBe(500);
  expect(topToLine(table, 500)).toBe(15);
});

test("before the first block is the top", () => {
  expect(lineToTop(table, 1)).toBe(0);
  expect(lineToTop(table, 2)).toBe(50);
});

test("past the last block is the end", () => {
  expect(lineToTop(table, 30)).toBe(1000);
  expect(lineToTop(table, 40)).toBe(1000);
  expect(topToLine(table, 1200)).toBe(30);
});

test("a block that would move back is skipped", () => {
  const blocks = [
    { line: 5, top: 200 },
    // A nested element on the line of its parent.
    { line: 5, top: 210 },
    // A footnote, rendered after the block of line 5.
    { line: 3, top: 300 },
    { line: 8, top: 250 },
  ];
  expect(anchorTable(blocks, 9, 400)).toEqual([
    { line: 1, top: 0 },
    { line: 5, top: 200 },
    { line: 8, top: 250 },
    { line: 10, top: 400 },
  ]);
});

test("preview to editor inverts editor to preview", () => {
  const block = fc.record({ line: fc.integer({ min: 1, max: 500 }), top: fc.nat(20000) });
  const setup = fc.record({
    blocks: fc.array(block, { maxLength: 30 }).map((blocks) => blocks.sort((a, b) => a.line - b.line)),
    lines: fc.integer({ min: 1, max: 500 }),
    height: fc.integer({ min: 1, max: 20000 }),
  });
  fc.assert(
    fc.property(setup, fc.double({ min: 0, max: 1, noNaN: true }), ({ blocks, lines, height }, at) => {
      const table = anchorTable(blocks, lines, height);
      // Past the last anchor, every line maps to the end of the preview.
      const line = 1 + at * (table[table.length - 1].line - 1);
      expect(topToLine(table, lineToTop(table, line))).toBeCloseTo(line, 6);
    }),
  );
});
