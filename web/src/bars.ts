import { blockOf, marks, type Block, type MarkKind } from "./changes.ts";

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
 * Draws in `article` the bars that show how `source` differs from `seen`.
 * A bar that was not on screen before glows once.
 */
export function drawBars(article: HTMLElement, seen: string, source: string) {
  clearBars(article);
  const before = last;
  last = new WeakMap();
  const { blocks, elements: targets } = blocksOf(article);
  const layer = document.createElement("div");
  layer.className = "mdame-bars";
  layer.setAttribute("aria-hidden", "true");
  for (const { kind, block } of marks(seen, source, blocks)) {
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
  if (drawn.length === 0) return;
  article.append(layer);
  place(article);
  observer ??= new ResizeObserver(([entry]) => place(entry.target as HTMLElement));
  observer.observe(article);
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
  for (const { bar, target, kind, below } of drawn) {
    // A block in a closed `<details>` has no box.
    bar.hidden = target.getClientRects().length === 0;
    const rect = target.getBoundingClientRect();
    if (kind === "removed") {
      // In the gap above the block, or below the last one.
      bar.style.top = `${(below ? rect.bottom + 8 : rect.top - 8) - top}px`;
    } else {
      bar.style.top = `${rect.top - top + 2}px`;
      bar.style.height = `${Math.max(rect.height - 4, 2)}px`;
    }
  }
}
