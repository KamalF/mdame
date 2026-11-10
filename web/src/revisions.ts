import { type Chunk, getChunks, getOriginalDoc, MergeView, unifiedMergeView } from "@codemirror/merge";
import { type ChangeSet, Compartment, EditorState, type Extension, Text } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { api, type ApiError } from "./api.ts";
import { iconButton } from "./icons.ts";
import { load, store } from "./storage.ts";

/** What `/api/history` gives for each revision. */
export interface Revision {
  id: string;
  /** Unix milliseconds. */
  time: number;
  size: number;
}

/** The id of the "Last seen" entry: a snapshot's id is a time. */
export const LAST_SEEN = "last-seen";

/** A line of the list: a revision, or "Last seen", which has no time. */
type Entry = Revision | { id: typeof LAST_SEEN; time: null; size: number };

/**
 * The entries of the list: "Last seen" comes first when the file on disk,
 * `onDisk`, differs from the version `seen` that the change bars compare
 * with. Line breaks do not count: the editor's text has `\n` only.
 */
export function entries(revisions: Revision[], seen: string | undefined, onDisk: Text): Entry[] {
  if (seen === undefined || Text.of(seen.split(/\r\n?|\n/)).eq(onDisk)) return revisions;
  const size = new TextEncoder().encode(seen).length;
  return [{ id: LAST_SEEN, time: null, size }, ...revisions];
}

/** The request that writes the entry `id`, whose text is `content`, over
 * the file at `path`. A revision's restore needs no `If-Match`. "Last
 * seen" is a normal save from `base`, the version that the editor holds:
 * an agent that writes the file again meanwhile makes it fail. */
export function restoreRequest(
  path: string,
  id: string,
  content: string,
  base: string,
): { method: string; url: string; body: unknown; headers: Record<string, string> } {
  if (id === LAST_SEEN) {
    return {
      method: "PUT",
      url: `/api/file?path=${encodeURIComponent(path)}`,
      body: { content },
      headers: { "If-Match": base },
    };
  }
  return { method: "POST", url: "/api/history/restore", body: { path, id }, headers: {} };
}

/** The editor's merge view: empty outside diff mode. */
export const diffMode = new Compartment();

export interface Actions {
  close: () => void;
  /** Writes the entry `id`, whose text is `content`, over the file. */
  restore: (id: string, content: string) => void;
  /** The text on disk, as the editor last loaded or saved it. */
  saved: () => Text;
  /** The version that the change bars compare with, if the view showed
   * the file. */
  lastSeen: () => string | undefined;
  /** The look of the editor, for the panes of the side-by-side layout. */
  look: Extension;
}

interface Shown {
  view: EditorView;
  path: string;
  aside: HTMLElement;
  error: HTMLElement;
  list: HTMLElement;
  actions: Actions;
  revisions: Entry[] | null;
  /** The revision that the text is compared with, or is about to be. */
  chosen: string | null;
  /** The revision in the merge view, and its text. */
  compared: { id: string; content: string } | null;
  restore: HTMLButtonElement;
  /** The size and counts of the chosen revision, which edits change. */
  detail: { el: HTMLElement; size: number } | null;
  /** The revision and the text, side by side, in place of the editor. */
  side: MergeView | null;
  layoutButton: HTMLButtonElement;
}

let shown: Shown | null = null;

const SIDE_BY_SIDE = "mdame:side-by-side";
/** Kept here as well: the browser may refuse to store it. */
let sideBySide = false;

/** Returns the list of the revisions of `path`, for the place of the
 * preview, and compares the text of `view` with the newest. */
