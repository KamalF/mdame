const TYPING = "input, textarea, select, [contenteditable], .cm-editor";

/**
 * Shortcuts never fire while typing in a field, or with Ctrl, Alt or Meta
 * held. Shift is allowed: some layouts need it to type `/`.
 */
export function shouldHandle(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.altKey || event.metaKey || event.defaultPrevented) return false;
  return !(event.target as Element | null)?.closest?.(TYPING);
}

/** A click with no modifier: the others open a new tab or window. */
export function isPlainClick(event: MouseEvent): boolean {
  return !(event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0);
}

/** The keys of `bindKeys`. The shortcut help lists each one. */
export const PAGE_KEYS = ["e", "h", "r", "s", "/", "b", "?"] as const;

export function bindKeys(map: Record<(typeof PAGE_KEYS)[number], () => void>) {
  addEventListener("keydown", (event: KeyboardEvent) => {
    const handler = (map as Record<string, () => void>)[event.key];
    if (!handler || !shouldHandle(event)) return;
    // The page behind a dialog waits until it closes.
    if (document.querySelector("dialog[open]")) return;
    event.preventDefault();
    handler();
  });
}
