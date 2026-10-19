import "../styles/content.css";
import { Idiomorph } from "idiomorph";
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
  const file = await fetchFile(el, path, id);
  if (!file) return null;
  shown = { path, file };
  const article = articleFor(file);
  el.replaceChildren(article);
  el.scrollTop = 0;
  scrollToHash();
  highlightAll(article);
  // A diagram above the `#…` target moves it once drawn.
  renderDiagrams(article).then(() => id === request && scrollToHash());
  return file;
}

/**
 * Shows the new content of the file on screen, replacing only what changed:
 * the scroll position, a text selection and open `<details>` stay. A file
 * that failed to show, such as a deleted one now back, is shown anew.
 */
export async function refreshFile(el: HTMLElement, path: string): Promise<FileView | null> {
  if (shown?.path !== path) return showFile(el, path);
  const id = ++request;
  const file = await fetchFile(el, path, id);
  if (!file) return null;
  const article = articleFor(file);
  // Coloured and drawn before the morph, so plain code never flashes.
  await Promise.all([highlightAll(article), renderDiagrams(article)]);
  if (id !== request) return null;
  shown = { path, file };
  Idiomorph.morph(el.querySelector(":scope > article")!, article);
  return file;
}

/** The path of the file on screen, if one is. */
export function shownPath(): string | undefined {
  return shown?.path;
}

/** The file on screen moved to `path`: a refresh then patches it in place. */
export function renameShown(path: string) {
  if (shown) shown = { ...shown, path };
}

/** The file, or null when it failed or request `id` is no longer the latest. */
async function fetchFile(el: HTMLElement, path: string, id: number): Promise<FileView | null> {
  try {
    const file = await api<FileView>("GET", `/api/file?path=${encodeURIComponent(path)}`);
    return id === request ? file : null;
  } catch (error) {
    // A click on another file meanwhile wins over this answer.
    if (id === request) {
      shown = undefined;
      notFound(el, path, error as ApiError);
    }
    return null;
  }
}

/** The time each workspace file last changed, for those that changed since
 * the page loaded. Images carry it in their URL, or the browser would keep
 * showing the copy it has. */
const versions = new Map<string, number>();

/** The workspace path that `img` shows, or null for an image from elsewhere. */
function rawPath(img: HTMLImageElement): string | null {
  const url = new URL(img.src);
  if (url.origin !== location.origin || !url.pathname.startsWith("/raw/")) return null;
  try {
    return decodeURIComponent(url.pathname.slice("/raw/".length));
  } catch {
    return null;
  }
}

function useVersion(img: HTMLImageElement) {
  const path = rawPath(img);
  const version = path === null ? undefined : versions.get(path);
  if (version === undefined) return;
  const url = new URL(img.src);
  url.searchParams.set("v", String(version));
  img.src = url.pathname + url.search;
}

/** Reloads the images of `path` shown in `el`, after it changed on disk. */
export function refreshImages(el: HTMLElement, path: string) {
  versions.set(path, Date.now());
  for (const img of el.querySelectorAll("img")) {
    if (rawPath(img) === path) useVersion(img);
  }
}

function articleFor(file: FileView): HTMLElement {
  const article = document.createElement("article");
  article.className = "mdame-document";
  // Sanitized by the server.
  article.innerHTML = file.html;
  for (const link of article.querySelectorAll('a[href^="/raw/"]')) {
    link.setAttribute("href", viewHref(link.getAttribute("href")!));
  }
  // A morph would otherwise put back the URL of the old image.
  for (const img of article.querySelectorAll("img")) useVersion(img);
  addCopyButtons(article);
  return article;
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
