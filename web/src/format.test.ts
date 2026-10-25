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
});

test("bold wraps a selection over two bold spans", () => {
  expect(run(bold, "[**a** and **b**]")).toBe("**[**a** and **b**]**");
  expect(run(bold, "**[a** and **b]**")).toBe("****[a** and **b]****");
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
});

test("italic around a selected bold span toggles back", () => {
  expect(run(italic, "[**hi**]")).toBe("*[**hi**]*");
  expect(run(italic, "*[**hi**]*")).toBe("[**hi**]");
  expect(run(bold, "**[*hi*]**")).toBe("[*hi*]");
});

test("bold leaves out the line break of a selected line", () => {
  expect(run(bold, "[Hello world\n]Next")).toBe("**[Hello world]**\nNext");
  expect(run(bold, "[**Hello world**\n]Next")).toBe("[Hello world]\nNext");
  expect(run(italic, "[ hi ]")).toBe(" *[hi]* ");
});

test("an escaped star is not a marker", () => {
  expect(run(italic, "\\*[a]*")).toBe("\\**[a]**");
  expect(run(italic, "\\[*a*] b")).toBe("\\*[*a*]* b");
  // An escaped backslash escapes nothing after it.
  expect(run(italic, "\\\\*[a]* b")).toBe("\\\\[a] b");
});

test("underscores are not markers", () => {
  expect(run(italic, "my_[bar]_var")).toBe("my_*[bar]*_var");
  expect(run(italic, "[_bar_]")).toBe("*[_bar_]*");
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
