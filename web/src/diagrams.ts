import type { Mermaid } from "mermaid";
import { isDark } from "./theme.ts";

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

/** The diagrams drawn lately, by theme, copy and source. A live update and
 * each preview render draw every diagram of the file again, 65 ms each. */
const drawn = new Map<string, string>();
const DRAWN_LIMIT = 50;

/** The last drawing, which the next one waits for. Mermaid draws with the
 * theme of the last `initialize`, and the renders of two files overlap. */
let drawing: Promise<unknown> = Promise.resolve();

/** Copy `copy` of `source` in the file: a second copy of a diagram draws on
 * its own, since equal drawings share their ids. A marker in a closed
 * `<details>` would then hide the other copy's arrows. */
async function draw(source: string, copy: number): Promise<string> {
  const theme = isDark() ? "dark" : "default";
  const key = `${theme}\n${copy}\n${source}`;
  const cached = drawn.get(key);
  if (cached !== undefined) return cached;
  const next = drawing.then(async () => {
    const mermaid = await loadMermaid(theme);
    // Mermaid draws in this box, and leaves its error graphic there.
    const box = document.createElement("div");
    document.body.append(box);
    try {
      return (await mermaid.render(`mdame-mermaid-${++count}`, source, box)).svg;
    } finally {
      box.remove();
    }
  });
  drawing = next.catch(() => {});
  const svg = await next;
  drawn.set(key, svg);
  // The oldest goes first: a Map keeps the order of insertion.
  if (drawn.size > DRAWN_LIMIT) drawn.delete(drawn.keys().next().value!);
  return svg;
}

/** Turns `.mmd` files and `mermaid` code blocks in `root` into diagrams. */
export async function renderDiagrams(root: HTMLElement) {
  const blocks = root.querySelectorAll("pre.mermaid, pre:has(> code.language-mermaid)");
  const copies = new Map<string, number>();
  for (const pre of blocks) {
    const figure = document.createElement("div");
    figure.className = "mdame-diagram";
    const source = pre.textContent ?? "";
    const copy = (copies.get(source) ?? 0) + 1;
    copies.set(source, copy);
    try {
      figure.innerHTML = await draw(source, copy);
      // The change bars find the diagram by its lines.
      if (pre.hasAttribute("data-sourcepos")) {
        figure.setAttribute("data-sourcepos", pre.getAttribute("data-sourcepos")!);
      }
      pre.replaceWith(figure);
    } catch (error) {
      // Keep the source, with the reason below it.
      figure.className = "mdame-diagram-error";
      figure.textContent = `Mermaid: ${(error as Error).message}`;
      pre.after(figure);
    }
  }
}
