import { markdown } from "@codemirror/lang-markdown";
import { syntaxHighlighting } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { classHighlighter } from "@lezer/highlight";
import { basicSetup, EditorView } from "codemirror";
import { api, type ApiError } from "./api.ts";

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
}

interface Open {
  path: string;
  view: EditorView;
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
  });
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
      EditorView.updateListener.of((update) => update.docChanged && report()),
    ],
  });
  const host = document.createElement("div");
  host.className = "mdame-editor";
  host.append(view.dom);
  el.replaceChildren(host);
  open = {
    path,
    view,
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

export function unmount() {
  request++;
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
