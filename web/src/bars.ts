import { blockOf, marks, type Block, type Mark, type MarkKind } from "./changes.ts";

/** The elements that a bar can mark. comrak also gives a `data-sourcepos`
 * to inline elements and to table cells, which no bar marks. */
const BLOCKS =
  ":is(p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, table, tr, hr, div, section, ul, ol)[data-sourcepos]";

/** The blocks of `article`, in document order, with their elements. */
export function blocksOf(article: Element | null): { blocks: Block[]; elements: HTMLElement[] } {
  const blocks: Block[] = [];
  const elements: HTMLElement[] = [];
  for (const element of article?.querySelectorAll<HTMLElement>(BLOCKS) ?? []) {
    const block = blockOf(element.dataset.sourcepos!);
    if (!block) continue;
    blocks.push(block);
    elements.push(element);
  }
  return { blocks, elements };
}

interface Drawn {
  bar: HTMLElement;
  target: HTMLElement;
  kind: MarkKind;
  /** A "removed" mark below the last block. */
  below: boolean;
}

/** The bars on screen. They sit in a layer of the article, and follow
 * their blocks through a `ResizeObserver`: text that wraps again, an image
 * that loads or a `<details>` that opens moves them. */
let drawn: Drawn[] = [];
/** The kinds of bar that each block had in the last draw. idiomorph keeps
 * the elements of the blocks that stay, so a bar is new when its block had
 * no bar of its kind. */
let last = new WeakMap<HTMLElement, Set<string>>();
// Made at the first draw: the tests run with no DOM.
let observer: ResizeObserver | undefined;

/**
 * Draws in `article` the bars that show how `source` differs from `seen`,
 * and returns their marks. A bar that was not on screen before glows once.
 */
export function drawBars(
  article: HTMLElement,
  seen: string,
  source: string,
): { marks: Mark[]; blocks: Block[] } {
  clearBars(article);
  const before = last;
  last = new WeakMap();
  const { blocks, elements: targets } = blocksOf(article);
  const found = marks(seen, source, blocks);
  const layer = document.createElement("div");
  layer.className = "mdame-bars";
  layer.setAttribute("aria-hidden", "true");
  for (const { kind, block } of found) {
    const below = block === targets.length;
    const target = targets[below ? block - 1 : block];
    const bar = document.createElement("div");
    bar.className = `mdame-bar is-${kind}`;
    const tag = below ? "below" : kind;
    if (!before.get(target)?.has(tag)) bar.classList.add("is-new");
    last.set(target, (last.get(target) ?? new Set()).add(tag));
    drawn.push({ bar, target, kind, below });
    layer.append(bar);
  }
  if (drawn.length === 0) return { marks: found, blocks };
  article.append(layer);
  // Its first callback places the bars, before the next paint.
  observer ??= new ResizeObserver(([entry]) => place(entry.target as HTMLElement));
  observer.observe(article);
  return { marks: found, blocks };
}

/** Removes the bars: before a morph, which would drop the layer or reuse
 * it as a block of the new content. */
export function clearBars(article: HTMLElement) {
  observer?.disconnect();
  article.querySelector(":scope > .mdame-bars")?.remove();
  drawn = [];
}

function place(article: HTMLElement) {
  const top = article.getBoundingClientRect().top;
  // All the reads, then all the writes: a read after a write lays the page
  // out again.
  const rects = drawn.map(({ target }) =>
    // A block in a closed `<details>` has no box.
    target.getClientRects().length === 0 ? null : target.getBoundingClientRect(),
  );
  drawn.forEach(({ bar, kind, below }, index) => {
    const rect = rects[index];
    bar.hidden = rect === null;
    if (!rect) return;
    if (kind === "removed") {
      // In the gap above the block, or below the last one.
      bar.style.top = `${(below ? rect.bottom + 8 : rect.top - 8) - top}px`;
    } else {
      bar.style.top = `${rect.top - top + 2}px`;
      bar.style.height = `${Math.max(rect.height - 4, 2)}px`;
    }
  });
}
