import { diff } from "@codemirror/merge";
import type { ChangeSpec } from "@codemirror/state";

/**
 * What the editor does when its file may have changed on disk. `disk` is
 * what a reload would load: null when the file is gone.
 */
export type DiskReaction<T> =
  | { kind: "ignore" }
  | { kind: "reload"; disk: T }
  | { kind: "notice"; disk: T | null };

/**
 * `disk` is the file on disk, or null when it is gone, and `base` is the
 * version that the editor's text started from.
 */
export function reactToDisk<T extends { version: string }>(
  disk: T | null,
  base: string,
  dirty: boolean,
): DiskReaction<T> {
  // Our own save, or the same content written again.
  if (disk?.version === base) return { kind: "ignore" };
  if (disk && !dirty) return { kind: "reload", disk };
  return { kind: "notice", disk };
}

/**
 * The changes that turn `text` into `next`, only where the two differ, so
 * that the cursor and the scroll stay on the same text.
 */
export function reloadChanges(text: string, next: string): ChangeSpec[] {
  // The merge view's own limit: very different texts get a coarser diff
  // rather than a quadratic one.
  return diff(text, next, { scanLimit: 500 }).map((change) => ({
    from: change.fromA,
    to: change.toA,
    insert: next.slice(change.fromB, change.toB),
  }));
}
