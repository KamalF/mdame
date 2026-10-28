import { indentLess, isolateHistory } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { syntaxHighlighting } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { Compartment, Prec, Text } from "@codemirror/state";
import { keymap, type Panel, showPanel } from "@codemirror/view";
import { classHighlighter } from "@lezer/highlight";
import { basicSetup, EditorView } from "codemirror";
import { type ApiError, isHeld, send } from "./api.ts";
import { lineBreakOf, reactToDisk, reloadChanges } from "./disk.ts";
import { tab, toggleMarker } from "./format.ts";
import * as preview from "./preview.ts";
import * as revisions from "./revisions.ts";
import { type Anchor, anchorTable, lineToTop, topToLine } from "./scrollsync.ts";
import { type Queue, serial } from "./serial.ts";
import { setupSplit } from "./split.ts";
import { load, store } from "./storage.ts";
import { message } from "./view.ts";

/** What `/api/source` answers, with its `ETag` as the version. */
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
  revisions: boolean;
}

interface Open {
  path: string;
  view: EditorView;
  split: HTMLElement;
  previewPane: HTMLElement;
  /** The version on disk that the text started from: a save sends it in
   * `If-Match`. */
  base: string;
  saved: EditorView["state"]["doc"];
  /** The file is gone from disk: the text is in no file, so leaving asks
   * first. */
  gone: boolean;
  modified: number;
  /** The file's own line break: CodeMirror's text uses `\n` only. */
  lineBreak: string;
  /** Saves and disk checks run one at a time: a check that reads the file
   * while a save writes it could reload the text from before the save. */
  queue: Queue;
  error: string | null;
}

/** CodeMirror's base theme is light: these follow the page's palette, dark too. */
const palette = EditorView.theme({
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--fg)" },
  ".cm-selectionBackground": { background: "var(--selection)" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
    background: "var(--selection)",
  },
  // Translucent: the selection layer is drawn below the lines.
  ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--fg) 4%, transparent)" },
  ".cm-gutters": {
    backgroundColor: "var(--bg-sunken)",
    color: "var(--fg-muted)",
    borderRight: "1px solid var(--border)",
  },
  ".cm-activeLineGutter": { backgroundColor: "var(--bg-raised)" },
  // The completion list: its text has the page's colour.
  ".cm-tooltip": { backgroundColor: "var(--bg-raised)", border: "1px solid var(--border)" },
});

let open: Open | null = null;
const notice = new Compartment();
let request = 0;
let onState: (state: EditorState) => void = () => {};

function report() {
  if (!open) return;
  onState({
    path: open.path,
    modified: open.modified,
    // Undoing back to the saved text clears the dot.
    dirty: isDirty(),
    error: open.error,
    preview: previewOn,
    revisions: revisions.isShown(),
  });
}

/** Kept here as well: the browser may refuse to store it. */
let previewOn = true;

async function fetchSource(path: string): Promise<Source> {
  const response = await send("GET", `/api/source?path=${encodeURIComponent(path)}`);
  return { ...(await response.json()), version: etagOf(response) };
}

/** Quotes included: a save sends it back as it is. */
function etagOf(response: Response): string {
  return response.headers.get("ETag")!;
}

/** The last mount failed: its reason is on screen, and no editor is. */
let failed = false;

export function mountFailed(): boolean {
  return failed;
}

/** Opens `path` in `el`, in diff mode if `withRevisions`. If it fails,
 * `el` shows the reason. */
