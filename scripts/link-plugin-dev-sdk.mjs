#!/usr/bin/env node

import {
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const packageDir = process.cwd();
const sdkDir = join(repoRoot, "packages", "plugins", "sdk");
const scopeDir = join(packageDir, "node_modules", "@paperclipai");
const linkTarget = join(scopeDir, "plugin-sdk");

if (!existsSync(join(packageDir, "package.json"))) {
  throw new Error(`No package.json found in plugin directory: ${packageDir}`);
}

mkdirSync(scopeDir, { recursive: true });

try {
  const stat = lstatSync(linkTarget);
  const resolvedSdkDir = realpathSync(sdkDir);
  const resolvedLinkTarget = realpathSync(linkTarget);
  const isLocalSdkLink =
    resolvedLinkTarget === resolvedSdkDir && resolvedLinkTarget !== linkTarget;

  if (stat.isSymbolicLink() || isLocalSdkLink) {
    rmSync(linkTarget, { force: true, recursive: true });
  } else {
    console.log("  i Keeping existing installed @paperclipai/plugin-sdk directory in place");
    process.exit(0);
  }
} catch {
  // target does not exist yet
}

const relativeSdkDir = relative(scopeDir, sdkDir);
const symlinkPath = process.platform === "win32" ? sdkDir : relativeSdkDir;
const symlinkType = process.platform === "win32" ? "junction" : "dir";
symlinkSync(symlinkPath, linkTarget, symlinkType);

console.log(`  ✓ Linked local @paperclipai/plugin-sdk for ${packageDir}`);
