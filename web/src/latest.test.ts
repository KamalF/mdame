import { expect, test } from "bun:test";
import { latestOnly } from "./latest.ts";

test("an answer older than the latest call is dropped", async () => {
  const pending: ((value: string) => void)[] = [];
  const call = latestOnly(() => new Promise<string>((resolve) => pending.push(resolve)));

  const first = call();
  const second = call();
  pending[1]("second");
  pending[0]("first");

  expect(await second).toBe("second");
  expect(await first).toBeNull();
});
