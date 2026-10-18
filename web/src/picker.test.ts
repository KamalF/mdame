import { expect, test } from "bun:test";
import { errorFrom } from "./api.ts";
import { merge, tildify } from "./picker.ts";

test("tildify shortens paths under home only", () => {
  expect(tildify("/home/me", "/home/me")).toBe("~");
  expect(tildify("/home/me/notes", "/home/me")).toBe("~/notes");
  expect(tildify("/home/meg/notes", "/home/me")).toBe("/home/meg/notes");
  expect(tildify("/srv/notes", null)).toBe("/srv/notes");
});

test("merge puts matching recents first, without duplicates", () => {
  const recents = [
    { path: "/home/me/notes", last_opened_secs: 2 },
    { path: "/home/me/work/todo.md", last_opened_secs: 1 },
  ];
  const completions = [
    { path: "~/notes/", dir: true },
    { path: "~/notes.md", dir: false },
  ];
  expect(merge(recents, completions, "~/no", "/home/me")).toEqual([
    { path: "~/notes", kind: "recent" },
    { path: "~/notes.md", kind: "file" },
  ]);
});

test("merge with an empty field lists every recent", () => {
  const recents = [{ path: "/a", last_opened_secs: 1 }];
  expect(merge(recents, [], "", "/home/me")).toEqual([{ path: "/a", kind: "recent" }]);
});

test("errorFrom reads the API error shape", () => {
  const body = { error: { code: "not_found", message: "~/x: missing" } };
  expect(errorFrom(404, body)).toMatchObject({ code: "not_found", message: "~/x: missing" });
  expect(errorFrom(502, null)).toMatchObject({ code: "http_502" });
});
