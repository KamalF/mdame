import { type Chunk, getChunks, getOriginalDoc, unifiedMergeView } from "@codemirror/merge";
import { Compartment, Text } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { api, type ApiError } from "./api.ts";
import { iconButton } from "./icons.ts";

/** What `/api/history` gives for each revision. */
export interface Revision {
  id: string;
  /** Unix milliseconds. */
  time: number;
  size: number;
}

/** The editor's merge view: empty outside diff mode. */
export const diffMode = new Compartment();

interface Shown {
  view: EditorView;
  path: string;
  aside: HTMLElement;
  error: HTMLElement;
  list: HTMLElement;
  revisions: Revision[] | null;
  /** The revision that the text is compared with, or is about to be. */
  chosen: string | null;
  /** The revision in the merge view. */
  compared: string | null;
  /** The size and counts of the chosen revision, which edits change. */
  detail: { el: HTMLElement; size: number } | null;
}

let shown: Shown | null = null;

/** Returns the list of the revisions of `path`, for the place of the
 * preview, and compares the text of `view` with the newest. */
export function show(view: EditorView, path: string, onClose: () => void): HTMLElement {
  const aside = document.createElement("aside");
  aside.className = "mdame-revisions";
  aside.setAttribute("aria-label", "Revisions");
  const header = document.createElement("div");
  header.className = "mdame-revisions-header";
  const title = document.createElement("h2");
  title.textContent = "Revisions";
  header.append(title, iconButton("Close revisions", "cross", onClose, "Close (Esc)"));
  const error = document.createElement("p");
  error.className = "mdame-status-error";
  error.setAttribute("role", "alert");
  const list = document.createElement("ul");
  list.className = "mdame-revisions-list";
  aside.append(header, error, list);
  shown = {
    view,
    path,
    aside,
    error,
    list,
    revisions: null,
    chosen: null,
    compared: null,
    detail: null,
  };
  refresh();
  return aside;
}

export function hide() {
  if (!shown) return;
  shown.view.dispatch({ effects: diffMode.reconfigure([]) });
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
  let revisions: Revision[];
  try {
    revisions = await api("GET", `/api/history?path=${encodeURIComponent(current.path)}`);
  } catch (error) {
    if (shown === current) current.error.textContent = (error as ApiError).message;
    return;
  }
  if (shown !== current) return;
  current.revisions = revisions;
  current.error.textContent = "";
  // The chosen revision may be gone: pruning removes the oldest.
  const chosen = revisions.find((revision) => revision.id === current.chosen) ?? revisions[0];
  if (chosen && chosen.id !== current.chosen) choose(current, chosen.id);
  else render(current);
}

/** Shows the counts of the chosen revision again, after an edit. */
export function textChanged() {
  if (shown?.detail) shown.detail.el.textContent = detailOf(shown, shown.detail.size);
}

async function choose(current: Shown, id: string) {
  current.chosen = id;
  render(current);
  let content: string;
  try {
    const query = `path=${encodeURIComponent(current.path)}&id=${encodeURIComponent(id)}`;
    ({ content } = await api<{ content: string }>("GET", `/api/history/view?${query}`));
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
  const original = Text.of(content.split(/\r\n?|\n/));
  view.dispatch({
    effects: diffMode.reconfigure(unifiedMergeView({ original, mergeControls: false })),
  });
  current.compared = id;
  current.error.textContent = "";
  render(current);
}

function render(current: Shown) {
  const { list, revisions } = current;
  current.detail = null;
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
      const time = document.createElement("span");
      time.textContent = timeLabel(revision.time, now);
      const detail = document.createElement("small");
      detail.textContent = sizeLabel(revision.size);
      if (chosen) {
        button.setAttribute("aria-current", "true");
        current.detail = { el: detail, size: revision.size };
        detail.textContent = detailOf(current, revision.size);
      }
      button.append(time, detail);
      button.addEventListener("click", () => {
        if (!chosen) choose(current, revision.id);
      });
      const row = document.createElement("li");
      row.append(button);
      return row;
    }),
  );
}

/** The size of the chosen revision, then its counts once it is on screen.
 * The other revisions show no counts: each would need a request. */
function detailOf(current: Shown, size: number): string {
  const { view } = current;
  const chunks = current.compared === current.chosen ? getChunks(view.state) : null;
  if (!chunks) return sizeLabel(size);
  const counts = lineCounts(chunks.chunks, getOriginalDoc(view.state), view.state.doc);
  return `${sizeLabel(size)} · +${counts.added} −${counts.removed} lines`;
}

function timeLabel(time: number, now: Date): string {
  const date = new Date(time);
  const clock = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const day = dayOf(date, now);
  if (day === "today") return `Today ${clock}`;
  if (day === "yesterday") return `Yesterday ${clock}`;
  return `${date.toLocaleDateString(undefined, { dateStyle: "medium" })} ${clock}`;
}

/** Whether `date` falls on the day of `now` or the day before, in local time. */
export function dayOf(date: Date, now: Date): "today" | "yesterday" | null {
  if (date.toDateString() === now.toDateString()) return "today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return date.toDateString() === yesterday.toDateString() ? "yesterday" : null;
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
