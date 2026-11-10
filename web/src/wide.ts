import { placeBars } from "./bars.ts";

/** Between a wide block and the edge of the pane: the article's padding. */
const EDGE = 32;

interface Span {
  left: number;
  right: number;
}

/**
 * The room that a wide block may take beside the text column, on each
 * side. A block stops `EDGE` before the edge of the pane, and at the edge
 * of the article when the outline is beside it.
 */
export function room(pane: Span, article: Span, text: Span, outline: boolean): Span {
  return {
    left: Math.max(0, text.left - pane.left - EDGE),
    right: Math.max(0, (outline ? article.right : pane.right - EDGE) - text.right),
  };
}

/** Gives `article` the sizes that the CSS of the wide blocks reads. */
export function layoutWide(article: HTMLElement) {
  const pane = article.parentElement;
  if (!pane || !article.isConnected) return;
  const box = article.getBoundingClientRect();
  const style = getComputedStyle(article);
  const text = {
    left: box.left + parseFloat(style.paddingLeft),
    right: box.right - parseFloat(style.paddingRight),
  };
  // The client box: without the pane's scrollbar.
  const left = pane.getBoundingClientRect().left + pane.clientLeft;
  const outline = pane.querySelector(":scope > .mdame-outline:not([hidden])") !== null;
  const space = room({ left, right: left + pane.clientWidth }, box, text, outline);
  const sizes = {
    "--column": `${text.right - text.left}px`,
    "--room-left": `${space.left}px`,
    "--room-right": `${space.right}px`,
  };
  let moved = false;
  for (const [name, value] of Object.entries(sizes)) {
    if (article.style.getPropertyValue(name) === value) continue;
    article.style.setProperty(name, value);
    moved = true;
  }
  // A wide block moved, and its bar with it.
  if (moved) placeBars(article);
}

let watched: HTMLElement | undefined;
let observer: ResizeObserver | undefined;

/** Lays out the wide blocks of `article` now, and whenever it or its pane
 * changes size. */
export function watchWide(article: HTMLElement) {
  observer ??= new ResizeObserver(() => {
    if (watched) layoutWide(watched);
  });
  observer.disconnect();
  watched = article;
  observer.observe(article);
  if (article.parentElement) observer.observe(article.parentElement);
}
