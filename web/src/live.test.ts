import { expect, test } from "bun:test";
import { retryDelay } from "./live.ts";

test("retryDelay doubles from 500 ms and stops at 10 s", () => {
  expect([0, 1, 2, 3, 4, 5, 6].map(retryDelay)).toEqual([
    500, 1000, 2000, 4000, 8000, 10000, 10000,
  ]);
});
