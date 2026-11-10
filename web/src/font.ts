import { load, store } from "./storage.ts";

const KEY = "mdame:font";
export const FONTS = ["default", "mono"] as const;
type Font = (typeof FONTS)[number];

/** The stored font, or default for none or one that mdame does not know. */
export function chosenFont(stored: unknown): Font {
  return (FONTS as readonly unknown[]).includes(stored) ? (stored as Font) : "default";
}

export function currentFont(): Font {
  return chosenFont(load<unknown>(KEY, null));
}

/** Shows the stored font. Mono is a class on `<html>`, which `base.css`
 * reads. */
export function applyFont() {
  document.documentElement.classList.toggle("mdame-mono", currentFont() === "mono");
}

export function chooseFont(font: Font) {
  store(KEY, font);
  applyFont();
}
