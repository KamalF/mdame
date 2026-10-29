// Writes the licence texts of the npm packages that the bundle contains:
// their licences require the notice in every copy, and web/dist is one.
// Usage: bun web/notices.ts <metafile of the bundle> <output file>
import { readdirSync } from "node:fs";
import { join } from "node:path";

const [metafile, output] = Bun.argv.slice(2);
if (!metafile || !output) throw new Error("usage: bun web/notices.ts <metafile> <output>");
const meta = await Bun.file(metafile).json();

// The last node_modules of a path: a package may hold its own copy of
// another one, in another version.
const dirs = new Set<string>();
for (const input of Object.keys(meta.inputs)) {
  const match = input.match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//);
  if (match) dirs.add(match[1]);
}

const notices: { title: string; text: string }[] = [];
const missing: string[] = [];
for (const dir of dirs) {
  const pkg = await Bun.file(join(dir, "package.json")).json();
  // EPL-2.0 and MPL-2.0 ask to tell where the source is.
  const source = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
  const title = `${pkg.name} ${pkg.version} (${pkg.license ?? "no licence field"})\nSource: ${source ?? "the npm package"}`;
  // Apache-2.0 asks to keep the NOTICE file too.
  const files = readdirSync(dir)
    .filter((name) => /^(licen[cs]e|copying|notice)/i.test(name))
    .sort();
  if (files.length === 0) {
    missing.push(title);
    continue;
  }
  const texts = await Promise.all(files.map((name) => Bun.file(join(dir, name)).text()));
  notices.push({ title, text: texts.map((text) => text.trim()).join("\n\n") });
}
if (missing.length > 0) throw new Error(`no licence file in: ${missing.join(", ")}`);

notices.sort((a, b) => a.title.localeCompare(b.title));
const rule = "=".repeat(72);
const body = notices.map(({ title, text }) => `${rule}\n${title}\n${rule}\n\n${text}\n`);
await Bun.write(
  output,
  `The web page of mdame bundles these packages. Their licence texts follow.\n\n${body.join("\n")}`,
);
