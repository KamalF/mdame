import { expect, test } from "bun:test";
import { blockOf, marks, Seen } from "./changes.ts";

test("blockOf reads the lines, and an end at column 0 ends the line before", () => {
  expect(blockOf("3:1-5:12")).toEqual({ start: 3, end: 5 });
  expect(blockOf("6:1-8:0")).toEqual({ start: 6, end: 7 });
  expect(blockOf("x")).toBe(null);
});

// The blocks of "# T", a blank line, "One.", a blank line and "Two.".
const twoParagraphs = [
  { start: 1, end: 1 },
  { start: 3, end: 3 },
  { start: 5, end: 5 },
];

test("an added paragraph is marked added", () => {
  expect(marks("# T\n\nOne.\n", "# T\n\nOne.\n\nTwo.\n", twoParagraphs)).toEqual([
    { kind: "added", block: 2 },
  ]);
});

test("a changed list item marks the item, not the list", () => {
  // As comrak gives them: the list, "one", "two" with its nested list,
  // that list, and "nested".
  const blocks = [
    { start: 1, end: 3 },
    { start: 1, end: 1 },
    { start: 2, end: 3 },
    { start: 3, end: 3 },
    { start: 3, end: 3 },
  ];
  const before = "- one\n- two\n  - nested\n";
  expect(marks(before, "- one\n- TWO\n  - nested\n", blocks)).toEqual([
    { kind: "changed", block: 2 },
  ]);
  expect(marks(before, "- one\n- two\n  - NESTED\n", blocks)).toEqual([
    { kind: "changed", block: 4 },
  ]);
});

test("a block added to a loose list or a quote marks the block, not its container", () => {
  // The heading, the list, then each item and its paragraph, then "After.".
  const list = [{ start: 1, end: 1 }, { start: 3, end: 9 }];
  for (const line of [3, 5, 7, 9]) list.push({ start: line, end: line }, { start: line, end: line });
  list.push({ start: 11, end: 11 });
  const loose = "# Plan\n\n- one\n\n- two\n\n- three\n\nAfter.\n";
  const added = "# Plan\n\n- one\n\n- two\n\n- new\n\n- three\n\nAfter.\n";
  expect(marks(loose, added, list)).toEqual([{ kind: "added", block: 7 }]);
  // The quote, then its paragraphs.
  const quote = [
    { start: 1, end: 5 },
    { start: 1, end: 1 },
    { start: 3, end: 3 },
    { start: 5, end: 5 },
  ];
  expect(marks("> one\n>\n> two\n", "> one\n>\n> two\n>\n> three\n", quote)).toEqual([
    { kind: "added", block: 3 },
  ]);
  // In a code block, an added blank line alone shows.
  expect(marks("```\na\nb\n```\n", "```\na\n\nb\n```\n", [{ start: 1, end: 5 }])).toEqual([
    { kind: "changed", block: 0 },
  ]);
});

test("removed text marks the place where it was", () => {
  const two = [
    { start: 1, end: 1 },
    { start: 3, end: 3 },
  ];
  expect(marks("A.\n\nB.\n\nC.\n", "A.\n\nC.\n", two)).toEqual([{ kind: "removed", block: 1 }]);
  // At the end: below the last block.
  expect(marks("A.\n\nC.\n\nD.\n", "A.\n\nC.\n", two)).toEqual([{ kind: "removed", block: 2 }]);
  // Replaced by blank lines.
  const apart = [
    { start: 1, end: 1 },
    { start: 5, end: 5 },
  ];
  expect(marks("A.\n\nB.\n\nC.\n", "A.\n\n\n\nC.\n", apart)).toEqual([
    { kind: "removed", block: 1 },
  ]);
  // Changed in lines that no block shows, such as front matter: no mark.
  expect(marks("---\na: 1\n---\n\nA.\n", "---\na: 2\n---\n\nA.\n", [{ start: 5, end: 5 }])).toEqual(
    [],
  );
  // Inside a block, the block changed.
  expect(marks("a\nb\nc\n", "a\nc\n", [{ start: 1, end: 2 }])).toEqual([
    { kind: "changed", block: 0 },
  ]);
});

test("removed blank lines between blocks mark nothing", () => {
  const two = [
    { start: 1, end: 1 },
    { start: 3, end: 3 },
  ];
  expect(marks("A.\n\nB.\n", "A.\n\nB.", two)).toEqual([]);
  expect(marks("A.\n\n\nB.\n", "A.\n\nB.\n", two)).toEqual([]);
  // In a code block, a blank line shows.
  expect(marks("```\na\n\nb\n```\n", "```\na\nb\n```\n", [{ start: 1, end: 4 }])).toEqual([
    { kind: "changed", block: 0 },
  ]);
});

test("an undone change loses its bar", () => {
  const seen = new Seen();
  const before = "# T\n\nOne.\n";
  const baseline = seen.baseline("a.md", before);
  expect(marks(baseline, "# T\n\nOne!\n", twoParagraphs)).toEqual([{ kind: "changed", block: 1 }]);
  expect(marks(seen.baseline("a.md", before), before, twoParagraphs)).toEqual([]);
});

test("a file shown for the first time has no bars", () => {
  const seen = new Seen();
  const text = "# T\n\nOne.\n\nTwo.\n";
  expect(marks(seen.baseline("a.md", text), text, twoParagraphs)).toEqual([]);
});

test("leaving a file makes the version on screen the one last seen", () => {
  const seen = new Seen();
  seen.baseline("a.md", "v1");
  seen.leave("a.md", "v2");
  expect(seen.baseline("a.md", "v3")).toBe("v2");
});

test("a renamed file keeps the version last seen", () => {
  const seen = new Seen();
  seen.baseline("a.md", "v1");
  seen.rename("a.md", "b.md");
  expect(seen.baseline("b.md", "v2")).toBe("v1");
  expect(seen.baseline("a.md", "v3")).toBe("v3");
});
