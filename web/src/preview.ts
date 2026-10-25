import { api, type ApiError } from "./api.ts";
import { serial } from "./serial.ts";
import { message, morphInto, prepare } from "./view.ts";

/** Typing pauses shorter than this share one render. */
const DELAY = 150;

async function render(path: string, content: string): Promise<HTMLElement> {
  try {
    const { html } = await api<{ html: string }>("POST", "/api/render", { path, content });
    return await prepare(html);
  } catch (error) {
    const article = document.createElement("article");
    article.className = "mdame-document";
    message(article, (error as ApiError).message);
    return article;
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
let target: HTMLElement | null = null;
let rendered = () => {};

/**
 * The server cannot stop a render, and a crafted file can take an hour:
 * a tab runs one render at a time, and the newest text waits for it.
 */
const queue = serial(reportError);
let next: { el: HTMLElement; path: string; content: string } | null = null;

/** Calls `listener` after each render: the preview's height may have changed. */
export function onRender(listener: () => void) {
  rendered = listener;
}

/** Renders `content` into `el` now, as the view would show it at `path`. */
export function show(el: HTMLElement, path: string, content: string) {
  clearTimeout(timer);
  target = el;
  next = { el, path, content };
  queue("render", async () => {
    if (!next) return;
    const { el, path, content } = next;
    next = null;
    const article = await render(path, content);
    if (target !== el) return;
    const shown = el.querySelector<HTMLElement>(":scope > article");
    if (shown) morphInto(shown, article);
    else el.replaceChildren(article);
    rendered();
  });
}

/** Renders `content` once typing pauses. */
export function update(path: string, content: () => string) {
  const el = target;
  if (!el) return;
  clearTimeout(timer);
  timer = setTimeout(() => show(el, path, content()), DELAY);
}

export function stop() {
  clearTimeout(timer);
  target = null;
  next = null;
}
