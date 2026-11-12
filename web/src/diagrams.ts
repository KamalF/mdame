import type { Mermaid } from "mermaid";
import { isDark } from "./stylesheets.ts";

let ready: Promise<Mermaid> | undefined;

// Loaded on the first diagram only: Mermaid is most of the bundle. Set up
// again before each drawing, since the theme may have changed since.
async function loadMermaid(theme: "dark" | "default") {
  ready ??= import("mermaid").then(({ default: mermaid }) => mermaid);
  const mermaid = await ready;
  // Diagram text can be agent-written: 'strict' encodes HTML in labels
  // and disables click handlers. Never 'loose'.
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme,
  });
  return mermaid;
}

let count = 0;

/** The diagrams drawn lately, by theme and source, with the id that each
 * was drawn with: a drawing takes 65 ms. */
const drawn = new Map<string, { svg: string; id: string }>();
const DRAWN_LIMIT = 50;

/** The last drawing, which the next one waits for. Mermaid draws with the
 * theme of the last `initialize`, and the renders of two files overlap. */
let drawing: Promise<unknown> = Promise.resolve();

/** `source` drawn, with ids of its own: two equal drawings would share
 * their ids, and a marker in a closed `<details>` would then hide the
 * arrows of the other. */
async function draw(source: string): Promise<string> {
  const theme = isDark() ? "dark" : "default";
  const key = `${theme}\n${source}`;
  const id = `mdame-mermaid-${++count}`;
  const cached = drawn.get(key);
  // Each id of a drawing starts with the id that it was drawn with. Not
  // followed by a digit: `mdame-mermaid-1` is no part of `mdame-mermaid-12`.
  if (cached) return cached.svg.replace(new RegExp(`${cached.id}(?!\\d)`, "g"), id);
  const next = drawing.then(async () => {
    const mermaid = await loadMermaid(theme);
    // Mermaid draws in this box, and leaves its error graphic there.
    const box = document.createElement("div");
    document.body.append(box);
    try {
      return (await mermaid.render(id, source, box)).svg;
    } finally {
      box.remove();
    }
  });
  drawing = next.catch(() => {});
  const svg = await next;
  drawn.set(key, { svg, id });
  // The oldest goes first: a Map keeps the order of insertion.
  if (drawn.size > DRAWN_LIMIT) drawn.delete(drawn.keys().next().value!);
  return svg;
}

/** The blocks that `renderDiagrams` draws. */
export const DIAGRAM_BLOCKS = "pre.mermaid, pre:has(> code.language-mermaid)";

/** Turns `.mmd` files and `mermaid` code blocks in `root` into diagrams,
 * those that `include` keeps. */
export async function renderDiagrams(root: HTMLElement, include = (_: Element) => true) {
  for (const pre of root.querySelectorAll(DIAGRAM_BLOCKS)) {
    if (!include(pre)) continue;
    const figure = document.createElement("div");
    figure.className = "mdame-diagram";
    try {
      figure.innerHTML = await draw(pre.textContent ?? "");
      // Mermaid gives the drawing a width of 100%, and its own width as
      // max-width: a wide block takes that width, so a wide diagram can
      // grow past the column.
      const svg = figure.querySelector("svg");
      if (svg) figure.style.setProperty("--diagram-width", svg.style.maxWidth);
      // The change bars find the diagram by its lines.
      if (pre.hasAttribute("data-sourcepos")) {
        figure.setAttribute("data-sourcepos", pre.getAttribute("data-sourcepos")!);
      }
      pre.replaceWith(figure);
    } catch (error) {
      // Keep the source, with the reason below it, in one block: the view
      // pairs its blocks with those of the server's HTML.
      figure.className = "mdame-diagram-error";
      figure.textContent = `Mermaid: ${(error as Error).message}`;
      const failed = document.createElement("div");
      pre.replaceWith(failed);
      failed.append(pre, figure);
    }
  }
}
