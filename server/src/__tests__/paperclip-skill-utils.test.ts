import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listPaperclipSkillEntries,
  removeMaintainerOnlySkillSymlinks,
} from "@paperclipai/adapter-utils/server-utils";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

function runProcess(command: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${command} exited with ${code}\n${stderr || stdout}`));
    });
  });
}

function quotePowerShellLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

describe("paperclip skill utils", () => {
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("lists bundled runtime skills from ./skills without pulling in .agents/skills", async () => {
    const root = await makeTempDir("paperclip-skill-roots-");
    cleanupDirs.add(root);

    const moduleDir = path.join(root, "a", "b", "c", "d", "e");
    await fs.mkdir(moduleDir, { recursive: true });
    await fs.mkdir(path.join(root, "skills", "paperclip"), { recursive: true });
    await fs.mkdir(path.join(root, "skills", "paperclip-create-agent"), { recursive: true });
    await fs.mkdir(path.join(root, ".agents", "skills", "release"), { recursive: true });

    const entries = await listPaperclipSkillEntries(moduleDir);

    expect(entries.map((entry) => entry.key)).toEqual([
      "paperclipai/paperclip/paperclip",
      "paperclipai/paperclip/paperclip-create-agent",
    ]);
    expect(entries.map((entry) => entry.runtimeName)).toEqual([
      "paperclip",
      "paperclip-create-agent",
    ]);
    expect(entries[0]?.source).toBe(path.join(root, "skills", "paperclip"));
    expect(entries[1]?.source).toBe(path.join(root, "skills", "paperclip-create-agent"));
  });

  it("documents artifact uploads in the installed Paperclip skill", async () => {
    const skillBody = await fs.readFile(path.resolve("skills/paperclip/SKILL.md"), "utf8");
    const referenceBody = await fs.readFile(path.resolve("skills/paperclip/references/artifacts.md"), "utf8");

    expect(skillBody).toContain("Generated Artifacts and Work Products");
    expect(skillBody).toContain("references/artifacts.md");
    expect(skillBody).not.toContain("/api/companies/$PAPERCLIP_COMPANY_ID/issues/$PAPERCLIP_TASK_ID/attachments");
    expect(referenceBody).toContain("Generated Artifacts and Work Products");
    expect(referenceBody).toContain("scripts/paperclip-upload-artifact.sh");
    expect(referenceBody).toContain("POST");
    expect(referenceBody).toContain("/api/companies/$PAPERCLIP_COMPANY_ID/issues/$PAPERCLIP_TASK_ID/attachments");
    expect(referenceBody).toContain("/api/issues/$PAPERCLIP_TASK_ID/work-products");
    await expect(
      fs.access(path.resolve("skills/paperclip/scripts/paperclip-upload-artifact.sh")),
    ).resolves.toBeUndefined();
    await expect(fs.access(path.resolve("scripts/paperclip-upload-artifact.sh"))).rejects.toThrow();
  });

  it("bundles and documents a UTF-8-safe Windows PowerShell JSON request helper", async () => {
    const skillBody = await fs.readFile(path.resolve("skills/paperclip/SKILL.md"), "utf8");
    const helperBody = await fs.readFile(
      path.resolve("skills/paperclip/scripts/paperclip-api-request.ps1"),
      "utf8",
    );

    expect(skillBody).toContain("paperclip-api-request.ps1");
    expect(skillBody).toContain("Windows PowerShell");
    expect(helperBody).toContain("[System.Text.UTF8Encoding]::new($false)");
    expect(helperBody).toContain('application/json; charset=utf-8');
  });

  it.runIf(process.platform === "win32")(
    "preserves Vietnamese JSON through the bundled Windows PowerShell helper",
    async () => {
      const root = await makeTempDir("paperclip-powershell-utf8-");
      cleanupDirs.add(root);

      const expected = {
        title: "Nghiên cứu các chủ đề nổi bật về AI Agent",
        body: "Dòng một: tiếng Việt đầy đủ.\nDòng hai: Trí tuệ nhân tạo.",
      };
      const helperPath = path.resolve("skills/paperclip/scripts/paperclip-api-request.ps1");
      await fs.access(helperPath);

      const requestPromise = new Promise<{
        body: Buffer;
        contentType: string | undefined;
        authorization: string | undefined;
        runId: string | undefined;
      }>((resolve, reject) => {
        const server = http.createServer((request, response) => {
          const chunks: Buffer[] = [];
          request.on("data", (chunk: Buffer) => chunks.push(chunk));
          request.on("error", reject);
          request.on("end", () => {
            resolve({
              body: Buffer.concat(chunks),
              contentType: request.headers["content-type"],
              authorization: request.headers.authorization,
              runId: request.headers["x-paperclip-run-id"] as string | undefined,
            });
            response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
            response.end('{"ok":true}');
            server.close();
          });
        });

        server.on("error", reject);
        server.listen(0, "127.0.0.1", async () => {
          const address = server.address();
          if (!address || typeof address === "string") {
            reject(new Error("Expected a TCP listener address"));
            server.close();
            return;
          }

          const wrapperPath = path.join(root, "invoke-helper.ps1");
          const wrapper = `\uFEFF$payload = @{\n  title = ${quotePowerShellLiteral(expected.title)}\n  body = ${quotePowerShellLiteral(expected.body)}\n} | ConvertTo-Json -Depth 10\n& ${quotePowerShellLiteral(helperPath)} -Method POST -Path ${quotePowerShellLiteral(`http://127.0.0.1:${address.port}/capture`)} -Body $payload -ApiKey 'test-key' -RunId 'test-run'\n`;
          await fs.writeFile(wrapperPath, wrapper, "utf8");

          runProcess(
            "powershell.exe",
            ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", wrapperPath],
            path.resolve("."),
          ).catch((error) => {
            reject(error);
            server.close();
          });
        });
      });

      const received = await requestPromise;
      expect(received.contentType).toContain("application/json");
      expect(received.contentType).toContain("charset=utf-8");
      expect(received.authorization).toBe("Bearer test-key");
      expect(received.runId).toBe("test-run");
      expect(JSON.parse(received.body.toString("utf8"))).toEqual(expected);
    },
    15_000,
  );

  it("marks skills with required: false in SKILL.md frontmatter as optional", async () => {
    const root = await makeTempDir("paperclip-skill-optional-");
    cleanupDirs.add(root);

    const moduleDir = path.join(root, "a", "b", "c", "d", "e");
    await fs.mkdir(moduleDir, { recursive: true });

    // Required skill (no frontmatter flag)
    const requiredDir = path.join(root, "skills", "paperclip");
    await fs.mkdir(requiredDir, { recursive: true });
    await fs.writeFile(path.join(requiredDir, "SKILL.md"), "---\nname: paperclip\n---\n\n# Paperclip\n");

    // Optional skill (required: false)
    const optionalDir = path.join(root, "skills", "paperclip-dev");
    await fs.mkdir(optionalDir, { recursive: true });
    await fs.writeFile(path.join(optionalDir, "SKILL.md"), "---\nname: paperclip-dev\nrequired: false\n---\n\n# Dev\n");

    const entries = await listPaperclipSkillEntries(moduleDir);
    entries.sort((a, b) => a.runtimeName.localeCompare(b.runtimeName));

    expect(entries).toHaveLength(2);
    expect(entries[0]?.runtimeName).toBe("paperclip");
    expect(entries[0]?.required).toBe(true);
    expect(entries[1]?.runtimeName).toBe("paperclip-dev");
    expect(entries[1]?.required).toBe(false);
    expect(entries[1]?.requiredReason).toBeNull();
  });

  it("removes stale maintainer-only symlinks from a shared skills home", async () => {
    const root = await makeTempDir("paperclip-skill-cleanup-");
    cleanupDirs.add(root);

    const skillsHome = path.join(root, "skills-home");
    const runtimeSkill = path.join(root, "skills", "paperclip");
    const customSkill = path.join(root, "custom", "release-notes");
    const staleMaintainerSkill = path.join(root, ".agents", "skills", "release");

    await fs.mkdir(skillsHome, { recursive: true });
    await fs.mkdir(runtimeSkill, { recursive: true });
    await fs.mkdir(customSkill, { recursive: true });

    await fs.symlink(runtimeSkill, path.join(skillsHome, "paperclip"));
    await fs.symlink(customSkill, path.join(skillsHome, "release-notes"));
    await fs.symlink(staleMaintainerSkill, path.join(skillsHome, "release"));

    const removed = await removeMaintainerOnlySkillSymlinks(skillsHome, ["paperclip"]);

    expect(removed).toEqual(["release"]);
    await expect(fs.lstat(path.join(skillsHome, "release"))).rejects.toThrow();
    expect((await fs.lstat(path.join(skillsHome, "paperclip"))).isSymbolicLink()).toBe(true);
    expect((await fs.lstat(path.join(skillsHome, "release-notes"))).isSymbolicLink()).toBe(true);
  });
});
