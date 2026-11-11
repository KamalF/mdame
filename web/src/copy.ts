import { icon, iconButton } from "./icons.ts";

/**
 * An icon button that copies `text()` and shows a check, or a cross on
 * failure, for a moment. `text` may be async.
 */
interface CopyOptions {
  label: string;
  iconName: string;
  text: () => string | Promise<string>;
}

export function copyButton({ label, iconName, text }: CopyOptions): HTMLButtonElement {
  const button = iconButton(label, iconName, async () => {
    try {
      await write(text());
      button.replaceChildren(icon("check"));
    } catch {
      button.replaceChildren(icon("cross"));
      // The clipboard API exists only on secure pages: localhost, not a LAN address.
      button.title = isSecureContext
        ? "Copy failed"
        : "Copy failed: the clipboard works only through localhost";
    }
    setTimeout(() => {
      button.replaceChildren(icon(iconName));
      button.title = label;
    }, 1200);
  });
  return button;
}

/** Safari refuses a write that starts after the click's turn, such as one
 * after a fetch. A `ClipboardItem` takes the promise during that turn. */
async function write(text: string | Promise<string>) {
  if (typeof text === "string" || typeof ClipboardItem === "undefined") {
    await navigator.clipboard.writeText(await text);
    return;
  }
  const blob = text.then((value) => new Blob([value], { type: "text/plain" }));
  await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
}
