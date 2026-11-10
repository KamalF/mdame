import { expect, test } from "bun:test";
import { droppedName, imageLink, pastedName, skipEmptyAlt } from "./paste.ts";

test("a second paste skips the empty alt text of the first image", () => {
  expect(skipEmptyAlt("Some text.![", "](pasted-1.png) more")).toBe("](pasted-1.png)".length);
  expect(skipEmptyAlt("Some text.![", "](my%20shot.png)")).toBe("](my%20shot.png)".length);
  // Alt text that the user typed, or no image: the cursor stays.
  expect(skipEmptyAlt("![a red dot", "](dot.png)")).toBe(0);
  expect(skipEmptyAlt("Some text.", "](dot.png)")).toBe(0);
  expect(skipEmptyAlt("[", "](link)")).toBe(0);
});

test("a pasted image is named after the local date and time", () => {
  const date = new Date(2026, 10, 10, 9, 5, 7);
  expect(pastedName(date, "image/png")).toBe("pasted-2026-11-10-090507.png");
  expect(pastedName(date, "image/jpeg")).toBe("pasted-2026-11-10-090507.jpg");
});

test("a dropped image keeps its name, with an extension of its type", () => {
  expect(droppedName("Shot.PNG", "image/png")).toBe("Shot.PNG");
  expect(droppedName("photo.jpeg", "image/jpeg")).toBe("photo.jpeg");
  expect(droppedName("diagram", "image/svg+xml")).toBe("diagram.svg");
});

test("the link escapes what would end it or start an escape", () => {
  expect(imageLink("shot.png")).toBe("![](shot.png)");
  expect(imageLink("my shot (2).png")).toBe("![](my%20shot%20%282%29.png)");
  expect(imageLink("100%.png")).toBe("![](100%25.png)");
  expect(imageLink("été.png")).toBe("![](été.png)");
});
