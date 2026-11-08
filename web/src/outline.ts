import { blockOf, type Block, type Mark } from "./changes.ts";
import { load, store } from "./storage.ts";
import { currentWidth } from "./width.ts";

const KEY = "mdame:outline";
/** The list is 200 px wide, after a gap of 24 px. */
const GAP = 24;
export const ROOM = 200 + GAP;
/** About 45 characters, with the padding: a shorter line reads badly. */
const MIN_FULL_COLUMN = 480;
/** A heading counts as reached once its top is this close to the top of
 * the pane. */
const REACHED = 48;

interface Heading {
  level: number;
  /** Its line in the source, from 1. */
  line: number;
}

/**
 * The entries of the outline: the h2 and h3 of `headings`, or none for
 * fewer than 3. An entry gets a dot when one of `marks` is in its section,
 * which ends at the next h1, h2 or h3.
 */
export function entries<T extends Heading>(
  headings: readonly T[],
  marks: readonly Mark[],
  blocks: readonly Block[],
): (T & { dot: boolean })[] {
  const listed = headings.filter(({ level }) => level === 2 || level === 3);
  if (listed.length < 3) return [];
  const ends = headings.filter(({ level }) => level <= 3);
  const changed = new Set<T>();
  for (const { kind, block } of marks) {
    let line = blocks[block]?.start ?? Infinity;
    // A "removed" mark sits above its block: the text was in the section
    // before it.
    if (kind === "removed") line -= 1;
    const section = ends.findLast((heading) => heading.line <= line);
    if (section) changed.add(section);
  }
  return listed.map((heading) => ({ ...heading, dot: changed.has(heading) }));
}

/**
 * Where the column goes so that the outline fits at its right, in a pane
 * `pane` px wide: its left edge and its width. `column` is its width when
 * centred. Null when the outline does not fit.
 */
export function place(
  pane: number,
  column: number,
  full: boolean,
): { left: number; width: number } | null {
  if (full) return pane - ROOM >= MIN_FULL_COLUMN ? { left: 0, width: pane - ROOM } : null;
  // Only as far left as the outline needs: the column does not jump when
  // the pane narrows.
  const left = Math.min((pane - column) / 2, pane - column - ROOM);
  return left >= 0 ? { left, width: column } : null;
}

export function outlineOn(): boolean {
  return load<unknown>(KEY, true) !== false;
}

export function chooseOutline(on: boolean) {
  store(KEY, on);
  render();
}

type Entry = Heading & { element: HTMLElement; dot: boolean };

/** The article that the outline lists, with its entries. */
let shown: { article: HTMLElement; entries: Entry[] } | undefined;
/** The outline on screen, if any. */
let wrapper: HTMLElement | undefined;
let links: HTMLAnchorElement[] = [];
/** The heading that the view scrolled to, with the pane's position after
 * the scroll. Near the end of a file, the heading cannot reach the top. */
let target: { element: Element; scrollTop: number } | undefined;
// Made at the first outline: the tests run with no DOM.
let observer: ResizeObserver | undefined;
let frame = 0;

/** Shows the outline of `article`, which is in the view's pane, with a dot
 * on each section that has one of `marks`. */
export function showOutline(
  article: HTMLElement,
  marks: readonly Mark[] = [],
  blocks: readonly Block[] = [],
) {
  const headings = [];
  const selector = ":is(h1, h2, h3, h4, h5, h6)[data-sourcepos]";
  for (const element of article.querySelectorAll<HTMLElement>(selector)) {
    const block = blockOf(element.dataset.sourcepos!);
    if (block) headings.push({ level: Number(element.tagName[1]), line: block.start, element });
  }
  shown = { article, entries: entries(headings, marks, blocks) };
  render();
}

