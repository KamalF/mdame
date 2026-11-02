import type { Mermaid } from "mermaid";

let ready: Promise<Mermaid> | undefined;

// Loaded on the first diagram only: Mermaid is most of the bundle. Set up
// again at each render, since the theme may have changed since.
async function loadMermaid() {
  ready ??= import("mermaid").then(({ default: mermaid }) => mermaid);
  const mermaid = await ready;
  const dark = getComputedStyle(document.documentElement).colorScheme === "dark";
  // Diagram text can be agent-written: 'strict' encodes HTML in labels
  // and disables click handlers. Never 'loose'.
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: dark ? "dark" : "default",
  });
  return mermaid;
}

let count = 0;

/** Turns `.mmd` files and `mermaid` code blocks in `root` into diagrams. */
export async function renderDiagrams(root: HTMLElement) {
  const blocks = root.querySelectorAll("pre.mermaid, pre:has(> code.language-mermaid)");
  if (blocks.length === 0) return;
  const mermaid = await loadMermaid();
  for (const pre of blocks) {
    const figure = document.createElement("div");
    figure.className = "mdame-diagram";
    // Mermaid draws in this box, and leaves its error graphic there.
    const box = document.createElement("div");
    document.body.append(box);
    try {
      const { svg } = await mermaid.render(`mdame-mermaid-${++count}`, pre.textContent, box);
      figure.innerHTML = svg;
      pre.replaceWith(figure);
    } catch (error) {
      // Keep the source, with the reason below it.
      figure.className = "mdame-diagram-error";
      figure.textContent = `Mermaid: ${(error as Error).message}`;
      pre.after(figure);
    } finally {
      box.remove();
    }
  }
}
