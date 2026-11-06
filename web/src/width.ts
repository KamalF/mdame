import { load, store } from "./storage.ts";

const KEY = "mdame:width";
export const WIDTHS = ["default", "wide", "full"] as const;
type Width = (typeof WIDTHS)[number];

/** The stored width, or default for none or one that mdame does not know. */
export function chosenWidth(stored: unknown): Width {
  return (WIDTHS as readonly unknown[]).includes(stored) ? (stored as Width) : "default";
}

/** The `--content-width` that `width` sets on `<html>`, over the theme's.
 * Default sets none: the theme's applies. */
export function widthValue(width: Width): string | null {
  return { default: null, wide: "80ch", full: "none" }[width];
}

export function currentWidth(): Width {
  return chosenWidth(load<unknown>(KEY, null));
}

/** Shows the stored width. */
export function applyWidth() {
  const value = widthValue(currentWidth());
  const style = document.documentElement.style;
  if (value === null) style.removeProperty("--content-width");
  else style.setProperty("--content-width", value);
}

export function chooseWidth(width: Width) {
  store(KEY, width);
  applyWidth();
}
