import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

async function main() {
  let packageJsonPath;
  try {
    packageJsonPath = require.resolve("embedded-postgres/package.json");
  } catch (error) {
    throw new Error("embedded-postgres is not installed; cannot apply compatibility patch", { cause: error });
  }

  const distIndexPath = path.join(path.dirname(packageJsonPath), "dist", "index.js");
  const original = await readFile(distIndexPath, "utf8");

  const replacements = [
    ["const LC_MESSAGES_LOCALE = 'en_US.UTF-8';", "const LC_MESSAGES_LOCALE = 'C';"],
    [
      "], Object.assign(Object.assign({}, permissionIds), { env: { LC_MESSAGES: LC_MESSAGES_LOCALE } }));",
      "], Object.assign(Object.assign({}, permissionIds), { env: Object.assign(Object.assign({}, globalThis.process.env), { LC_MESSAGES: LC_MESSAGES_LOCALE }) }));",
    ],
  ];

  let updated = original;
  let changed = false;
  for (const [from, to] of replacements) {
    if (updated.includes(to)) continue;
    if (!updated.includes(from)) continue;
    updated = updated.replace(from, to);
    changed = true;
  }

  if (!changed) {
    return;
  }

  await writeFile(distIndexPath, updated);
  process.stdout.write(`patched embedded-postgres at ${distIndexPath}\n`);
}

await main();
