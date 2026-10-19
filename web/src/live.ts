/** What `/ws` sends. */
export type LiveEvent =
  | { type: "changed" | "created" | "removed"; path: string }
  | { type: "renamed"; from: string; to: string }
  | { type: "workspace"; root: string }
  | { type: "resync" };

const FIRST_RETRY_MS = 500;
const MAX_RETRY_MS = 10_000;

/** Doubles after each failed attempt, up to 10 s. */
export function retryDelay(failures: number): number {
  return Math.min(FIRST_RETRY_MS * 2 ** failures, MAX_RETRY_MS);
}

/**
 * Keeps a connection to `/ws` open. `onReconnect` runs once a connection
 * opens after one was lost or failed: events sent meanwhile are gone.
 */
export function connect({
  onEvent,
  onReconnect,
}: {
  onEvent: (event: LiveEvent) => void;
  onReconnect: () => void;
}) {
  let failures = 0;
  let missed = false;
  function open() {
    const scheme = location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${scheme}//${location.host}/ws`);
    socket.addEventListener("open", () => {
      failures = 0;
      if (missed) onReconnect();
      missed = false;
    });
    socket.addEventListener("message", (message) => onEvent(JSON.parse(message.data)));
    socket.addEventListener("close", () => {
      missed = true;
      setTimeout(open, retryDelay(failures++));
    });
  }
  open();
}
