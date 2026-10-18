import type { Mermaid, MermaidConfig } from "mermaid";

let ready: Promise<Mermaid> | undefined;

// Loaded on the first diagram only: Mermaid is most of the bundle.
function loadMermaid() {
  ready ??= import("mermaid").then(({ default: mermaid }) => {
    // The CSS sets the variable to one of Mermaid's theme names.
    const theme = getComputedStyle(document.documentElement)
      .getPropertyValue("--mermaid-theme")
      .trim() as MermaidConfig["theme"];
    // Diagram text can be agent-written: 'strict' encodes HTML in labels
    // and disables click handlers. Never 'loose'.
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: theme || "default" });
    return mermaid;
  });
  return ready;
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
    const id = `mdame-mermaid-${++count}`;
    try {
      const { svg } = await mermaid.render(id, pre.textContent);
      figure.innerHTML = svg;
      pre.replaceWith(figure);
    } catch (error) {
      // On failure Mermaid leaves its error graphic in <body>.
      document.getElementById(`d${id}`)?.remove();
      // Keep the source, with the reason below it.
      figure.className = "mdame-diagram-error";
      figure.textContent = `Mermaid: ${(error as Error).message}`;
      pre.after(figure);
    }
  }
}
