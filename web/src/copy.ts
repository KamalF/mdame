import { icon } from "./icons.ts";

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
  const button = document.createElement("button");
  button.className = "mdame-icon-button";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.append(icon(iconName));
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(await text());
      button.replaceChildren(icon("check"));
    } catch {
      // The clipboard API exists only on secure pages: localhost, not a LAN address.
      button.replaceChildren(icon("cross"));
      button.title = "Copy failed: the clipboard works only through localhost";
    }
    setTimeout(() => {
      button.replaceChildren(icon(iconName));
      button.title = label;
    }, 1200);
  });
  return button;
}
