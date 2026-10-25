import { expect, test } from "bun:test";
import { serial } from "./serial.ts";

/** A task that logs its name and ends when `finish` is called. */
function blocking(log: string[], name: string) {
  let finish = () => {};
  const done = new Promise<void>((resolve) => (finish = resolve));
  return { task: () => (log.push(name), done), finish };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test("tasks run one at a time, in the order asked", async () => {
  const log: string[] = [];
  const queue = serial(() => {});
  const first = blocking(log, "save");
  queue("save", first.task);
  queue("check", async () => void log.push("check"));
  await settle();
  expect(log).toEqual(["save"]);
  first.finish();
  await settle();
  expect(log).toEqual(["save", "check"]);
});

test("a task asked for while it waits runs once", async () => {
  const log: string[] = [];
  const queue = serial(() => {});
  const first = blocking(log, "check");
  queue("check", first.task);
  queue("save", async () => void log.push("save"));
  queue("save", async () => void log.push("save again"));
  first.finish();
  await settle();
  expect(log).toEqual(["check", "save"]);
});

test("a task asked for while it runs runs again after it", async () => {
  const log: string[] = [];
  const queue = serial(() => {});
  const first = blocking(log, "save");
  queue("save", first.task);
  await settle();
  queue("save", async () => void log.push("save again"));
  first.finish();
  await settle();
  expect(log).toEqual(["save", "save again"]);
});

test("a task that throws does not block the next", async () => {
  const errors: unknown[] = [];
  const log: string[] = [];
  const queue = serial((error) => errors.push(error));
  queue("save", async () => {
    throw new Error("offline");
  });
  queue("check", async () => void log.push("check"));
  await settle();
  expect(errors).toHaveLength(1);
  expect(log).toEqual(["check"]);
});
