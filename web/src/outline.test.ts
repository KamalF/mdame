import { expect, test } from "bun:test";
import type { Mark } from "./changes.ts";
import { entries, place, ROOM } from "./outline.ts";

const heading = (level: number, line: number) => ({ level, line });

test("only h2 and h3 are listed", () => {
  const headings = [1, 2, 3, 4, 2, 5, 6].map((level, index) => heading(level, index * 2 + 1));
  expect(entries(headings, [], []).map(({ level }) => level)).toEqual([2, 3, 2]);
});

test("fewer than 3 headings give no outline", () => {
  // The h1 and the h4 do not count.
  expect(entries([heading(1, 1), heading(2, 3), heading(4, 5), heading(3, 7)], [], [])).toEqual([]);
});

test("a section with a change bar gets a dot", () => {
  // One block per odd line: the headings, each with a paragraph below.
  const headings = [[1, 1], [2, 5], [3, 9], [4, 13], [2, 17], [1, 21]].map(([level, line]) =>
    heading(level, line),
  );
  const blocks = Array.from({ length: 12 }, (_, index) => index * 2 + 1).map((line) => ({
    start: line,
    end: line,
  }));
  const dots = (mark: Mark) => entries(headings, [mark], blocks).map(({ dot }) => dot);
  // Before the first entry.
  expect(dots({ kind: "changed", block: 1 })).toEqual([false, false, false]);
  expect(dots({ kind: "added", block: 3 })).toEqual([true, false, false]);
  // The h4 does not end the section of the h3.
  expect(dots({ kind: "changed", block: 7 })).toEqual([false, true, false]);
  expect(dots({ kind: "changed", block: 8 })).toEqual([false, false, true]);
  // Removed above the h2 of line 17: the text was in the section before.
  expect(dots({ kind: "removed", block: 8 })).toEqual([false, true, false]);
  // After the second h1.
  expect(dots({ kind: "changed", block: 11 })).toEqual([false, false, false]);
  expect(dots({ kind: "removed", block: 12 })).toEqual([false, false, false]);
});

test("the outline fits beside a centred column", () => {
  expect(place(1600, 600, false)).toEqual({ left: 500, width: 600 });
});

test("without room the column moves left", () => {
  // Centred, the column would leave 200 px at its right.
  expect(place(1000, 600, false)).toEqual({ left: 1000 - 600 - ROOM, width: 600 });
});

test("with full the column narrows", () => {
  expect(place(1200, 1200, true)).toEqual({ left: 0, width: 1200 - ROOM });
});

test("when moving is not enough the outline hides", () => {
  expect(place(800, 600, false)).toBe(null);
  // Full narrows the column to 480 px at least.
  expect(place(480 + ROOM - 1, 480 + ROOM - 1, true)).toBe(null);
});
