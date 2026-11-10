import { expect, test } from "bun:test";
import { chosenFont } from "./font.ts";

test("a stored font wins", () => {
  expect(chosenFont("mono")).toBe("mono");
  expect(chosenFont("default")).toBe("default");
});

test("no stored font, or an unknown one, gives default", () => {
  for (const stored of [null, "serif", 1, {}]) {
    expect(chosenFont(stored)).toBe("default");
  }
});
