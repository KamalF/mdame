import { expect, test } from "bun:test";
import { newFilePath } from "./dialogs.ts";

test("a name with no extension gets .md", () => {
  expect(newFilePath("notes")).toBe("notes.md");
  expect(newFilePath("docs/notes")).toBe("docs/notes.md");
  expect(newFilePath("docs//notes")).toBe("docs/notes.md");
  expect(newFilePath("v1.2/notes")).toBe("v1.2/notes.md");
  expect(newFilePath(".hidden")).toBe(".hidden.md");
});

test("a name with an extension stays as typed, without the spaces around it", () => {
  expect(newFilePath("docs/a.txt")).toBe("docs/a.txt");
  expect(newFilePath("  a.md ")).toBe("a.md");
});

test("an empty name gives null", () => {
  expect(newFilePath("docs/")).toBeNull();
  expect(newFilePath("  ")).toBeNull();
});
