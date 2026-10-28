import { expect, test } from "bun:test";
import { Chunk } from "@codemirror/merge";
import { Text } from "@codemirror/state";
import { dayOf, lineCounts, sizeLabel } from "./revisions.ts";

test("dayOf says today, yesterday, or neither, across midnight", () => {
  const now = new Date(2026, 9, 1, 0, 30);
  expect(dayOf(new Date(2026, 9, 1, 0, 5), now)).toBe("today");
  expect(dayOf(new Date(2026, 8, 30, 23, 55), now)).toBe("yesterday");
  expect(dayOf(new Date(2026, 8, 29, 23, 55), now)).toBe(null);
});

test("sizeLabel gives bytes, then KB and MB with one decimal", () => {
  expect([1023, 1024, 1536, 1024 * 1024].map(sizeLabel)).toEqual([
    "1023 B",
    "1.0 KB",
    "1.5 KB",
    "1.0 MB",
  ]);
});

test("lineCounts counts a changed line once as added and once as removed", () => {
  const cases: [string, string, { added: number; removed: number }][] = [
    ["a\nb\nc\n", "a\nB\nc\n", { added: 1, removed: 1 }],
    ["a\nb\nc\n", "a\nb\nc\nd\ne\n", { added: 2, removed: 0 }],
    ["a\nb\nc\n", "a\n", { added: 0, removed: 2 }],
    ["a\nb\nc\n", "a\nb\nc\n", { added: 0, removed: 0 }],
  ];
  for (const [revision, text, counts] of cases) {
    const a = Text.of(revision.split("\n"));
    const b = Text.of(text.split("\n"));
    expect(lineCounts(Chunk.build(a, b), a, b)).toEqual(counts);
  }
});
