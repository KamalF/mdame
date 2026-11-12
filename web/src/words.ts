/** Words read in a minute, for the reading time. */
export const PER_MINUTE = 200;

const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });

/** The words of `text`, in any script: a space does not end a word in
 * Chinese or Thai, and the segmenter knows where one does. */
export function countWords(text: string): number {
  let count = 0;
  for (const segment of segmenter.segment(text)) if (segment.isWordLike) count++;
  return count;
}

/** "1,234 words · 6 min", or null for no words. */
export function wordLabel(words: number): string | null {
  if (words === 0) return null;
  const minutes = Math.max(1, Math.round(words / PER_MINUTE));
  return `${words.toLocaleString("en")} ${words === 1 ? "word" : "words"} · ${minutes} min`;
}

/** What a reader reads: no code, diagram, diagram error, change bar or
 * copy button. */
const SKIP = "pre, .mdame-diagram, .mdame-diagram-error, .mdame-bars, button";

/** The words of each top-level node of an article: an update counts
 * again only the nodes that it changed. */
const counts = new WeakMap<Node, number>();

/** The words that a reader reads in the rendered `article`. Blocks hold no
 * space between them, so each one counts on its own: "Title" and "Text"
 * would make one word. */
export function articleWords(article: HTMLElement): number {
  let total = 0;
  for (const node of article.childNodes) {
    let count = counts.get(node);
    if (count === undefined) {
      const text = node instanceof Element ? (node.matches(SKIP) ? "" : prose(node)) : (node.textContent ?? "");
      // A line break sits between each two blocks, and each call to the
      // segmenter has a cost.
      count = /\S/.test(text) ? countWords(text) : 0;
      counts.set(node, count);
    }
    total += count;
  }
  return total;
}

/** A morph changed `node` in place: its words count again. */
export function forgetWords(node: Node) {
  counts.delete(node);
}

/** The text that a reader reads in `root`. */
function prose(root: Element): string {
  // Elements too, so that a skipped one is left out with all that it holds.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.nodeType === Node.TEXT_NODE
        ? NodeFilter.FILTER_ACCEPT
        : (node as Element).matches(SKIP)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_SKIP,
  });
  const parts: string[] = [];
  while (walker.nextNode()) parts.push(walker.currentNode.textContent ?? "");
  return parts.join(" ");
}
