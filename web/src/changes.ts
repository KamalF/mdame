import { diff } from "@codemirror/merge";

/** A rendered block, by the lines of the source that it shows: from 1,
 * both ends included. */
export interface Block {
  start: number;
  end: number;
}

/** The lines of a `data-sourcepos` such as "6:1-8:0", or null. An end at
 * column 0 is the end of the line before. */
export function blockOf(sourcepos: string): Block | null {
  const match = /^(\d+):\d+-(\d+):(\d+)$/.exec(sourcepos);
  if (!match) return null;
  const end = Number(match[2]) - (match[3] === "0" ? 1 : 0);
  return { start: Number(match[1]), end };
}

/** "removed" marks the place of removed text, above its block. */
export type MarkKind = "added" | "changed" | "removed";

/** A mark on `blocks[block]`. A "removed" mark whose `block` is
 * `blocks.length` goes below the last block. */
export interface Mark {
  kind: MarkKind;
  block: number;
}

/**
 * The marks that show how `current` differs from `seen`, on the `blocks`
 * of `current`, in document order. A changed line marks the innermost
 * block that holds it, so a changed list item marks the item, not the
 * list. A block is "added" when all its lines are new. Text removed inside
 * a block marks it "changed"; removed between blocks, it gets a "removed"
 * mark. Lines in no block, such as blank lines, mark nothing.
 */
export function marks(seen: string, current: string, blocks: Block[]): Mark[] {
  if (seen === current || blocks.length === 0) return [];
  const changes = lineDiff(seen, current);
  if (!changes) return [];
  const currentLines = current.split("\n");
  const lines = currentLines.length;
  // By line: the innermost block that holds it, or -1. Blocks nest, so a
  // later block in document order is the deeper one.
  const owner = new Array<number>(lines + 2).fill(-1);
  // By line: the first block, in document order, that starts there or
  // below. Footnotes come last in the page, whatever their line.
  const next = new Array<number>(lines + 2).fill(blocks.length);
  blocks.forEach(({ start, end }, block) => {
    for (let line = start; line <= Math.min(end, lines); line++) owner[line] = block;
    if (start <= lines) next[start] = Math.min(next[start], block);
  });
  for (let line = lines; line >= 1; line--) next[line] = Math.min(next[line], next[line + 1]);

  // By line of `current`, from 1: whether a change inserted it, or replaced
  // lines of `seen` with it.
  const state: ("inserted" | "replaced" | undefined)[] = [];
  // By line of `current`: whether the lines removed before it were all blank.
  const removedBefore = new Map<number, boolean>();
  const seenLines = seen.split("\n");
  // Blank lines, or a lone `>`, that a change brought in beside text in a
  // block. In a loose list or a quote, they belong to the container alone,
  // which did not change.
  const quiet = new Set<number>();
  for (const { fromA, toA, fromB, toB } of changes) {
    // Whether a new line is in a block, holds text in a block, or holds text
    // in no block.
    let shown = false;
    let text = false;
    let unshown = false;
    const blanks: number[] = [];
    for (let line = fromB + 1; line <= toB; line++) {
      state[line] = fromA === toA ? "inserted" : "replaced";
      const blank = /^[\s>]*$/.test(currentLines[line - 1]);
      if (owner[line] === -1) {
        unshown ||= !blank;
      } else {
        shown = true;
        if (blank) blanks.push(line);
        else text = true;
      }
    }
    if (text) for (const line of blanks) quiet.add(line);
    // Text removed, or replaced by blank lines, gets a "removed" mark. Text
    // changed in no block, such as front matter, gets none: the page does
    // not show it.
    if (fromA < toA && !shown && !unshown) {
      const blank = seenLines.slice(fromA, toA).every((line) => line.trim() === "");
      removedBefore.set(fromB + 1, blank);
    }
  }

  const kinds = new Map<number, MarkKind>();
  for (let line = 1; line <= lines; line++) {
    if (state[line] && owner[line] !== -1 && !quiet.has(line)) kinds.set(owner[line], "added");
  }
  for (const [block] of kinds) {
    const { start, end } = blocks[block];
    for (let line = start; line <= Math.min(end, lines); line++) {
      if (state[line] !== "inserted") kinds.set(block, "changed");
    }
  }
  const result: Mark[] = [];
  for (const [line, blank] of removedBefore) {
    const inside = owner[line - 1];
    if (inside !== -1 && inside === owner[line]) kinds.set(inside, "changed");
    else if (!blank) result.push({ kind: "removed", block: next[line] });
  }
  for (const [block, kind] of kinds) result.push({ kind, block });
  return result.sort((a, b) => a.block - b.block);
}

/**
 * `a` and `b` with each distinct line as one UTF-16 code unit, so that
 * `diff` compares whole lines, as in diff-match-patch. Null past 0xD800
 * distinct lines: from there, the codes would form surrogate pairs.
 */
export function encodeLines(a: readonly string[], b: readonly string[]): [string, string] | null {
  const codes = new Map<string, string>();
  const encode = (lines: readonly string[]) => {
    let encoded = "";
    for (const line of lines) {
      let code = codes.get(line);
      if (code === undefined) {
        if (codes.size === 0xd800) return null;
        code = String.fromCharCode(codes.size);
        codes.set(line, code);
      }
      encoded += code;
    }
    return encoded;
  };
  const encodedA = encode(a);
  if (encodedA === null) return null;
  const encodedB = encode(b);
  return encodedB === null ? null : [encodedA, encodedB];
}

/** The changes from `a` to `b` in lines, from 0, or null past 0xD800
 * distinct lines. */
function lineDiff(a: string, b: string) {
  const encoded = encodeLines(a.split("\n"), b.split("\n"));
  if (!encoded) return null;
  // Many scattered changes take seconds to diff exactly: past the timeout,
  // the rest of the text counts as one change.
  return diff(encoded[0], encoded[1], { timeout: 100 });
}

/**
 * The version of each file that the tab last saw: the version on screen
 * when the tab last left the file. The tab keeps it in memory only.
 */
export class Seen {
  #versions = new Map<string, string>();

  /** The version to compare `source`, now on screen, with. A file shown for
   * the first time is seen as it is. */
  baseline(path: string, source: string): string {
    const seen = this.#versions.get(path);
    if (seen !== undefined) return seen;
    this.#versions.set(path, source);
    return source;
  }

  /** The version last seen of `path`, if the tab showed it. */
  version(path: string): string | undefined {
    return this.#versions.get(path);
  }

  /** The tab leaves `path`, with `source` on screen. */
  leave(path: string, source: string) {
    this.#versions.set(path, source);
  }

  /** The file moved: its version last seen moves with it. */
  rename(from: string, to: string) {
    const seen = this.#versions.get(from);
    if (seen === undefined) return;
    this.#versions.delete(from);
    this.#versions.set(to, seen);
  }
}