function render() {
  wrapper?.remove();
  wrapper = undefined;
  if (shown) setMargins(shown.article, null);
  observer?.disconnect();
  // The editor may have taken the pane.
  const pane = shown?.article.parentElement;
  if (!shown || !pane || !outlineOn() || shown.entries.length === 0) return;
  const list = document.createElement("ul");
  links = shown.entries.map(({ element, level, line, dot }) => {
    const item = document.createElement("li");
    if (level === 3) item.className = "is-sub";
    const link = document.createElement("a");
    // The sanitizer drops an id that starts with "mdame-".
    link.href = "#" + (element.id || `L${line}`);
    link.textContent = element.textContent;
    if (dot) {
      const mark = document.createElement("span");
      mark.className = "mdame-outline-dot";
      mark.setAttribute("role", "img");
      mark.setAttribute("aria-label", "Changed");
      mark.title = "Changed";
      link.append(mark);
    }
    item.append(link);
    list.append(item);
    return link;
  });
  const label = document.createElement("p");
  label.className = "mdame-outline-label";
  label.textContent = "On this page";
  const nav = document.createElement("nav");
  nav.setAttribute("aria-label", "On this page");
  nav.append(label, list);
  wrapper = document.createElement("div");
  wrapper.className = "mdame-outline";
  wrapper.append(nav);
  pane.prepend(wrapper);
  layoutOutline();
  // The browser keeps one listener, however many times it is added.
  pane.addEventListener("scroll", spy, { passive: true });
  observer ??= new ResizeObserver(() => {
    // A move of the column inside the callback would resize what it
    // observes, in a loop.
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(layoutOutline);
  });
  // The pane for its width, the article for the width choice and the fonts.
  observer.observe(pane);
  observer.observe(shown.article);
}

/** Places the column and the outline, or hides the outline. */
export function layoutOutline() {
  if (!shown || !wrapper?.isConnected) return;
  const pane = wrapper.parentElement!;
  const { article } = shown;
  const full = currentWidth() === "full";
  let column = 0;
  // Full needs no width: the column takes what the outline leaves. A read
  // with the margins off would wrap the whole text again.
  if (!full) {
    setMargins(article, null);
    column = article.getBoundingClientRect().width;
  }
  const spot = place(pane.clientWidth, column, full);
  wrapper.hidden = spot === null;
  if (!spot) {
    setMargins(article, null);
    return;
  }
  setMargins(article, { left: spot.left, right: full ? ROOM : null });
  const nav = wrapper.firstElementChild as HTMLElement;
  nav.style.left = `${spot.left + spot.width + GAP}px`;
  nav.style.maxHeight = `${pane.clientHeight}px`;
  spy();
}

/** The margins of the column, or `null` for the centred column. They are
 * the article's own: an inherited custom property on the pane would
 * restyle each element of the article, 370 ms on a dense 1 MB file. */
function setMargins(article: HTMLElement, margins: { left: number; right: number | null } | null) {
  const left = margins ? `${margins.left}px` : "";
  const right = margins?.right != null ? `${margins.right}px` : "";
  if (article.style.marginLeft !== left) article.style.marginLeft = left;
  if (article.style.marginRight !== right) article.style.marginRight = right;
}

/** The view scrolled to `element`, which the address names: its entry
 * stays highlighted until the pane scrolls elsewhere. */
export function scrolledTo(element: Element) {
  const pane = shown?.article.parentElement;
  if (!pane) return;
  target = { element, scrollTop: pane.scrollTop };
  spy();
}

/** Highlights the heading of the section on screen. */
function spy() {
  if (!shown || !wrapper?.isConnected || wrapper.hidden) return;
  const pane = wrapper.parentElement!;
  if (target && pane.scrollTop !== target.scrollTop) target = undefined;
  let current = shown.entries.findIndex(({ element }) => element === target?.element);
  if (current === -1) {
    const reached = pane.getBoundingClientRect().top + REACHED;
    shown.entries.forEach(({ element }, index) => {
      // A heading in a closed `<details>` has no box.
      if (element.getClientRects().length === 0) return;
      if (element.getBoundingClientRect().top <= reached) current = index;
    });
    // The last sections may be too short to reach the top.
    const bottom = pane.scrollTop + pane.clientHeight >= pane.scrollHeight - 1;
    if (pane.scrollTop > 0 && bottom) current = shown.entries.length - 1;
  }
  links.forEach((link, index) => link.setAttribute("aria-current", String(index === current)));
}
