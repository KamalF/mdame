import { expect, test } from "bun:test";
import { chosenSpellcheck } from "./spellcheck.ts";

test("spellcheck follows the stored choice", () => {
  expect(chosenSpellcheck(false)).toBe(false);
  expect(chosenSpellcheck(true)).toBe(true);
  // No choice yet.
  expect(chosenSpellcheck(null)).toBe(true);
});
