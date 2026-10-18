import "../styles/content.css";
import { api, type ApiError } from "./api.ts";
import { copyButton } from "./copy.ts";
import { highlightAll } from "./codehl.ts";
import { renderDiagrams } from "./diagrams.ts";
import { encodePath } from "./sidebar.ts";

/** What `/api/file` answers. */
export interface FileView {
  html: string;
  family: string;
  modified: number;
  size: number;
  too_large: boolean;
}

function message(el: HTMLElement, text: string) {
  const line = document.createElement("p");
  line.className = "mdame-placeholder";
  line.textContent = text;
  el.replaceChildren(line);
}

let request = 0;
/** The file on screen, as `{path, file}`. */
let shown: { path: string; file: FileView } | undefined;

export function rawUrl(path: string): string {
  return "/raw/" + encodePath(path);
}

/** The server points links to `/raw/`, as images; links open in the app. */
export function viewHref(href: string): string {
  return href.startsWith("/raw/") ? "/view/" + href.slice("/raw/".length) : href;
}

/** Shows the rendered file in `el`, and returns its `/api/file` answer, or
 * null when it failed or a later request replaced this one. */
export async function showFile(el: HTMLElement, path: string): Promise<FileView | null> {
  // Moving between `#…` of the file on screen only scrolls, and its
  // diagrams may still move the target.
  if (shown?.path === path) {
    scrollToHash();
    return shown.file;
  }
  const id = ++request;
  shown = undefined;
  let file: FileView;
  try {
    file = await api<FileView>("GET", `/api/file?path=${encodeURIComponent(path)}`);
  } catch (error) {
    // A click on another file meanwhile wins over this answer.
    if (id === request) notFound(el, path, error as ApiError);
    return null;
  }
  if (id !== request) return null;
  shown = { path, file };
  const article = document.createElement("article");
  article.className = "mdame-document";
  // Sanitized by the server.
  article.innerHTML = file.html;
  for (const link of article.querySelectorAll('a[href^="/raw/"]')) {
    link.setAttribute("href", viewHref(link.getAttribute("href")!));
  }
  el.replaceChildren(article);
  el.scrollTop = 0;
  scrollToHash();
  addCopyButtons(article);
  highlightAll(article);
  // A diagram above the `#…` target moves it once drawn.
  renderDiagrams(article).then(() => id === request && scrollToHash());
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

function notFound(el: HTMLElement, path: string, error: ApiError) {
  if (error.code !== "not_found" && error.code !== "not_viewable") {
    message(el, error.message);
    return;
  }
  const page = document.createElement("article");
  page.className = "mdame-document";
  const title = document.createElement("h1");
  title.textContent = error.code === "not_found" ? "Not found" : "Not shown here";
  const reason = document.createElement("p");
  reason.textContent = error.message;
  page.append(title, reason);
  if (error.code === "not_viewable") {
    const link = document.createElement("a");
    link.href = rawUrl(path);
    link.textContent = "Open the raw file";
    page.append(link);
  }
  el.replaceChildren(page);
}

/** The page with no file chosen; `empty` when the workspace shows none. */
export function showNothing(el: HTMLElement, empty: boolean) {
  request++;
  shown = undefined;
  message(
    el,
    empty
      ? "This folder has no file that mdame shows: markdown, text, JSON, YAML, TOML, GraphQL, CSV, Mermaid or images. Files that .gitignore hides are left out."
      : "Choose a file in the sidebar.",
  );
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
