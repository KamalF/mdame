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

/** What a reader reads: no code, diagram, change bar or copy button. */
const SKIP = "pre, .mdame-diagram, .mdame-bars, button";

/** The text that a reader reads in the rendered `article`. */
export function prose(article: HTMLElement): string {
  // Elements too, so that a skipped one is left out with all that it holds.
  const walker = document.createTreeWalker(article, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.nodeType === Node.TEXT_NODE
        ? NodeFilter.FILTER_ACCEPT
        : (node as Element).matches(SKIP)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_SKIP,
  });
  const parts: string[] = [];
  // Blocks hold no space between them: "Title" and "Text" would make one word.
  while (walker.nextNode()) parts.push(walker.currentNode.textContent ?? "");
  return parts.join(" ");
}
