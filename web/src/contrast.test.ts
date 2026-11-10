import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";

const THEMES = `${import.meta.dir}/../themes`;

/** The variables that a theme file sets, and its `color-scheme`. */
function variables(file: string): Record<string, string> {
  const css = readFileSync(`${THEMES}/${file}`, "utf8");
  const found: Record<string, string> = {};
  for (const [, name, value] of css.matchAll(/--([\w-]+):\s*([^;]+);/g)) found[name] = value.trim();
  found.scheme = css.match(/color-scheme:\s*(\w+)/)![1];
  return found;
}

function channels(hex: string): number[] {
  return [1, 3, 5, 7].map((i) => parseInt(hex.slice(i, i + 2) || "ff", 16) / 255);
}

/** WCAG's relative luminance of `hex`, laid over `under` if translucent. */
function luminance(hex: string, under: string): number {
  const [r, g, b, alpha] = channels(hex);
  const base = channels(under);
  const linear = [r, g, b].map((c, i) => {
    const s = c * alpha + base[i] * (1 - alpha);
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/** The text on each background of the screens: 4.5:1, as WCAG AA asks. */
const TEXT = [
  ["fg", "bg"],
  ["fg", "bg-raised"],
  ["fg", "bg-sunken"],
  ["fg", "code-bg"],
  ["fg", "selection"],
  ["fg-muted", "bg"],
  ["fg-muted", "bg-raised"],
  ["fg-muted", "bg-sunken"],
  ["accent", "bg"],
  ["accent", "bg-sunken"],
  ["accent-fg", "accent"],
  ["danger", "bg"],
  ["danger", "bg-sunken"],
  ["success", "bg-sunken"],
  ...["keyword", "string", "number", "comment", "title", "type", "attr", "meta"].map((k) => [
    `hl-${k}`,
    "code-bg",
  ]),
];

/** The change bars and the borders of alerts: 3:1, as for a part of the UI. */
const PARTS = [
  ["success", "bg"],
  ["accent", "bg"],
  ["danger", "bg"],
  ["warning", "bg"],
];

test("each built-in theme gives its text and change bars enough contrast", () => {
  const files = readdirSync(THEMES).filter((file) => file.endsWith(".css"));
  expect(files.length).toBeGreaterThan(2);
  const failures: string[] = [];
  for (const file of files) {
    const theme = variables(file);
    // A theme lies over the built-in of its scheme.
    const all = { ...variables(`${theme.scheme}.css`), ...theme };
    for (const [pairs, minimum] of [
      [TEXT, 4.5],
      [PARTS, 3],
    ] as const) {
      for (const [fg, bg] of pairs) {
        const back = luminance(all[bg], all.bg);
        const front = luminance(all[fg], all.bg);
        const ratio = (Math.max(back, front) + 0.05) / (Math.min(back, front) + 0.05);
        if (ratio < minimum) failures.push(`${file}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1`);
      }
    }
  }
  expect(failures).toEqual([]);
});
