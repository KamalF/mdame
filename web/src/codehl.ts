import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { classHighlighter, highlightCode } from "@lezer/highlight";

export type Piece = [piece: string, classes: string];

/**
 * `text` as `[piece, classes]` pairs, with the editor's `tok-*` classes, or
 * null when `name` is no known language. Each language loads on first use.
 */
export async function tokens(name: string, text: string): Promise<Piece[] | null> {
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

/** Colours the `code.language-x` blocks in `root`. */
export async function highlightAll(root: HTMLElement) {
  const blocks = root.querySelectorAll<HTMLElement>('pre > code[class^="language-"]');
  await Promise.all([...blocks].map(highlight));
}

async function highlight(code: HTMLElement) {
  const name = code.className.slice("language-".length);
  const pieces = await tokens(name, code.textContent);
  if (!pieces) return;
  const spans = pieces.map(([piece, classes]) => {
    if (!classes) return piece;
    const span = document.createElement("span");
    span.className = classes;
    span.textContent = piece;
    return span;
  });
  code.replaceChildren(...spans);
}
