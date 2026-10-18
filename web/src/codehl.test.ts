import { expect, test } from "bun:test";
import { tokens } from "./codehl.ts";

// One sample per extension that /api/file sends as `language-<extension>`.
const samples = {
  json: '{"a": [1, true, null]}',
  yaml: "a: 1\nb: [x, 'y'] # note",
  yml: "a: 1",
  toml: '[table]\nkey = "value" # note',
  rust: "fn main() { let x = 1; }",
};

for (const [name, text] of Object.entries(samples)) {
  test(`${name} is coloured`, async () => {
    const pieces = await tokens(name, text);
    expect(pieces!.map(([piece]) => piece).join("")).toBe(text);
    expect(pieces!.some(([, classes]) => classes.startsWith("tok-"))).toBe(true);
  });
}

test("txt, graphql, gql and mermaid stay plain text", async () => {
  for (const name of ["txt", "graphql", "gql", "mermaid"]) {
    expect(await tokens(name, "a")).toBe(null);
  }
});
