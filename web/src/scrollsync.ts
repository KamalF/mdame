/** A point that both panes share: a source line, and the preview's
 * offset in pixels where the block from that line starts. */
export interface Anchor {
  line: number;
  top: number;
}

/**
 * The anchors for a source of `lines` lines whose preview is `height` px
 * high, from its blocks in document order. A block whose line or top does
 * not grow is skipped: a footnote shown at the end, or a nested element on
 * the line of its parent. Then both directions are increasing functions,
 * and each one inverts the other.
 */
export function anchorTable(blocks: Anchor[], lines: number, height: number): Anchor[] {
  const table = [{ line: 1, top: 0 }];
  for (const block of [...blocks, { line: lines + 1, top: height }]) {
    const last = table[table.length - 1];
    if (block.line > last.line && block.top > last.top) table.push(block);
  }
  return table;
}

/** `value` on the `from` axis, mapped to the `to` axis between the two
 * anchors around it. */
function interpolate(table: Anchor[], value: number, from: keyof Anchor, to: keyof Anchor) {
  let i = 0;
  while (i + 1 < table.length && table[i + 1][from] <= value) i++;
  const a = table[i];
  const b = table[i + 1];
  if (!b || value <= a[from]) return a[to];
  return a[to] + ((value - a[from]) / (b[from] - a[from])) * (b[to] - a[to]);
}

/** The preview offset that shows source line `line`, which may be fractional. */
export function lineToTop(table: Anchor[], line: number): number {
  return interpolate(table, line, "line", "top");
}

/** The source line, fractional, that the preview shows at offset `top`. */
export function topToLine(table: Anchor[], top: number): number {
  return interpolate(table, top, "top", "line");
}
