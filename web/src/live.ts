/** What `/ws` sends. */
export type LiveEvent =
  | { type: "changed" | "created" | "removed"; path: string }
  | { type: "renamed"; from: string; to: string }
  | { type: "resync" };

/** Whether `open` is `path` or inside the folder `path`. */
export function isWithin(open: string, path: string): boolean {
  return open === path || open.startsWith(path + "/");
}

/** Where `open` is after `from` moved to `to`, or null if it did not move. */
export function movedPath(open: string, from: string, to: string): string | null {
  return isWithin(open, from) ? to + open.slice(from.length) : null;
}

/** Whether a change to `path` can hide or show entries of the tree. */
function isIgnoreFile(path: string): boolean {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return name === ".gitignore" || name === ".ignore";
}

/** Where `event` moved `open`, or null. Not when it moved a file onto
 * `open`: an editor that saves through a backup renames the backup back. */
export function movedTo(event: LiveEvent, open: string): string | null {
  if (event.type !== "renamed" || isWithin(open, event.to)) return null;
  return movedPath(open, event.from, event.to);
}

/** What the page does for a live event. */
export type Reaction =
  | { kind: "reload" }
  | { kind: "update"; tree: boolean; refresh: boolean; followTo: string | null };

/**
 * `open` is the file on screen, and `dated(path)` whether a change to
 * `path` can move it in the tree's sort.
 */
export function react(
  event: LiveEvent,
  open: string | null,
  dated: (path: string) => boolean,
): Reaction {
  if (event.type === "resync") return { kind: "reload" };
  const tree = event.type !== "changed" || dated(event.path) || isIgnoreFile(event.path);
  const update = { kind: "update", tree, refresh: false, followTo: null } as const;
  if (!open) return update;
  const followTo = movedTo(event, open);
  if (followTo) return { ...update, followTo };
  // Asks again rather than show "Not found": a save, or a folder moved
  // in, can bring the file back.
  return { ...update, refresh: concerns(event, open) };
}

/** Whether `event` names `open` or a folder holding it. */
export function concerns(event: LiveEvent, open: string): boolean {
  if (event.type === "resync") return false;
  const paths = event.type === "renamed" ? [event.from, event.to] : [event.path];
  return paths.some((path) => isWithin(open, path));
}

const FIRST_RETRY_MS = 500;
const MAX_RETRY_MS = 10_000;

/** Doubles after each failed attempt, up to 10 s. */
export function retryDelay(failures: number): number {
  return Math.min(FIRST_RETRY_MS * 2 ** failures, MAX_RETRY_MS);
}

/**
 * Keeps a connection to `/ws` open. `onReconnect` runs once a connection
 * opens after one was lost or failed: events sent meanwhile are gone.
 * `onClose` runs each time a connection closes or fails to open. The
 * promise settles when the first attempt opens or fails: the server only
 * sends the events that follow its subscription.
 */
export function connect({
  onEvent,
  onReconnect,
  onClose,
}: {
  onEvent: (event: LiveEvent) => void;
  onReconnect: () => void;
  onClose: () => void;
}): Promise<void> {
  let failures = 0;
  let firstAttempt: () => void;
  const settled = new Promise<void>((resolve) => (firstAttempt = resolve));
  function open() {
    const scheme = location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${scheme}//${location.host}/ws`);
    socket.addEventListener("open", () => {
      firstAttempt();
      if (failures > 0) onReconnect();
      failures = 0;
    });
    socket.addEventListener("message", (message) => onEvent(JSON.parse(message.data)));
    socket.addEventListener("close", () => {
      firstAttempt();
      onClose();
      setTimeout(open, retryDelay(failures++));
    });
  }
  open();
  return settled;
}
