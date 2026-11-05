import { expect, test } from "bun:test";
import { chosenWidth, widthValue } from "./width.ts";

test("a stored width wins", () => {
  expect(widthValue(chosenWidth("wide"))).toBe("80ch");
  // `max-width: none`: the whole pane, inside its padding.
  expect(widthValue(chosenWidth("full"))).toBe("none");
});

test("default sets no width", () => {
  expect(widthValue(chosenWidth("default"))).toBe(null);
  expect(widthValue(chosenWidth(null))).toBe(null);
});

test("an unknown stored width falls back to default", () => {
  for (const stored of ["huge", 80, {}]) {
    expect(chosenWidth(stored)).toBe("default");
  }
});
