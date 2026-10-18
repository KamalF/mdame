import { expect, test } from "bun:test";
import { shouldHandle } from "./keys.ts";

const page = { closest: () => null };
const field = { closest: () => ({}) };
// Only the fields that shouldHandle reads, not a whole KeyboardEvent.
const key = (extra: object) => ({ target: page, ...extra }) as unknown as KeyboardEvent;

test("a plain key on the page is a shortcut", () => {
  expect(shouldHandle(key({}))).toBe(true);
  expect(shouldHandle(key({ shiftKey: true }))).toBe(true);
});

test("no shortcut while typing in a field", () => {
  expect(shouldHandle(key({ target: field }))).toBe(false);
});

test("no shortcut with Ctrl, Alt or Meta held", () => {
  expect(shouldHandle(key({ ctrlKey: true }))).toBe(false);
  expect(shouldHandle(key({ altKey: true }))).toBe(false);
  expect(shouldHandle(key({ metaKey: true }))).toBe(false);
});

test("no shortcut when another handler already used the key", () => {
  expect(shouldHandle(key({ defaultPrevented: true }))).toBe(false);
});
