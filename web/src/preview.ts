import { api, type ApiError } from "./api.ts";
import { latestOnly } from "./latest.ts";
import { morphInto, prepare } from "./view.ts";

/** Typing pauses shorter than this share one render. */
const DELAY = 150;

const render = latestOnly(async (path: string, content: string): Promise<HTMLElement> => {
  try {
    const { html } = await api<{ html: string }>("POST", "/api/render", { path, content });
    return await prepare(html);
  } catch (error) {
    const article = document.createElement("article");
    article.className = "mdame-document";
    const line = document.createElement("p");
    line.className = "mdame-placeholder";
    line.textContent = (error as ApiError).message;
    article.append(line);
    return article;
  }
});

let timer: ReturnType<typeof setTimeout> | undefined;
let target: HTMLElement | null = null;
let rendered = () => {};

/** Calls `listener` after each render: the preview's height may have changed. */
export function onRender(listener: () => void) {
  rendered = listener;
}

/** Renders `content` into `el` now, as the view would show it at `path`. */
export async function show(el: HTMLElement, path: string, content: string) {
  clearTimeout(timer);
  target = el;
  const article = await render(path, content);
  if (!article || target !== el) return;
  const shown = el.querySelector<HTMLElement>(":scope > article");
  if (shown) morphInto(shown, article);
  else el.replaceChildren(article);
  rendered();
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
}
