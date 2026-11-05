import { expect, test } from "bun:test";
import { Chunk } from "@codemirror/merge";
import { Text } from "@codemirror/state";
import {
  dayOf,
  entries,
  LAST_SEEN,
  lineCounts,
  restoreRequest,
  sizeLabel,
} from "./revisions.ts";

test("dayOf says today, yesterday, or neither, across midnight", () => {
  const now = new Date(2026, 9, 1, 0, 30);
  expect(dayOf(new Date(2026, 9, 1, 0, 5), now)).toBe("Today");
  expect(dayOf(new Date(2026, 8, 30, 23, 55), now)).toBe("Yesterday");
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

const listed = [
  { id: "2000.md", time: 2000, size: 4 },
  { id: "1000.md", time: 1000, size: 3 },
];

test("last seen comes first when the file changed", () => {
  const onDisk = Text.of(["# B", ""]);
  expect(entries(listed, "# Á\n", onDisk)).toEqual([
    { id: LAST_SEEN, time: null, size: 5 },
    ...listed,
  ]);
});

test("no last seen entry when the file is unchanged", () => {
  const onDisk = Text.of(["# A", ""]);
  expect(entries(listed, "# A\n", onDisk)).toEqual(listed);
  // The editor's text has `\n` only.
  expect(entries(listed, "# A\r\n", onDisk)).toEqual(listed);
  // A file that the view never showed.
  expect(entries(listed, undefined, onDisk)).toEqual(listed);
});

test("restoring last seen saves its text", () => {
  expect(restoreRequest("a b.md", LAST_SEEN, "# A\n", '"v1"')).toEqual({
    method: "PUT",
    url: "/api/file?path=a%20b.md",
    body: { content: "# A\n" },
    headers: { "If-Match": '"v1"' },
  });
  // A revision is restored by the server, from its snapshot.
  expect(restoreRequest("a.md", "1000.md", "# A\n", '"v1"')).toEqual({
    method: "POST",
    url: "/api/history/restore",
    body: { path: "a.md", id: "1000.md" },
    headers: {},
  });
});
