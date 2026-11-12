import { api, type ApiError } from "./api.ts";
import { serial } from "./serial.ts";
import { message, morphInto, prepare } from "./view.ts";
import { watchWide } from "./wide.ts";

/** Typing pauses shorter than this share one render. */
const DELAY = 150;

/** The server renders no text over 1 MB, in UTF-8. */
export const RENDER_LIMIT = 1024 * 1024;

/** The length of `text` in UTF-8, without encoding it. */
export function utf8Length(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    // A surrogate is half of a 4-byte character.
    bytes += unit < 0x80 ? 1 : unit < 0x800 || (unit >= 0xd800 && unit <= 0xdfff) ? 2 : 3;
  }
  return bytes;
}

/** Whether the server would answer `text` with its notice: a request of
 * up to 8 MB at each typing pause, for one line. */
export function overRenderLimit(text: string): boolean {
  // A UTF-16 unit takes 1 to 3 bytes.
  if (text.length > RENDER_LIMIT) return true;
  return text.length * 3 > RENDER_LIMIT && utf8Length(text) > RENDER_LIMIT;
}

async function render(path: string, content: string): Promise<HTMLElement> {
  if (overRenderLimit(content)) {
    const article = document.createElement("article");
    article.className = "mdame-document";
    const notice = document.createElement("p");
    notice.className = "mdame-notice";
    notice.textContent = "This file is over 1 MB, too large to preview.";
    article.append(notice);
    return article;
  }
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
    else {
      el.replaceChildren(article);
      watchWide(article);
    }
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
