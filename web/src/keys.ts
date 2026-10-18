const TYPING = "input, textarea, select, [contenteditable], .cm-editor";

/**
 * Shortcuts never fire while typing in a field, or with Ctrl, Alt or Meta
 * held. Shift is allowed: some layouts need it to type `/`.
 */
export function shouldHandle(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.altKey || event.metaKey || event.defaultPrevented) return false;
  return !(event.target as Element | null)?.closest?.(TYPING);
}

export function bindKeys(map: Record<string, () => void>) {
  addEventListener("keydown", (event: KeyboardEvent) => {
    const handler = map[event.key];
    if (!handler || !shouldHandle(event)) return;
    event.preventDefault();
    handler();
  });
}
