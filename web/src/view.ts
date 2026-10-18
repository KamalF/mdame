import "../styles/content.css";
import { api } from "./api.ts";
import { copyButton } from "./copy.ts";
import { highlightAll } from "./codehl.ts";
import { renderDiagrams } from "./diagrams.ts";

/** What `/api/file` answers. */
export interface FileView {
  html: string;
  family: string;
  modified: number;
  size: number;
  too_large: boolean;
}

/** `/raw/docs/a%20b.md` gives `docs/a b.md`; any other path gives null. */
export function rawPath(pathname: string): string | null {
  if (!pathname.startsWith("/raw/")) return null;
  try {
    return decodeURIComponent(pathname.slice(5));
  } catch {
    return null;
  }
}

function message(el: HTMLElement, text: string) {
  const line = document.createElement("p");
  line.className = "mdame-placeholder";
  line.textContent = text;
  el.replaceChildren(line);
}

let request = 0;

/** `docs/a b.md` gives `/raw/docs/a%20b.md`. */
export function rawUrl(path: string): string {
  return "/raw/" + path.split("/").map(encodeURIComponent).join("/");
}

/** Shows the rendered file in `el`, and returns its `/api/file` answer, or
 * null when it failed or another file was asked for meanwhile. */
export async function showFile(el: HTMLElement, path: string): Promise<FileView | null> {
  const id = ++request;
  let file: FileView;
  try {
    file = await api<FileView>("GET", `/api/file?path=${encodeURIComponent(path)}`);
  } catch (error) {
    // A click on another file meanwhile wins over this answer.
    if (id === request) message(el, (error as Error).message);
    return null;
  }
  if (id !== request) return null;
  const article = document.createElement("article");
  article.className = "mdame-document";
  // Sanitized by the server.
  article.innerHTML = file.html;
  el.replaceChildren(article);
  el.scrollTop = 0;
  scrollToHash();
  addCopyButtons(article);
  highlightAll(article);
  renderDiagrams(article);
  return file;
}

function addCopyButtons(root: HTMLElement) {
  for (const code of root.querySelectorAll("pre > code:not(.language-mermaid)")) {
    const pre = code.parentElement!;
    const block = document.createElement("div");
    block.className = "mdame-code";
    pre.replaceWith(block);
    const button = copyButton({ label: "Copy code", iconName: "copy", text: () => code.textContent });
    block.append(pre, button);
  }
}

export function showNothing(el: HTMLElement) {
  request++;
  message(el, "Choose a file in the sidebar.");
}

/** Scrolls to the heading or footnote that the URL's `#…` names. */
export function scrollToHash() {
  if (!location.hash) return;
  let id: string;
  try {
    id = decodeURIComponent(location.hash.slice(1));
  } catch {
    return;
  }
  document.getElementById(id)?.scrollIntoView();
}
