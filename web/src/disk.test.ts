import { expect, test } from "bun:test";
import { EditorState } from "@codemirror/state";
import fc from "fast-check";
import { reactToDisk, reloadChanges } from "./disk.ts";

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

test("a reload gives the text on disk", () => {
  fc.assert(
    fc.property(fc.string(), fc.string(), (text, next) => {
      const state = EditorState.create({ doc: text });
      const reloaded = state.update({ changes: reloadChanges(text, next) }).state;
      expect(reloaded.doc.toString()).toBe(next);
    }),
  );
});