export function show(view: EditorView, path: string, actions: Actions): HTMLElement {
  const aside = document.createElement("aside");
  aside.className = "mdame-revisions";
  aside.setAttribute("aria-label", "Revisions");
  const header = document.createElement("div");
  header.className = "mdame-revisions-header";
  const title = document.createElement("h2");
  title.textContent = "Revisions";
  // Another tab may have changed it.
  sideBySide = load(SIDE_BY_SIDE, sideBySide) === true;
  const layoutButton = iconButton("Side by side", "columns", () => {
    sideBySide = !sideBySide;
    store(SIDE_BY_SIDE, sideBySide);
    layoutButton.setAttribute("aria-pressed", String(sideBySide));
    layout(current);
  });
  layoutButton.setAttribute("aria-pressed", String(sideBySide));
  const close = iconButton("Close revisions", "cross", actions.close, "Close (Esc)");
  const buttons = document.createElement("div");
  buttons.append(layoutButton, close);
  header.append(title, buttons);
  const error = document.createElement("p");
  error.className = "mdame-status-error";
  error.setAttribute("role", "alert");
  const list = document.createElement("ul");
  list.className = "mdame-revisions-list";
  const restore = document.createElement("button");
  restore.className = "mdame-restore";
  restore.disabled = true;
  restore.textContent = "Restore";
  const note = document.createElement("p");
  note.textContent = "The text on disk becomes a revision first, so you can undo a restore.";
  const footer = document.createElement("div");
  footer.className = "mdame-revisions-footer";
  footer.append(restore, note);
  aside.append(header, error, list, footer);
  const current: Shown = {
    view,
    path,
    aside,
    error,
    list,
    actions,
    revisions: null,
    chosen: null,
    compared: null,
    restore,
    detail: null,
    side: null,
    layoutButton,
  };
  // The revision on screen, not the one that is loading.
  restore.addEventListener("click", () => {
    if (current.compared) actions.restore(current.compared.id, current.compared.content);
  });
  shown = current;
  refresh();
  return aside;
}

export function hide() {
  if (!shown) return;
  shown.view.dispatch({ effects: diffMode.reconfigure([]) });
  shown.compared = null;
  layout(shown);
  shown.aside.remove();
  shown = null;
}

export function isShown(): boolean {
  return shown !== null;
}

/** Lists the revisions again: a save adds one, and pruning removes some. */
export async function refresh() {
  const current = shown;
  if (!current) return;
  let listed: Revision[];
  try {
    listed = await api("GET", `/api/history?path=${encodeURIComponent(current.path)}`);
  } catch (error) {
    if (shown === current) current.error.textContent = (error as ApiError).message;
    return;
  }
  if (shown !== current) return;
  const { actions } = current;
  const revisions = entries(listed, actions.lastSeen(), actions.saved());
  current.revisions = revisions;
  current.error.textContent = "";
  // The chosen revision may be gone: pruning removes the oldest. Or it
  // failed to load, maybe while mdame was away: it loads again.
  const chosen = revisions.find((revision) => revision.id === current.chosen) ?? revisions[0];
  if (chosen && (chosen.id !== current.chosen || chosen.id !== current.compared?.id)) {
    choose(current, chosen.id);
  } else render(current);
}

/** Shows the counts of the chosen revision again after `changes` to the
 * text, and the text on its side. */
export function textChanged(changes: ChangeSet) {
  if (shown?.detail) shown.detail.el.replaceChildren(...detailOf(shown, shown.detail.size));
  // A read-only copy of the editor's text, so the editor's changes apply to
  // it: a reload from disk, or a restore.
  shown?.side?.b.dispatch({ changes });
}

/** Shows the editor in place of the panes, for its notice of a change on
 * disk and the buttons of the notice. The stored choice stays. */
export function showInline() {
  if (!shown?.side) return;
  sideBySide = false;
  shown.layoutButton.setAttribute("aria-pressed", "false");
  layout(shown);
}

/** Shows the revision on screen and the text side by side, in place of
 * the editor, or takes them away. */
function layout(current: Shown) {
  const old = current.side;
  const top = old?.dom.scrollTop ?? 0;
  old?.destroy();
  current.side = null;
  const on = sideBySide && current.compared !== null;
  current.aside.parentElement?.classList.toggle("side-by-side", on);
  if (!on) {
    // It was hidden: CodeMirror measures it again.
    current.view.requestMeasure();
    return;
  }
  const extensions = [current.actions.look, EditorState.readOnly.of(true)];
  const side = new MergeView({
    a: { doc: current.compared!.content, extensions },
    b: { doc: current.view.state.doc, extensions },
  });
  side.dom.classList.add("mdame-side");
  current.aside.before(side.dom);
  side.dom.scrollTop = top;
  current.side = side;
}

