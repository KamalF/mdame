import { diff } from "@codemirror/merge";
import type { ChangeSpec } from "@codemirror/state";

/**
 * What the editor does when its file may have changed on disk. `disk` is
 * what a reload would load: null when the file is gone.
 */
export type DiskReaction<T> =
  | { kind: "ignore" }
  | { kind: "reload"; disk: T }
  | { kind: "notice"; disk: T | null };

/**
 * `disk` is the file on disk, or null when it is gone, and `base` is the
 * version that the editor's text started from.
 */
export function reactToDisk<T extends { version: string }>(
  disk: T | null,
  base: string,
  dirty: boolean,
): DiskReaction<T> {
  // Our own save, or the same content written again.
  if (disk?.version === base) return { kind: "ignore" };
  if (disk && !dirty) return { kind: "reload", disk };
  return { kind: "notice", disk };
}

/**
 * The changes that turn `text` into `next`, only where the two differ, so
 * that the cursor and the scroll stay on the same text.
 */
export function reloadChanges(text: string, next: string): ChangeSpec[] {
  // The editor's text breaks lines with `\n` only: a `\r` inserted before
  // one would be a second line break.
  next = next.replace(/\r\n?/g, "\n");
  // Lines first, then characters inside the changed lines. Above about
  // 16 KB of changes, a character diff alone gives one change for the
  // whole text, and the cursor jumps. As in diff-match-patch, each
  // distinct line becomes one character.
  const linesA = text.split(/(?<=\n)/);
  const linesB = next.split(/(?<=\n)/);
  const codes = new Map<string, string>();
  const encode = (lines: string[]) =>
    lines
      .map((line) => {
        let code = codes.get(line);
        if (code === undefined) codes.set(line, (code = String.fromCharCode(codes.size)));
        return code;
      })
      .join("");
  const a = encode(linesA);
  const b = encode(linesB);
  // From 0xD800 on, the codes would form surrogate pairs.
  if (codes.size > 0xd800) return charChanges(text, next, 0);
  const startA = starts(linesA);
  const startB = starts(linesB);
  // A higher limit keeps the cursor across more changed lines. Timed on
  // texts up to 8 MB: at most 0.3 s with 5000, but 6 s with 20000.
  return diff(a, b, { scanLimit: 5000 }).flatMap((change) => {
    const from = startA[change.fromA];
    const to = startA[change.toA];
    return charChanges(text.slice(from, to), next.slice(startB[change.fromB], startB[change.toB]), from);
  });
}

/** The line break that a save writes back, since the editor's text uses
 * `\n` only: the more common one, so that one pasted line does not change
 * every line of the file. */
export function lineBreakOf(content: string): string {
  const crlf = content.split("\r\n").length - 1;
  const lf = content.split("\n").length - 1 - crlf;
  return crlf > lf ? "\r\n" : "\n";
}

function charChanges(text: string, next: string, offset: number): ChangeSpec[] {
  // The merge view's own limit: very different texts get a coarser diff
  // rather than a quadratic one.
  return diff(text, next, { scanLimit: 500 }).map((change) => ({
    from: offset + change.fromA,
    to: offset + change.toA,
    insert: next.slice(change.fromB, change.toB),
  }));
}

/** Where each line starts, then where the text ends. */
function starts(lines: string[]): number[] {
  const at = [0];
  for (const line of lines) at.push(at[at.length - 1] + line.length);
  return at;
}
