import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const scriptSource = readFileSync(join(repoRoot, "scripts", "link-plugin-dev-sdk.mjs"), "utf8");

test("link-plugin-dev-sdk replaces an existing Windows junction without failing", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "paperclip-link-plugin-dev-sdk-"));
  const fakeRepoRoot = join(tempRoot, "repo");
  const fakeScriptPath = join(fakeRepoRoot, "scripts", "link-plugin-dev-sdk.mjs");
  const sdkDir = join(fakeRepoRoot, "packages", "plugins", "sdk");
  const pluginDir = join(fakeRepoRoot, "packages", "plugins", "plugin-workspace-diff");
  const scopedNodeModulesDir = join(pluginDir, "node_modules", "@paperclipai");
  const linkTarget = join(scopedNodeModulesDir, "plugin-sdk");

  mkdirSync(join(fakeRepoRoot, "scripts"), { recursive: true });
  mkdirSync(sdkDir, { recursive: true });
  mkdirSync(scopedNodeModulesDir, { recursive: true });
  mkdirSync(pluginDir, { recursive: true });
  mkdirSync(join(pluginDir, "node_modules"), { recursive: true });

  symlinkSync(sdkDir, linkTarget, "junction");

  const packageJsonPath = join(pluginDir, "package.json");
  const packageJson = JSON.stringify({ name: "plugin-workspace-diff", version: "0.0.0" });

  mkdirSync(dirname(fakeScriptPath), { recursive: true });
  writeFileSync(fakeScriptPath, scriptSource);
  writeFileSync(packageJsonPath, packageJson);

  const result = spawnSync(process.execPath, [fakeScriptPath], {
    cwd: pluginDir,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
});
