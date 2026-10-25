import { expect, test } from "bun:test";
import { EditorState } from "@codemirror/state";
import fc from "fast-check";
import { lineBreakOf, reactToDisk, reloadChanges } from "./disk.ts";

const v2 = { version: "v2" };

test("a change whose version equals the base is our own save", () => {
  expect(reactToDisk(v2, "v2", false)).toEqual({ kind: "ignore" });
  expect(reactToDisk(v2, "v2", true)).toEqual({ kind: "ignore" });
});

test("a change with unsaved edits shows the notice", () => {
  expect(reactToDisk(v2, "v1", true)).toEqual({ kind: "notice", disk: v2 });
});

test("a change without unsaved edits reloads", () => {
  expect(reactToDisk(v2, "v1", false)).toEqual({ kind: "reload", disk: v2 });
});

test("a removal shows the notice with nothing to reload", () => {
  expect(reactToDisk(null, "v1", true)).toEqual({ kind: "notice", disk: null });
  expect(reactToDisk(null, "v1", false)).toEqual({ kind: "notice", disk: null });
});

test("a reload keeps the cursor between two changes", () => {
  const text = "one\ntwo\nthree\nfour\nfive";
  const next = "ONE\ntwo\nthree\nfour\nFIVE";
  const cursor = text.indexOf("three") + 2;
  const state = EditorState.create({ doc: text, selection: { anchor: cursor } });
  const reloaded = state.update({ changes: reloadChanges(text, next) }).state;
  expect(reloaded.doc.toString()).toBe(next);
  expect(reloaded.selection.main.head).toBe(cursor);
});

test("a reload of a long file keeps the cursor between many changes", () => {
  const sections = Array.from({ length: 400 }, (_, i) => `## Section ${i}\n\nText ${i}.\n\n`);
  const text = sections.join("");
  const next = text.replaceAll("Section", "Chapter");
  const cursor = text.indexOf("Text 200.");
  const state = EditorState.create({ doc: text, selection: { anchor: cursor } });
  const reloaded = state.update({ changes: reloadChanges(text, next) }).state;
  expect(reloaded.doc.toString()).toBe(next);
  expect(reloaded.selection.main.head).toBe(next.indexOf("Text 200."));
});

test("a reload of a CRLF file keeps one line break per line", () => {
  const text = "# Title\n\nline one\n";
  const state = EditorState.create({ doc: text });
  const next = "# Title\r\n\r\nline ONE\r\n";
  const reloaded = state.update({ changes: reloadChanges(text, next) }).state;
  expect(reloaded.doc.toString()).toBe("# Title\n\nline ONE\n");
});

// Few distinct characters, so that the two texts share lines; the emoji is
// a surrogate pair.
const fewChars = fc.string({ unit: fc.constantFrom("a", "b", "😀", "\n", "\r") });

test("a reload gives the text on disk, as the editor loads it", () => {
  fc.assert(
    fc.property(fc.oneof(fc.string(), fewChars), fc.oneof(fc.string(), fewChars), (text, next) => {
      const state = EditorState.create({ doc: text });
      const reloaded = state.update({ changes: reloadChanges(state.doc.toString(), next) }).state;
      expect(reloaded.doc.toString()).toBe(EditorState.create({ doc: next }).doc.toString());
    }),
  );
});

test("a save keeps the line breaks of the file", () => {
  expect(lineBreakOf("a\r\nb\r\n")).toBe("\r\n");
  expect(lineBreakOf("a\nb\n")).toBe("\n");
  expect(lineBreakOf("")).toBe("\n");
});

test("a save writes the more common line break of the file", () => {
  expect(lineBreakOf("a\nb\nc\r\nd\n")).toBe("\n");
  expect(lineBreakOf("a\r\nb\r\nc\nd\r\n")).toBe("\r\n");
});
