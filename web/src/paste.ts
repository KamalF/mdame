import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { api, type ApiError } from "./api.ts";
import { MARKDOWN } from "./changelist.ts";

/** The image types that mdame shows, with the extension of each. */
const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

/** A pasted image has no name of its own: it gets the local date and time. */
export function pastedName(date: Date, type: string): string {
  const two = (n: number) => String(n).padStart(2, "0");
  const day = `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
  const time = `${two(date.getHours())}${two(date.getMinutes())}${two(date.getSeconds())}`;
  return `pasted-${day}-${time}.${TYPES[type]}`;
}

/** A dropped file keeps its name, with the extension of its type if the
 * name has none that mdame knows. */
export function droppedName(name: string, type: string): string {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(name) ? name : `${name}.${TYPES[type]}`;
}

/** The markdown of an image of the same folder. A space, `(` or `)` would
 * end the link, a `%` would start an escape, `#` or `?` would end the path
 * of the URL, and a `:` would make `https:a.png` a remote image. */
export function imageLink(name: string): string {
  const target = name.replace(/[\s()<>%#?:]/g, (c) =>
    c === "(" ? "%28" : c === ")" ? "%29" : encodeURIComponent(c),
  );
  return `![](${target})`;
}

/** How far past the cursor a new image goes: with the cursor still in the
 * empty alt text of an image, past that image, or the second of two pastes
 * would land in the alt text of the first. `before` and `after` are the
 * text around the cursor. */
export function skipEmptyAlt(before: string, after: string): number {
  if (!before.endsWith("![")) return 0;
  return after.match(/^\]\([^\s()]*\)/)?.[0].length ?? 0;
}

/** Saves `file` at `path`, and gives the path that it took. */
async function upload(path: string, file: File): Promise<string> {
  const saved = await api<{ path: string }>("POST", `/api/image?path=${encodeURIComponent(path)}`, file);
  return saved.path;
}

/** Where the links of an upload go. */
interface Place {
  from: number;
  to: number;
}

/**
 * Saves the images of a paste or a drop beside the markdown file at
 * `path`, and links them where they land, with the cursor in the alt text
 * of the first. `failed` shows why an image was not saved.
 */
export function pasteImages(path: string, failed: (message: string) => void): Extension {
  if (!MARKDOWN.test(path)) return [];
  const folder = path.slice(0, path.lastIndexOf("/") + 1);
  /** The uploads in progress: the edits made meanwhile move their places. */
  const pending = new Set<Place>();

  async function link(view: EditorView, files: File[], place: Place, name: (file: File) => string) {
    const links: string[] = [];
    pending.add(place);
    try {
      for (const file of files) {
        const saved = await upload(folder + name(file), file);
        links.push(imageLink(saved.slice(folder.length)));
      }
    } catch (error) {
      failed((error as ApiError).message);
    } finally {
      pending.delete(place);
    }
    if (links.length === 0) return;
    const { state } = view;
    let { from: start, to: stop } = place;
    let text = links.join("\n");
    const skip =
      start === stop
        ? skipEmptyAlt(state.sliceDoc(Math.max(0, start - 2), start), state.sliceDoc(start, start + 1000))
        : 0;
    if (skip > 0) {
      start = stop = start + skip;
      text = "\n" + text;
    }
    view.dispatch({
      changes: { from: start, to: stop, insert: text },
      // Between the brackets of the first `![]`.
      selection: { anchor: start + text.indexOf("![") + 2 },
      scrollIntoView: true,
      userEvent: "input.paste",
    });
    view.focus();
  }

  /** The images of `list` that mdame can save, or null when an image of
   * another type is among them. */
  function images(list: FileList | undefined): File[] | null {
    const files = [...(list ?? [])].filter((file) => file.type.startsWith("image/"));
    if (files.some((file) => !(file.type in TYPES))) {
      failed("mdame saves PNG, JPEG, GIF, WebP and SVG images");
      return null;
    }
    return files;
  }

  const follow = EditorView.updateListener.of((update) => {
    if (!update.docChanged) return;
    // Text typed at the place during the upload goes after the links.
    for (const place of pending) {
      place.from = update.changes.mapPos(place.from, -1);
      place.to = update.changes.mapPos(place.to, -1);
    }
  });

  const handlers = EditorView.domEventHandlers({
    paste(event, view) {
      const data = event.clipboardData;
      // A copied part of a web page brings its images with its text: the
      // text wins, as before.
      if (!data || data.types.includes("text/plain")) return false;
      const files = images(data.files);
      if (files?.length === 0) return false;
      event.preventDefault();
      if (files === null) return true;
      const now = new Date();
      const { from, to } = view.state.selection.main;
      link(view, files, { from, to }, (file) => pastedName(now, file.type));
      return true;
    },
    drop(event, view) {
      const files = images(event.dataTransfer?.files);
      if (files?.length === 0) return false;
      // Even for an image of another type: CodeMirror would insert the
      // bytes of the file as text.
      event.preventDefault();
      if (files === null) return true;
      const at = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.head;
      link(view, files, { from: at, to: at }, (file) => droppedName(file.name, file.type));
      return true;
    },
  });
  return [handlers, follow];
}
