import { expect, test } from "bun:test";
import { formatKeys } from "./format.ts";
import { PAGE_KEYS } from "./keys.ts";
import { HELP, keyLabel } from "./shortcuts.ts";

test("every key of bindKeys and of the editor keymap is in the help", () => {
  const listed = HELP.flatMap(({ shortcuts }) => shortcuts.flatMap(({ keys }) => keys));
  const editor = formatKeys.flatMap(({ key, shift }) => (shift ? [key!, `Shift-${key}`] : [key!]));
  for (const key of [...PAGE_KEYS, ...editor]) expect(listed).toContain(key);
});

test("macos shows ⌘ and the others ctrl", () => {
  expect(keyLabel("Mod-s", true)).toBe("⌘S");
  expect(keyLabel("Mod-s", false)).toBe("Ctrl+S");
  expect(keyLabel("Shift-Tab", true)).toBe("⇧Tab");
  expect(keyLabel("Shift-Tab", false)).toBe("Shift+Tab");
  // A key with no modifier shows as it is typed.
  expect(keyLabel("e", true)).toBe("e");
  expect(keyLabel("Escape", false)).toBe("Esc");
});
