import { indentMore } from "@codemirror/commands";
import { EditorSelection, type StateCommand } from "@codemirror/state";

function leadingRun(text: string): string {
  return /^(\*+|_+)/.exec(text)?.[0] ?? "";
}

function trailingRun(text: string): string {
  return /(\*+|_+)$/.exec(text)?.[0] ?? "";
}

/**
 * Whether the runs of `*` or `_` on the two sides of a text hold `marker`.
 * In a run, each pair is bold and a leftover one is italic, so `***a***`
 * is both.
 */
function holds(marker: string, left: string, right: string): boolean {
  if (!left || left[0] !== right[0]) return false;
  return marker.length === 2
    ? left.length >= 2 && right.length >= 2
    : left.length % 2 === 1 && right.length % 2 === 1;
}

/**
 * Wraps each selection in `marker` (`**` or `*`). If the markers are
 * already there, just outside the selection or at its two ends, removes
 * them instead. On an empty selection, the cursor lands between the
 * markers.
 */
export function toggleMarker(marker: string): StateCommand {
  const n = marker.length;
  return ({ state, dispatch }) => {
    const changes = state.changeByRange(({ from, to }) => {
      const before = state.sliceDoc(state.doc.lineAt(from).from, from);
      const after = state.sliceDoc(to, state.doc.lineAt(to).to);
      if (holds(marker, trailingRun(before), leadingRun(after))) {
        return {
          changes: [
            { from: from - n, to: from },
            { from: to, to: to + n },
          ],
          range: EditorSelection.range(from - n, to - n),
        };
      }
      const text = state.sliceDoc(from, to);
      if (text.length >= 2 * n && holds(marker, leadingRun(text), trailingRun(text))) {
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

export const tab: StateCommand = ({ state, dispatch }) => {
  if (state.selection.ranges.some((range) => !range.empty)) return indentMore({ state, dispatch });
  dispatch(
    state.update(state.replaceSelection("  "), { scrollIntoView: true, userEvent: "input" }),
  );
  return true;
};