async function choose(current: Shown, id: string) {
  current.chosen = id;
  render(current);
  let content: string;
  try {
    const query = `path=${encodeURIComponent(current.path)}&id=${encodeURIComponent(id)}`;
    content =
      id === LAST_SEEN
        ? // The list has "Last seen" only when the view saw the file.
          current.actions.lastSeen()!
        : (await api<{ content: string }>("GET", `/api/history/view?${query}`)).content;
  } catch (error) {
    if (shown === current && current.chosen === id) {
      current.error.textContent = (error as ApiError).message;
    }
    return;
  }
  // Another revision was chosen meanwhile.
  if (shown !== current || current.chosen !== id) return;
  const { view } = current;
  // A merge view that stays across a reconfigure keeps the deleted lines
  // of the old revision: it goes first.
  view.dispatch({ effects: diffMode.reconfigure([]) });
  const original = view.state.toText(content);
  view.dispatch({
    effects: diffMode.reconfigure(unifiedMergeView({ original, mergeControls: false })),
  });
  current.compared = { id, content };
  current.error.textContent = "";
  layout(current);
  render(current);
}

function render(current: Shown) {
  const { list, revisions } = current;
  current.detail = null;
  const onScreen = revisions?.find((revision) => revision.id === current.compared?.id);
  current.restore.disabled = !onScreen || current.compared?.id !== current.chosen;
  current.restore.textContent = onScreen ? `Restore ${label(onScreen, new Date())}` : "Restore";
  if (!revisions) return;
  if (revisions.length === 0) {
    const empty = document.createElement("li");
    empty.className = "mdame-placeholder";
    empty.textContent = "No revisions yet: mdame keeps one each time it saves over this file.";
    list.replaceChildren(empty);
    return;
  }
  const now = new Date();
  list.replaceChildren(
    ...revisions.map((revision) => {
      const chosen = revision.id === current.chosen;
      const button = document.createElement("button");
      button.className = "mdame-revision";
      button.title =
        revision.time === null
          ? "The file as the view showed it when you last left it"
          : `The file as it was until mdame saved over it, on ${new Date(revision.time).toLocaleString()}`;
      const time = document.createElement("span");
      time.textContent = label(revision, now);
      const detail = document.createElement("small");
      detail.textContent = sizeLabel(revision.size);
      if (chosen) {
        button.setAttribute("aria-current", "true");
        current.detail = { el: detail, size: revision.size };
        detail.replaceChildren(...detailOf(current, revision.size));
      }
      button.append(time, detail);
      button.addEventListener("click", () => {
        // A chosen revision that failed to load can be asked again, and the
        // one on screen chosen back while another loads or failed.
        if (!chosen || revision.id !== current.compared?.id) choose(current, revision.id);
      });
      const row = document.createElement("li");
      row.append(button);
      return row;
    }),
  );
}

/** The size of the chosen revision, then its counts once it is on screen.
 * The other revisions show no counts: each would need a request. */
function detailOf(current: Shown, size: number): (string | Node)[] {
  const { view } = current;
  const chunks = current.compared?.id === current.chosen ? getChunks(view.state) : null;
  if (!chunks) return [sizeLabel(size)];
  const counts = lineCounts(chunks.chunks, getOriginalDoc(view.state), view.state.doc);
  return [
    `${sizeLabel(size)} · `,
    countSpan("mdame-lines-added", `+${counts.added}`),
    " ",
    countSpan("mdame-lines-removed", `−${counts.removed}`),
    " lines",
  ];
}

function countSpan(className: string, text: string): HTMLElement {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}

function label(entry: Entry, now: Date): string {
  return entry.time === null ? "Last seen" : timeLabel(entry.time, now);
}

function timeLabel(time: number, now: Date): string {
  const date = new Date(time);
  const clock = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const day = dayOf(date, now) ?? date.toLocaleDateString(undefined, { dateStyle: "medium" });
  return `${day} ${clock}`;
}

/** Whether `date` falls on the day of `now` or the day before, in local time. */
export function dayOf(date: Date, now: Date): "Today" | "Yesterday" | null {
  if (date.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return date.toDateString() === yesterday.toDateString() ? "Yesterday" : null;
}

export function sizeLabel(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

/** The lines that `text` adds and removes against `revision`. A changed
 * line counts once in each. */
export function lineCounts(
  chunks: readonly Chunk[],
  revision: Text,
  text: Text,
): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const chunk of chunks) {
    if (chunk.toA > chunk.fromA) {
      removed += revision.lineAt(chunk.endA).number - revision.lineAt(chunk.fromA).number + 1;
    }
    if (chunk.toB > chunk.fromB) {
      added += text.lineAt(chunk.endB).number - text.lineAt(chunk.fromB).number + 1;
    }
  }
  return { added, removed };
}
