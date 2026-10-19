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
  let missed = false;
  let firstAttempt: () => void;
  const settled = new Promise<void>((resolve) => (firstAttempt = resolve));
  function open() {
    const scheme = location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${scheme}//${location.host}/ws`);
    socket.addEventListener("open", () => {
      firstAttempt();
      failures = 0;
      if (missed) onReconnect();
      missed = false;
    });
    socket.addEventListener("message", (message) => onEvent(JSON.parse(message.data)));
    socket.addEventListener("close", () => {
      firstAttempt();
      missed = true;
      setTimeout(open, retryDelay(failures++));
    });
  }
  open();
  return settled;
}
