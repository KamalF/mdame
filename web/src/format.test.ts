import { expect, test } from "bun:test";
import { EditorSelection, EditorState, type StateCommand } from "@codemirror/state";
import { tab, toggleMarker } from "./format.ts";

const bold = toggleMarker("**");
const italic = toggleMarker("*");

/**
 * Runs `command` on `doc`, where `[` and `]` mark the selection and `|`
 * the cursor, and returns the result written the same way.
 */
function run(command: StateCommand, doc: string): string {
  const from = doc.search(/[[|]/);
  const to = doc.includes("|") ? from : doc.indexOf("]") - 1;
  let state = EditorState.create({
    doc: doc.replace(/[[\]|]/g, ""),
    selection: EditorSelection.single(from, to),
  });
  command({ state, dispatch: (tr) => (state = tr.state) });
  const { from: start, to: end } = state.selection.main;
  const text = state.doc.toString();
  if (start === end) return `${text.slice(0, start)}|${text.slice(start)}`;
  return `${text.slice(0, start)}[${text.slice(start, end)}]${text.slice(end)}`;
}

test("bold wraps the selection", () => {
  expect(run(bold, "say [hi] now")).toBe("say **[hi]** now");
});

test("bold unwraps an already bold selection", () => {
  expect(run(bold, "say **[hi]** now")).toBe("say [hi] now");
  expect(run(bold, "say [**hi**] now")).toBe("say [hi] now");
  expect(run(bold, "say __[hi]__ now")).toBe("say [hi] now");
});

test("bold on an empty selection puts the cursor between markers", () => {
  expect(run(bold, "say | now")).toBe("say **|** now");
  expect(run(bold, "say **|** now")).toBe("say | now");
});

test("italic wraps the selection", () => {
  expect(run(italic, "say [hi] now")).toBe("say *[hi]* now");
});

test("italic unwraps an already italic selection", () => {
  expect(run(italic, "say *[hi]* now")).toBe("say [hi] now");
  expect(run(italic, "say [*hi*] now")).toBe("say [hi] now");
  expect(run(italic, "say _[hi]_ now")).toBe("say [hi] now");
});

test("italic on an empty selection puts the cursor between markers", () => {
  expect(run(italic, "say | now")).toBe("say *|* now");
  expect(run(italic, "say *|* now")).toBe("say | now");
});

test("bold and italic stack", () => {
  expect(run(bold, "say *[hi]* now")).toBe("say ***[hi]*** now");
  expect(run(italic, "say **[hi]** now")).toBe("say ***[hi]*** now");
  expect(run(bold, "say ***[hi]*** now")).toBe("say *[hi]* now");
  expect(run(italic, "say ***[hi]*** now")).toBe("say **[hi]** now");
});

test("tab inserts two spaces at the cursor", () => {
  expect(run(tab, "a|b")).toBe("a  |b");
});

test("tab indents the selected lines", () => {
  expect(run(tab, "a[b\nc]d")).toBe("  a[b\n  c]d");
});
