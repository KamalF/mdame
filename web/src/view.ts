import "../styles/content.css";
// After content.css, whose rules it overrides on paper.
import "../styles/print.css";
import { Idiomorph } from "idiomorph";
import { api, type ApiError } from "./api.ts";
import { blocksOf, clearBars, drawBars } from "./bars.ts";
import { Seen } from "./changes.ts";
import { copyButton } from "./copy.ts";
import { highlightAll } from "./codehl.ts";
import { renderDiagrams } from "./diagrams.ts";
import { scrolledTo, showOutline } from "./outline.ts";
import { blockAt } from "./search.ts";
import { encodePath } from "./sidebar.ts";
import { watchWide } from "./wide.ts";
import { forgetWords } from "./words.ts";

/** What `/api/file` answers. */
export interface FileView {
  html: string;
  /** Null for an image, and over 1 MB. */
  source: string | null;
  family: string;
  modified: number;
  size: number;
  too_large: boolean;
  editable: boolean;
}

export function message(el: HTMLElement, text: string) {
  const line = document.createElement("p");
  line.className = "mdame-placeholder";
  line.textContent = text;
  el.replaceChildren(line);
}

let request = 0;
/** The file on screen, as `{path, file}`. */
let shown: { path: string; file: FileView } | undefined;

const seen = new Seen();
/** The file that the view showed last, with its source, until the view
 * leaves it. */
let onScreen: { path: string; source: string | null } | undefined;

/** The view leaves the file on screen for `next`, and keeps its version
 * last seen. The editor of the same file does not leave it: diff mode
 * compares with the version that the view saw before. */
function leaveFor(next: string | null) {
  if (!onScreen || onScreen.path === next) return;
  if (onScreen.source !== null) seen.leave(onScreen.path, onScreen.source);
  onScreen = undefined;
}

/** The editor of `path` closes, with `source` on disk as it held it: that
 * text was on screen last. */
export function editorClosed(path: string, source: string) {
  onScreen = { path, source };
}

/** The version of `path` that the change bars compare with, if the view
 * showed it. */
export function lastSeen(path: string): string | undefined {
  return seen.version(path);
}

/** Draws the change bars of `file` in `article`, and their dots in the
 * outline. */
function bars(article: HTMLElement, path: string, file: FileView) {
  if (file.source === null) {
    clearBars(article);
    showOutline(article);
    return;
  }
  const { marks, blocks } = drawBars(article, seen.baseline(path, file.source), file.source);
  showOutline(article, marks, blocks);
}

export function rawUrl(path: string): string {
  return "/raw/" + encodePath(path);
}

/** The server points links to `/raw/`, as images; links open in the app. */
export function viewHref(href: string): string {
  return "/view/" + href.slice("/raw/".length);
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
  leaveFor(path);
  const file = await fetchFile(el, path, id);
  if (!file) return null;
  shown = { path, file };
  onScreen = { path, source: file.source };
  // Now, not with the bars: a change on disk while the diagrams draw would
  // become the version last seen.
  if (file.source !== null) seen.baseline(path, file.source);
  const article = articleFor(file.html);
  el.replaceChildren(article);
  watchWide(article);
  el.scrollTop = 0;
  // Before the scroll: with Full, the outline narrows the column, and the
  // text wraps again. The dots come with the bars.
  showOutline(article);
  scrollToHash();
  highlightAll(article);
  renderDiagrams(article).then(() => {
    if (id !== request) return;
    // A diagram above the `#…` target moves it once drawn.
    scrollToHash();
    // A bar on a diagram marks the drawing, not its code.
    bars(article, path, file);
  });
  return file;
}

/**
 * Shows the new content of the file on screen, replacing only what changed,
 * as `morphInto` does. A file that failed to show, such as a deleted one
 * now back, is shown anew.
 */
export async function refreshFile(el: HTMLElement, path: string): Promise<FileView | null> {
  if (shown?.path !== path) return showFile(el, path);
  const id = ++request;
  const file = await fetchFile(el, path, id);
  if (!file) return null;
  const onPage = el.querySelector<HTMLElement>(":scope > article")!;
  const article = articleFor(file.html);
  const change = await prepare(article, onPage);
  if (id !== request) return null;
  shown = { path, file };
  onScreen = { path, source: file.source };
  clearBars(onPage);
  morphInto(onPage, article, change);
  bars(onPage, path, file);
  return file;
}

/** The top-level nodes of `next` that differ from those of the article on
 * screen: all but `start` nodes at the start and `end` at the end. */
export interface Change {
  start: number;
  end: number;
}

/**
 * Colours the code of `next`, an article from `articleFor`, and draws its
 * diagrams, so that `morphInto` shows no flash of plain code. With
 * `shown`, the article on screen, only the blocks that differ from it:
 * a dense 1 MB file has 2,000 code blocks.
 */
