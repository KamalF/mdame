import { afterAll, afterEach, expect, test } from "bun:test";
import { request, send, setHold } from "./api.ts";

const realFetch = globalThis.fetch;
const fetched: string[] = [];
let lastInit: RequestInit | undefined;
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  fetched.push(url);
  lastInit = init;
  return new Response("{}");
}) as typeof fetch;

afterEach(() => {
  setHold(null);
  fetched.length = 0;
});
afterAll(() => {
  globalThis.fetch = realFetch;
});

test("a held page sends only the state request, and says why", async () => {
  setHold("Try again once mdame is back.");
  await expect(request("/api/file?path=a.md")).rejects.toThrow("Try again once mdame is back.");
  await request("/api/state");
  expect(fetched).toEqual(["/api/state"]);
});

test("a request with a body keeps the caller's headers", async () => {
  await send("PUT", "/api/file?path=a.md", { content: "a" }, { "If-Match": '"v"' });
  expect(lastInit?.headers).toEqual({ "If-Match": '"v"', "content-type": "application/json" });
});
