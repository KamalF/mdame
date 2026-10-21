import { markdown } from "@codemirror/lang-markdown";
import { syntaxHighlighting } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { classHighlighter } from "@lezer/highlight";
import { basicSetup, EditorView } from "codemirror";
import { api, type ApiError } from "./api.ts";
import * as preview from "./preview.ts";
import { type Anchor, anchorTable, lineToTop, topToLine } from "./scrollsync.ts";
import { setupSplit } from "./split.ts";
import { load, store } from "./storage.ts";

/** What `/api/source` answers. */
interface Source {
  content: string;
  version: string;
  modified: number;
}

/** What the status bar shows while editing. */
export interface EditorState {
  path: string;
  modified: number;
  dirty: boolean;
  error: string | null;
  preview: boolean;
}

interface Open {
  path: string;
  view: EditorView;
  split: HTMLElement;
  previewPane: HTMLElement;
  /** The version on disk that the text started from: a save sends it. */
  base: string;
  saved: EditorView["state"]["doc"];
  modified: number;
  saving: boolean;
  error: string | null;
}

let open: Open | null = null;
let request = 0;
let onState: (state: EditorState) => void = () => {};

function report() {
  if (!open) return;
  onState({
    path: open.path,
    modified: open.modified,
    // Undoing back to the saved text clears the dot.
    dirty: !open.view.state.doc.eq(open.saved),
    error: open.error,
    preview: previewShown(),
  });
}

function previewShown(): boolean {
  return load("mdame:preview", true);
}

/** Opens `path` in `el`. Returns false if it failed, with the reason in
 * `el`, or if a later call replaced this one. */
export async function mount(
  el: HTMLElement,
  path: string,
  listener: (state: EditorState) => void,
): Promise<boolean> {
  unmount();
  const id = ++request;
  onState = listener;
  let source: Source;
  try {
    source = await api<Source>("GET", `/api/source?path=${encodeURIComponent(path)}`);
  } catch (error) {
    if (id !== request) return false;
    const line = document.createElement("p");
    line.className = "mdame-placeholder";
    line.textContent = (error as ApiError).message;
    el.replaceChildren(line);
    return false;
  }
  if (id !== request) return false;
  const view = new EditorView({
    doc: source.content,
    extensions: [
      basicSetup,
      markdown({ codeLanguages: languages }),
      syntaxHighlighting(classHighlighter),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) return;
        report();
        preview.update(path, () => update.state.doc.toString());
      }),
    ],
  });
  const host = document.createElement("div");
  host.className = "mdame-editor";
  host.append(view.dom);
  const divider = document.createElement("div");
  divider.className = "mdame-divider";
  const previewPane = document.createElement("div");
  previewPane.className = "mdame-preview";
  const split = document.createElement("div");
  split.className = "mdame-split";
  split.classList.toggle("preview-hidden", !previewShown());
  split.append(host, divider, previewPane);
  setupSplit(split, divider);
  el.replaceChildren(split);
  preview.onRender(linkScroll(view, previewPane));
  if (previewShown()) preview.show(previewPane, path, source.content);
  open = {
    path,
    view,
    split,
    previewPane,
    base: source.version,
    saved: view.state.doc,
    modified: source.modified,
    saving: false,
    error: null,
  };
  report();
  view.focus();
  return true;
}

/**
 * Keeps the two panes on the same part of the document: scrolling one
 * scrolls the other. Returns the function that aligns the preview with
 * the editor, for after a render.
 */
function linkScroll(view: EditorView, pane: HTMLElement): () => void {
  const scroller = view.scrollDOM;
  // The position that this code set last on each pane: its own scroll
  // event must not move the other pane back.
  const set = new Map<HTMLElement, number>();

  function table(): Anchor[] {
    const origin = pane.getBoundingClientRect().top - pane.scrollTop;
    const blocks = [...pane.querySelectorAll("[data-sourcepos]")].map((el) => ({
      line: parseInt(el.getAttribute("data-sourcepos")!),
      top: el.getBoundingClientRect().top - origin,
    }));
    return anchorTable(blocks, view.state.doc.lines, pane.scrollHeight);
  }

  /** The source line at the top of the editor, fractional. */
  function editorLine(): number {
    const height = scroller.getBoundingClientRect().top - view.documentTop;
    const block = view.lineBlockAtHeight(height);
    const fraction = Math.min(1, Math.max(0, (height - block.top) / block.height));
    return view.state.doc.lineAt(block.from).number + fraction;
  }

  function scrollEditorTo(line: number) {
    const doc = view.state.doc;
    const number = Math.min(doc.lines, Math.max(1, Math.floor(line)));
    const block = view.lineBlockAt(doc.line(number).from);
    // Where the document starts, in the scroller's own coordinates.
    const start = view.documentTop - scroller.getBoundingClientRect().top + scroller.scrollTop;
    setScroll(scroller, start + block.top + (line - number) * block.height);
  }

  function setScroll(el: HTMLElement, top: number) {
    el.scrollTop = top;
    set.set(el, el.scrollTop);
  }

  function follow(source: HTMLElement, sync: () => void) {
    let frame = 0;
    source.addEventListener("scroll", () => {
      if (Math.abs(source.scrollTop - (set.get(source) ?? -1)) < 1) return;
      set.delete(source);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    });
  }

  const alignPreview = () => setScroll(pane, lineToTop(table(), editorLine()));
  follow(scroller, alignPreview);
  follow(pane, () => scrollEditorTo(topToLine(table(), pane.scrollTop)));
  return alignPreview;
}

export function togglePreview() {
  if (!open) return;
  const shown = !previewShown();
  store("mdame:preview", shown);
  open.split.classList.toggle("preview-hidden", !shown);
  if (shown) preview.show(open.previewPane, open.path, open.view.state.doc.toString());
  else preview.stop();
  report();
}

export function unmount() {
  request++;
  preview.stop();
  open?.view.destroy();
  open = null;
}

/** The path in the editor, or null when it is closed. */
export function openPath(): string | null {
  return open?.path ?? null;
}

export function isDirty(): boolean {
  return open !== null && !open.view.state.doc.eq(open.saved);
}

export async function save() {
  if (!open || open.saving) return;
  const current = open;
  const doc = current.view.state.doc;
  current.saving = true;
  try {
    const saved = await api<{ version: string; modified: number }>(
      "PUT",
      `/api/file?path=${encodeURIComponent(current.path)}`,
      { content: doc.toString(), base_version: current.base },
    );
    // The text typed during the save is still unsaved.
    current.base = saved.version;
    current.saved = doc;
    current.modified = saved.modified;
    current.error = null;
  } catch (error) {
    current.error = (error as ApiError).message;
  } finally {
    current.saving = false;
  }
  if (open === current) report();
}

addEventListener("beforeunload", (event) => {
  if (isDirty()) event.preventDefault();
});

// Cmd/Ctrl+S saves from anywhere on the page, not only from the editor,
// and never opens the browser's own save dialog.
addEventListener("keydown", (event: KeyboardEvent) => {
  if (!open || event.key !== "s" || !(event.ctrlKey || event.metaKey)) return;
  if (event.altKey || event.shiftKey) return;
  event.preventDefault();
  save();
});