export async function prepare(next: HTMLElement, shown?: HTMLElement): Promise<Change> {
  // idiomorph over the whole article costs more than linear time in its
  // blocks: 4 s for a dense 1 MB file. An edit changes a few blocks, so
  // the unchanged ones at the start and the end stay as they are. Nodes,
  // not elements: an HTML block can leave text between the blocks.
  const was = shown ? keysOf(shown) : [];
  const now = keysOf(next);
  let start = 0;
  while (start < was.length && start < now.length && was[start] === now[start]) start++;
  let end = 0;
  while (
    end < was.length - start &&
    end < now.length - start &&
    was[was.length - 1 - end] === now[now.length - 1 - end]
  ) {
    end++;
  }
  const nodes = [...next.childNodes];
  const changed = new Set<Node>(nodes.slice(start, nodes.length - end));
  const inChange = (element: Element) => {
    let node: Node = element;
    while (node.parentNode !== next) node = node.parentNode!;
    return changed.has(node);
  };
  await Promise.all([highlightAll(next, inChange), renderDiagrams(next, inChange)]);
  // An image may have changed during the wait above.
  for (const img of next.querySelectorAll("img")) useVersion(img);
  return { start, end };
}

/** Replaces only what differs between `shown` and `next`, as `prepare`
 * found it. The scroll position stays. A text selection and an open
 * `<details>` stay if no block changes above them, or none below them. */
export function morphInto(shown: HTMLElement, next: HTMLElement, { start, end }: Change) {
  const config = {
    callbacks: {
      // The server's HTML never has it: a `<details>` the reader opened
      // stays open.
      beforeAttributeUpdated: (name: string, _: Element, type: string) =>
        !(type === "remove" && name === "open"),
    },
  };
  const old = [...shown.childNodes];
  const neu = [...next.childNodes];
  // An edit above them moves their lines.
  for (let i = 0; i < start; i++) copyLines(old[i], neu[i]);
  for (let i = 1; i <= end; i++) copyLines(old[old.length - i], neu[neu.length - i]);
  const oldMiddle = old.slice(start, old.length - end);
  const newMiddle = neu.slice(start, neu.length - end);
  const pairs = Math.min(oldMiddle.length, newMiddle.length);
  for (let i = 0; i < pairs; i++) {
    const [was, now] = [oldMiddle[i], newMiddle[i]];
    if (was instanceof Element && now instanceof Element) {
      Idiomorph.morph(was, now, config);
      forgetWords(was);
    } else {
      was.replaceWith(now);
    }
  }
  for (const removed of oldMiddle.slice(pairs)) removed.remove();
  const before = end > 0 ? old[old.length - end] : null;
  for (const added of newMiddle.slice(pairs)) shown.insertBefore(added, before);
  keys.set(shown, keysOf(next));
  // idiomorph inserts copies of new nodes, without their click listeners.
  for (const block of shown.querySelectorAll(".mdame-code")) {
    const button = block.querySelector(":scope > button");
    if (button && !copyButtons.has(button)) button.replaceWith(codeCopyButton(block));
  }
}

/** The keys of each article's top-level nodes, from the server's HTML:
 * highlighting and diagrams change the nodes, but not what they show.
 * Each node on screen pairs with the node of the same index here: a
 * diagram replaces its code block, and a failed one wraps it. */
const keys = new WeakMap<HTMLElement, string[]>();

/** A message or a notice is not from the server's HTML, and its nodes are
 * their own keys. */
function keysOf(article: HTMLElement): string[] {
  let found = keys.get(article);
  if (!found) {
    found = [...article.childNodes].map(key);
    keys.set(article, found);
  }
  return found;
}

/** A node's HTML without what a fresh render does not decide: the values
 * of the line numbers, which an edit above moves, and the `open` that the
 * reader gives a `<details>`. The attribute of a line number stays, so
 * that equal nodes have the same elements to copy lines between. Inside
 * tags only: a text can hold the same words, but its `<` and `>` are
 * escaped. */
function key(node: Node): string {
  if (!(node instanceof Element)) return `${node.nodeType} ${node.textContent ?? ""}`;
  return node.outerHTML.replace(/( data-sourcepos)="[^"]*"(?=[^<>]*>)| open=""(?=[^<>]*>)/g, "$1");
}

/** The elements of `node` that have a line number, `node` first if it
 * has one. */
function withLines(node: Element): Element[] {
  const inside = [...node.querySelectorAll("[data-sourcepos]")];
  return node.hasAttribute("data-sourcepos") ? [node, ...inside] : inside;
}

/** Gives `shown` the line numbers of `next`, an equal node. `next` may be
 * a code block that `shown` turned into a diagram. */
function copyLines(shown: Node, next: Node) {
  if (!(shown instanceof Element && next instanceof Element)) return;
  const to = withLines(shown);
  withLines(next).forEach((element, i) => {
    const lines = element.getAttribute("data-sourcepos")!;
    if (to[i].getAttribute("data-sourcepos") !== lines) to[i].setAttribute("data-sourcepos", lines);
  });
}

/** The path of the file on screen, if one is. */
export function shownPath(): string | undefined {
  return shown?.path;
}

export function shownFile(): FileView | undefined {
  return shown?.file;
}

