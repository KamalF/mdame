import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { classHighlighter, highlightCode } from "@lezer/highlight";

export type Piece = [piece: string, classes: string];

/** One span per token: a 943 KB JSON file took 3.4 s to show. A
 * package-lock.json is often over 100 KB. */
export const HIGHLIGHT_LIMIT = 100_000;

/**
 * `text` as `[piece, classes]` pairs, with the editor's `tok-*` classes, or
 * null when `name` is no known language, or when `text` is over
 * `HIGHLIGHT_LIMIT` characters. Each language loads on first use.
 */
export async function tokens(name: string, text: string): Promise<Piece[] | null> {
  if (text.length > HIGHLIGHT_LIMIT) return null;
  // Exact names only: a fuzzy match would colour `txt` as some language.
  const description = LanguageDescription.matchLanguageName(languages, name, false);
  if (!description) return null;
  const support = await description.load();
  const tree = support.language.parser.parse(text);
  const pieces: Piece[] = [];
  highlightCode(
    text,
    tree,
    classHighlighter,
    (piece, classes) => pieces.push([piece, classes]),
    () => pieces.push(["\n", ""]),
  );
  return pieces;
}

/** Colours the `code.language-x` blocks in `root` that `include` keeps. */
export async function highlightAll(root: HTMLElement, include = (_: Element) => true) {
  const blocks = root.querySelectorAll<HTMLElement>('pre > code[class^="language-"]');
  await Promise.all([...blocks].filter(include).map(highlight));
}

async function highlight(code: HTMLElement) {
  const name = code.className.slice("language-".length);
  const pieces = await tokens(name, code.textContent);
  if (!pieces) return;
  // One fragment: a 1 MB file has too many pieces to pass as arguments.
  const fragment = document.createDocumentFragment();
  for (const [piece, classes] of pieces) {
    if (!classes) {
      fragment.append(piece);
      continue;
    }
    const span = document.createElement("span");
    span.className = classes;
    span.textContent = piece;
    fragment.append(span);
  }
  code.replaceChildren(fragment);
}