export async function mount(
  el: HTMLElement,
  path: string,
  listener: (state: EditorState) => void,
  withRevisions = false,
) {
  unmount();
  const id = ++request;
  onState = listener;
  failed = false;
  let source: Source;
  try {
    source = await fetchSource(path);
  } catch (error) {
    if (id !== request) return;
    failed = true;
    message(el, (error as ApiError).message);
    return;
  }
  if (id !== request) return;
  const view = new EditorView({
    doc: source.content,
    extensions: [
      // High precedence: basicSetup binds Mod-i to "select the enclosing syntax".
      Prec.high(
        keymap.of([
          { key: "Mod-b", run: toggleMarker("**") },
          { key: "Mod-i", run: toggleMarker("*") },
          { key: "Tab", run: tab, shift: indentLess },
        ]),
      ),
      basicSetup,
      palette,
      notice.of([]),
      revisions.diffMode.of([]),
      // GitHub-flavoured, as the view renders it.
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      syntaxHighlighting(classHighlighter),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) return;
        report();
        if (revisions.isShown()) revisions.textChanged();
        // While mdame is away, the last preview stays: a reconnection
        // renders it again.
        else if (!isHeld()) preview.update(path, () => update.state.doc.toString());
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
  // Another tab may have changed it.
  previewOn = load("mdame:preview", previewOn);
  split.classList.toggle("preview-hidden", !previewOn);
  split.append(host, divider, previewPane);
  setupSplit(split, divider);
  el.replaceChildren(split);
  preview.onRender(linkScroll(view, previewPane));
  if (previewOn) preview.show(previewPane, path, source.content);
  open = {
    path,
    view,
    split,
    previewPane,
    base: source.version,
    saved: view.state.doc,
    gone: false,
    modified: source.modified,
    lineBreak: lineBreakOf(source.content),
    queue: serial(reportError),
    error: null,
  };
  report();
  view.focus();
  if (withRevisions) toggleRevisions();
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
    const blocks = [...pane.querySelectorAll("[data-sourcepos]")]
      // The content of a closed <details> has no box: its rect of zeros
      // would be an anchor at the current scroll position.
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => ({
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

/** Renders the preview again, after a reconnection: a render that failed
 * while mdame was away left its error on screen. */
export function refreshPreview() {
  if (!open || !previewOn || revisions.isShown()) return;
  preview.show(open.previewPane, open.path, open.view.state.doc.toString());
}

export function togglePreview() {
  if (!open) return;
  previewOn = !previewOn;
  store("mdame:preview", previewOn);
  open.split.classList.toggle("preview-hidden", !previewOn);
  if (!previewOn) preview.stop();
  else if (!isHeld()) preview.show(open.previewPane, open.path, open.view.state.doc.toString());
  report();
}

export function unmount() {
  request++;
  revisions.hide();
  preview.stop();
  // Its listener holds the closed editor and its whole text.
  preview.onRender(() => {});
  open?.view.destroy();
  open = null;
}

/** Diff mode: the text against a revision, with the list of revisions in
 * the place of the preview. */
export function toggleRevisions() {
  const current = open;
  if (!current) return;
  if (revisions.isShown()) {
    closeRevisions();
    return;
  }
  preview.stop();
  current.split.classList.add("diff-mode");
  const actions = {
    close: closeRevisions,
    restore: (id: string, content: string) => restore(current, id, content),
  };
  current.split.append(revisions.show(current.view, current.path, actions));
  report();
}

export function closeRevisions() {
  const current = open;
  if (!current || !revisions.isShown()) return;
  revisions.hide();
  current.split.classList.remove("diff-mode");
  if (!isHeld()) refreshPreview();
  report();
  current.view.focus();
}

export function revisionsShown(): boolean {
  return revisions.isShown();
}

/** The path in the editor, or null when it is closed. */
export function openPath(): string | null {
  return open?.path ?? null;
}

export function isDirty(): boolean {
  return open !== null && (open.gone || !open.view.state.doc.eq(open.saved));
}

/** If a save is asked for during another save, it runs next. A dropped
 * save would lose the text typed meanwhile, and Overwrite would move the
 * base without a save. */
export function save() {
  const current = open;
  if (!current) return;
  current.queue("save", async () => {
    const doc = current.view.state.doc;
    try {
      const response = await send(
        "PUT",
        `/api/file?path=${encodeURIComponent(current.path)}`,
        { content: doc.sliceString(0, doc.length, current.lineBreak) },
        { "If-Match": current.base },
      );
      const saved: { modified: number } = await response.json();
      // The text typed during the save is still unsaved.
      current.base = etagOf(response);
      current.saved = doc;
      current.gone = false;
      current.modified = saved.modified;
      current.error = null;
      if (open === current) {
        setNotice(current, null);
        revisions.refresh();
      }
    } catch (error) {
      const { code, message } = error as ApiError;
      // The file changed or went away on disk: the notice tells which.
      if (code === "precondition_failed") await compare(current, true);
      else current.error = message;
    }
    if (open === current) report();
  });
}

/** Writes the revision `id` over the file, then takes its text as Reload
 * does: Ctrl+Z brings back the text from before, unsaved edits too. */
function restore(current: Open, id: string, content: string) {
  // Per revision: the queue drops a waiting task asked for again.
  current.queue(`restore ${id}`, async () => {
    try {
      const response = await send("POST", "/api/history/restore", { path: current.path, id });
      const restored: { modified: number } = await response.json();
      if (open !== current) return;
      reload(current, { content, version: etagOf(response), modified: restored.modified });
      setNotice(current, null);
      current.error = null;
    } catch (error) {
      current.error = (error as ApiError).message;
    }
    if (open !== current) return;
    // The text from before the restore is now the newest revision.
    revisions.refresh();
    report();
  });
}

/** Compares the file on disk with the editor's text, after an event about it. */
export function checkDisk() {
  if (open) check(open);
}

function check(current: Open) {
  current.queue("check", () => compare(current, false));
}

/** `refused`: the server refused a save with 412 just before. */
async function compare(current: Open, refused: boolean) {
  let disk: Source | null = null;
  try {
    disk = await fetchSource(current.path);
  } catch (error) {
    if ((error as ApiError).code !== "not_found") {
      current.error = (error as ApiError).message;
      if (open === current) report();
      return;
    }
  }
  if (open !== current) return;
  current.gone = disk === null;
  const reaction = reactToDisk(disk, current.base, isDirty());
  if (reaction.kind === "reload") reload(current, reaction.disk);
  setNotice(current, reaction.kind === "notice" ? noticePanel(current, reaction.disk) : null);
  // The same text came back on disk, by a rename for example: no notice,
  // but the save did not happen.
  if (refused && reaction.kind === "ignore") {
    current.error = "Save again: the file was replaced on disk during the save.";
  }
  // A save from another tab adds a revision.
  revisions.refresh();
  report();
}

/** Ctrl+Z undoes the reload alone, which brings back the unsaved edits. */
function reload(current: Open, disk: Source) {
  const { view } = current;
  view.dispatch({
    changes: reloadChanges(view.state.doc.toString(), disk.content),
    annotations: isolateHistory.of("full"),
  });
  current.base = disk.version;
  current.saved = view.state.doc;
  current.modified = disk.modified;
  current.lineBreak = lineBreakOf(disk.content);
  report();
}

function setNotice(current: Open, panel: Panel | null) {
  current.view.dispatch({
    effects: notice.reconfigure(panel ? showPanel.of(() => panel) : []),
  });
}

/** `disk` is null when the file is gone: Recreate takes the place of Reload
 * and Overwrite. */
function noticePanel(current: Open, disk: Source | null): Panel {
  const dom = document.createElement("div");
  dom.className = "mdame-disk-notice";
  dom.setAttribute("role", "alert");
  const text = document.createElement("span");
  text.textContent = disk ? "This file changed on disk." : "This file was deleted on disk.";
  dom.append(text);
  if (disk) {
    const reloadButton = noticeButton(
      "Reload",
      "Replace your edits with the file on disk. Ctrl+Z brings them back.",
    );
    reloadButton.addEventListener("click", () => {
      reload(current, disk);
      setNotice(current, null);
      current.view.focus();
    });
    const overwrite = noticeButton(
      "Overwrite",
      "Save your text over the file on disk. Its current text is kept as a revision.",
    );
    overwrite.addEventListener("click", () => {
      current.base = disk.version;
      save();
      current.view.focus();
    });
    dom.append(reloadButton, overwrite);
  } else {
    const recreateButton = noticeButton("Recreate", "Create the file again with your text.");
    recreateButton.addEventListener("click", () => {
      recreate(current);
      current.view.focus();
    });
    dom.append(recreateButton);
  }
  return { dom, top: true };
}

/** Creates the deleted file again, empty, then saves the text into it. */
function recreate(current: Open) {
  current.queue("recreate", async () => {
    try {
      const created = await send("POST", "/api/file", { path: current.path });
      current.base = etagOf(created);
      // The file on disk is empty: the text is unsaved until the save lands,
      // so leaving asks first.
      current.saved = Text.empty;
      current.gone = false;
    } catch (error) {
      current.error = (error as ApiError).message;
      if (open === current) report();
      return;
    }
    // Asked for once the file exists. If a save was queued before this
    // task, an earlier call would merge into it, and that save runs too
    // early.
    if (open === current) save();
  });
}

function noticeButton(label: string, title: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "mdame-status-button";
  button.textContent = label;
  button.title = title;
  return button;
}

addEventListener("beforeunload", (event) => {
  if (isDirty()) event.preventDefault();
});

// Cmd/Ctrl+S saves from anywhere on the page, not only from the editor,
// and never opens the browser's own save dialog. Caps Lock gives "S".
addEventListener("keydown", (event: KeyboardEvent) => {
  if (!open || event.key.toLowerCase() !== "s" || !(event.ctrlKey || event.metaKey)) return;
  if (event.altKey || event.shiftKey) return;
  event.preventDefault();
  save();
});
