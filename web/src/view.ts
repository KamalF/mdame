import "../styles/content.css";
import { api } from "./api.ts";

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

/** Shows the rendered file in `el`. */
export async function showFile(el: HTMLElement, path: string) {
  const id = ++request;
  let file: FileView;
  try {
    file = await api<FileView>("GET", `/api/file?path=${encodeURIComponent(path)}`);
  } catch (error) {
    // A click on another file meanwhile wins over this answer.
    if (id === request) message(el, (error as Error).message);
    return;
  }
  if (id !== request) return;
  const article = document.createElement("article");
  article.className = "mdame-document";
  // Sanitized by the server.
  article.innerHTML = file.html;
  el.replaceChildren(article);
  el.scrollTop = 0;
  scrollToHash();
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
