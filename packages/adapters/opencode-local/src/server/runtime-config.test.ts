import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { prepareOpenCodeRuntimeConfig } from "./runtime-config.js";

const cleanupPaths = new Set<string>();
const adapterRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const paperclipMcpScript = path.resolve(adapterRoot, "..", "mcp-server", "dist", "stdio.js");

afterEach(async () => {
  await Promise.all(
    [...cleanupPaths].map(async (filepath) => {
      await fs.rm(filepath, { recursive: true, force: true });
      cleanupPaths.delete(filepath);
    }),
  );
});

async function makeConfigHome(initialConfig?: Record<string, unknown>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-opencode-test-"));
  cleanupPaths.add(root);
  const configDir = path.join(root, "opencode");
  await fs.mkdir(configDir, { recursive: true });
  if (initialConfig) {
    await fs.writeFile(
      path.join(configDir, "opencode.json"),
      `${JSON.stringify(initialConfig, null, 2)}\n`,
      "utf8",
    );
  }
  return root;
}

describe("prepareOpenCodeRuntimeConfig", () => {
  it("injects a schema-valid local Paperclip MCP entry and preserves existing config", async () => {
    const configHome = await makeConfigHome({
      permission: {
        read: "allow",
      },
      mcp: {
        existing: {
          type: "local",
          command: ["existing-mcp"],
        },
      },
      theme: "system",
    });

    const prepared = await prepareOpenCodeRuntimeConfig({
      env: { XDG_CONFIG_HOME: configHome },
      config: {},
    });
    cleanupPaths.add(prepared.env.XDG_CONFIG_HOME);

    expect(prepared.env.XDG_CONFIG_HOME).not.toBe(configHome);
    const runtimeConfig = JSON.parse(
      await fs.readFile(
        path.join(prepared.env.XDG_CONFIG_HOME, "opencode", "opencode.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;
    const expectedMcp: Record<string, unknown> = {
      existing: {
        type: "local",
        command: ["existing-mcp"],
      },
    };
    if (existsSync(paperclipMcpScript)) {
      expectedMcp.paperclip = {
        type: "local",
        command: [process.execPath, paperclipMcpScript],
      };
    }

    expect(runtimeConfig).toMatchObject({
      theme: "system",
      permission: {
        read: "allow",
        external_directory: "allow",
      },
      mcp: expectedMcp,
    });
    if (existsSync(paperclipMcpScript)) {
      const paperclipMcp = (runtimeConfig.mcp as Record<string, unknown>).paperclip as Record<string, unknown>;
      expect(paperclipMcp).not.toHaveProperty("args");
      expect(paperclipMcp).not.toHaveProperty("type", "command-line");
    }

    await prepared.cleanup();
    cleanupPaths.delete(prepared.env.XDG_CONFIG_HOME);
    await expect(fs.access(prepared.env.XDG_CONFIG_HOME)).rejects.toThrow();
  });

  it("respects explicit opt-out", async () => {
    const configHome = await makeConfigHome();
    const prepared = await prepareOpenCodeRuntimeConfig({
      env: { XDG_CONFIG_HOME: configHome },
      config: { dangerouslySkipPermissions: false },
    });

    expect(prepared.env).toEqual({ XDG_CONFIG_HOME: configHome });
    expect(prepared.notes).toEqual([]);
    await prepared.cleanup();
  });
});
