// Generators for the property tests.
import fc from "fast-check";

/** Workspace paths: parts of any Unicode text, without slashes. */
export const workspacePath = fc
  .array(fc.string({ unit: "grapheme", minLength: 1 }).filter((part) => !part.includes("/")), {
    minLength: 1,
    maxLength: 4,
  })
  .map((parts) => parts.join("/"));