/** `from` moved to `to`: its version last seen follows it. */
export function renameSeen(from: string, to: string) {
  seen.rename(from, to);
  if (onScreen?.path === from) onScreen = { ...onScreen, path: to };
}

/** The file on screen moved to `path`: a refresh then patches it in place. */
export function renameShown(path: string) {
  if (!shown) return;
  renameSeen(shown.path, path);
  shown = { ...shown, path };
}

/** The file, or null when it failed or request `id` is no longer the latest. */
async function fetchFile(el: HTMLElement, path: string, id: number): Promise<FileView | null> {
  try {
    const file = await api<FileView>("GET", `/api/file?path=${encodeURIComponent(path)}`);
    return id === request ? file : null;
  } catch (error) {
    // A click on another file meanwhile wins over this answer.
    if (id !== request) return null;
    shown = undefined;
    notFound(el, path, error as ApiError);
    return null;
  }
}

/** When the workspace last changed, if it changed since the page loaded.
 * Workspace images carry it in their URL, or the browser would keep
 * showing the copy that it has. */
let version: number | undefined;

function useVersion(img: HTMLImageElement) {
  // The sanitizer removes a `src` it refuses, such as `data:`, and "" is no URL.
  if (version === undefined || !img.src) return;
  const url = new URL(img.src);
  // An image from elsewhere keeps its URL.
  if (url.origin !== location.origin || !url.pathname.startsWith("/raw/")) return;
  url.searchParams.set("v", String(version));
  const src = url.pathname + url.search;
  if (img.getAttribute("src") !== src) img.src = src;
}

/** Reloads the workspace images in `el` after a change on disk. Any change
 * reloads all of them: they are local, so a reload costs little. */
export function refreshImages(el: HTMLElement) {
  version = Date.now();
  for (const img of el.querySelectorAll("img")) useVersion(img);
}

export function articleFor(html: string): HTMLElement {
  const article = document.createElement("article");
  article.className = "mdame-document";
  // Sanitized by the server.
  article.innerHTML = html;
  for (const link of article.querySelectorAll('a[href^="/raw/"]')) {
    link.setAttribute("href", viewHref(link.getAttribute("href")!));
  }
  // A morph would otherwise put back the URL of the old image.
  for (const img of article.querySelectorAll("img")) useVersion(img);
  addCopyButtons(article);
  markImages(article);
  keysOf(article);
  return article;
}

/** Marks each paragraph that holds an image alone, maybe in a link: it
 * may grow past the column, as the other wide blocks do. */
function markImages(article: HTMLElement) {
  for (const p of article.querySelectorAll(":scope > p:has(img)")) {
    const nodes = [...p.childNodes].filter(
      (node) => node.nodeType !== Node.TEXT_NODE || node.textContent!.trim() !== "",
    );
    const [only] = nodes;
    // `:only-child` skips text: a link may hold text beside its image.
    const alone = only instanceof Element && only.textContent!.trim() === "";
    if (nodes.length === 1 && alone && only.matches("img, a:has(> img:only-child)")) {
      p.classList.add("mdame-image");
    }
  }
}

function addCopyButtons(root: HTMLElement) {
  for (const code of root.querySelectorAll("pre > code:not(.language-mermaid)")) {
    const pre = code.parentElement!;
    const block = document.createElement("div");
    block.className = "mdame-code";
    pre.replaceWith(block);
    block.append(pre, codeCopyButton(block));
  }
}

/** The buttons that have their click listener. */
const copyButtons = new WeakSet<Element>();

/** Reads the code when clicked: a morph can put new code in the block. */
function codeCopyButton(block: Element) {
  const text = () => block.querySelector("code")?.textContent ?? "";
  const button = copyButton({ label: "Copy code", iconName: "copy", text });
  copyButtons.add(button);
  return button;
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

/** Forgets the file on screen, as another screen replaces it: the next
 * `showFile` renders it anew. `editing` is the file that the editor opens. */
export function forget(editing: string | null = null) {
  request++;
  shown = undefined;
  leaveFor(editing);
}

/** The page with no file chosen; `empty` when the workspace shows none. */
export function showNothing(el: HTMLElement, empty: boolean) {
  forget();
  message(
    el,
    empty
      ? "This folder has no file that mdame shows: markdown, text, JSON, YAML, TOML, GraphQL, CSV, Mermaid or images. Files that .gitignore hides are left out."
      : "Choose a file in the sidebar.",
  );
}

/** Scrolls to the heading or footnote that the URL's `#…` names, or to
 * the block of a source line, as `#L12` from the search panel names it. */
export function scrollToHash() {
  if (!location.hash) return;
  let id: string;
  try {
    id = decodeURIComponent(location.hash.slice(1));
  } catch {
    return;
  }
  const target = document.getElementById(id);
  const line = /^L(\d+)$/.exec(id);
  if (target) {
    target.scrollIntoView();
    scrolledTo(target);
    return;
  }
  if (!line) return;
  const { blocks, elements } = blocksOf(document.querySelector("#mdame-content > article"));
  // Other types have no blocks: they stay at the top.
  elements[blockAt(blocks, Number(line[1]))]?.scrollIntoView({ block: "center" });
}
