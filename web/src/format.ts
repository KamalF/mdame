import { indentMore } from "@codemirror/commands";
import { EditorSelection, type StateCommand } from "@codemirror/state";

/**
 * The run of `*` that starts `text`, where `before` is the text in front of
 * it. A `*` after an odd number of backslashes is a literal star, not a
 * marker.
 */
function leadingRun(text: string, before: string): string {
  const run = /^\*+/.exec(text)?.[0] ?? "";
  return escaped(before) ? run.slice(1) : run;
}

function trailingRun(text: string): string {
  const run = /\*+$/.exec(text)?.[0] ?? "";
  return escaped(text.slice(0, text.length - run.length)) ? run.slice(1) : run;
}

/** Whether the character after `text` is escaped. */
function escaped(text: string): boolean {
  return /\\*$/.exec(text)![0].length % 2 === 1;
}

/**
 * Whether the runs of `*` on the two sides of a text hold `marker`. In a
 * run, each pair is bold and a leftover one is italic, so `***a***` is
 * both.
 */
function holds(marker: string, left: string, right: string): boolean {
  return marker.length === 2
    ? left.length >= 2 && right.length >= 2
    : left.length % 2 === 1 && right.length % 2 === 1;
}

/**
 * Wraps each selection in `marker` (`**` or `*`). If the markers are
 * already there, just outside the selection or at its two ends, removes
 * them instead. Only the markers of one span count: `**a** and **b**`
 * gets wrapped. `_` never counts, since it is often part of a name such
 * as `my_var`. On an empty selection, the cursor lands between the
 * markers.
 */
export function toggleMarker(marker: string): StateCommand {
  const n = marker.length;
  return ({ state, dispatch }) => {
    const changes = state.changeByRange((range) => {
      const { from, to } = inward(state.sliceDoc(range.from, range.to), range.from);
      const before = state.sliceDoc(state.doc.lineAt(from).from, from);
      const after = state.sliceDoc(to, state.doc.lineAt(to).to);
      const text = state.sliceDoc(from, to);
      const left = leadingRun(text, before);
      const right = trailingRun(text);
      // Empty when the whole text is one run of `*`.
      const inner = text.slice(left.length, text.length - right.length);
      const oneSpan = !inner.includes("*");
      if (oneSpan && holds(marker, trailingRun(before), leadingRun(after, before + text))) {
        return {
          changes: [
            { from: from - n, to: from },
            { from: to, to: to + n },
          ],
          range: EditorSelection.range(from - n, to - n),
        };
      }
      if (inner && oneSpan && holds(marker, left, right)) {
        return {
          changes: [
            { from, to: from + n },
            { from: to - n, to },
          ],
          range: EditorSelection.range(from, to - 2 * n),
        };
      }
      return {
        changes: [
          { from, insert: marker },
          { from: to, insert: marker },
        ],
        range: EditorSelection.range(from + n, to + n),
      };
    });
    dispatch(state.update(changes, { scrollIntoView: true, userEvent: "input" }));
    return true;
  };
}

/**
 * The range of `text`, which starts at `from`, without spaces and line
 * breaks at its ends. A triple-click selects the line break too, and
 * CommonMark accepts no marker after a line break or before a space.
 */
function inward(text: string, from: number): { from: number; to: number } {
  const start = text.length - text.trimStart().length;
  const end = text.trimEnd().length;
  return start < end ? { from: from + start, to: from + end } : { from, to: from + text.length };
}

export const tab: StateCommand = ({ state, dispatch }) => {
  if (state.selection.ranges.some((range) => !range.empty)) return indentMore({ state, dispatch });
  dispatch(
    state.update(state.replaceSelection("  "), { scrollIntoView: true, userEvent: "input" }),
  );
  return true;
};
