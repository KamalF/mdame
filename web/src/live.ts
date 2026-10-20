/** What `/ws` sends. */
export type LiveEvent =
  | { type: "changed" | "created" | "removed"; path: string }
  | { type: "renamed"; from: string; to: string }
  | { type: "workspace"; root: string }
  | { type: "resync" };

/** Whether `open` is `path` or inside the folder `path`. */
export function isWithin(open: string, path: string): boolean {
  return open === path || open.startsWith(path + "/");
}

/** Where `open` is after `from` moved to `to`, or null if it did not move. */
export function movedPath(open: string, from: string, to: string): string | null {
  return isWithin(open, from) ? to + open.slice(from.length) : null;
}

/** What the page does for a live event. */
export type Reaction =
  | { kind: "ignore" }
  | { kind: "reload" }
  | { kind: "update"; tree: boolean; refresh: boolean; followTo: string | null };

/**
 * `open` is the file on screen, `onPicker` whether the picker is on screen,
 * and `dated(path)` whether a change to `path` can move it in the tree's
 * sort.
 */
export function react(
  event: LiveEvent,
  open: string | null,
  onPicker: boolean,
  dated: (path: string) => boolean,
): Reaction {
  if (event.type === "workspace") return onPicker ? { kind: "reload" } : { kind: "ignore" };
  if (event.type === "resync") return { kind: "reload" };
  const tree = event.type !== "changed" || dated(event.path);
  const update = { kind: "update", tree, refresh: false, followTo: null } as const;
  if (!open) return update;
  if (event.type === "renamed" && !isWithin(open, event.to)) {
    const followTo = movedPath(open, event.from, event.to);
    if (followTo) return { ...update, followTo };
  }
  const paths = event.type === "renamed" ? [event.from, event.to] : [event.path];
  // Asks again rather than show "Not found": a save, or a folder moved
  // in, can bring the file back.
  return { ...update, refresh: paths.some((path) => isWithin(open, path)) };
}

const FIRST_RETRY_MS = 500;
const MAX_RETRY_MS = 10_000;

/** Doubles after each failed attempt, up to 10 s. */
export function retryDelay(failures: number): number {
  return Math.min(FIRST_RETRY_MS * 2 ** failures, MAX_RETRY_MS);
}

/**
 * Keeps a connection to `/ws` open. `onReconnect` runs once a connection
 * opens after one was lost or failed: events sent meanwhile are gone. The
 * promise settles when the first attempt opens or fails: the server only
 * sends the events that follow its subscription.
 */
export function connect({
  onEvent,
  onReconnect,
}: {
  onEvent: (event: LiveEvent) => void;
  onReconnect: () => void;
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
      setTimeout(open, retryDelay(failures++));
    });
  }
  open();
  return settled;
}
