import { expect, test } from "bun:test";
import { room } from "./wide.ts";

const pane = { left: 0, right: 1000 };

test("without the outline, a wide block may reach 32 px from each edge of the pane", () => {
  const article = { left: 198, right: 802 };
  const text = { left: 230, right: 770 };
  expect(room(pane, article, text, false)).toEqual({ left: 198, right: 198 });
});

test("beside the outline, a wide block stops at the edge of the article", () => {
  const article = { left: 190, right: 794 };
  const text = { left: 222, right: 762 };
  expect(room(pane, article, text, true)).toEqual({ left: 190, right: 32 });
});

test("a pane as narrow as the column gives no room", () => {
  const narrow = { left: 0, right: 560 };
  const text = { left: 32, right: 528 };
  expect(room(narrow, narrow, text, false)).toEqual({ left: 0, right: 0 });
});
