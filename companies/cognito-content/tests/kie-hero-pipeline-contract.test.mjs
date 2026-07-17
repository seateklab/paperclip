import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function readPackageFile(relativePath) {
  return readFile(resolve(packageRoot, relativePath), "utf8");
}

test("Cognito Content declares the Kie hero handoff contract", async () => {
  const [writerInstructions, writerSkill, contentDirectorInstructions, company, project, sampleBrief] = await Promise.all([
    readPackageFile("agents/writer/AGENTS.md"),
    readPackageFile("skills/write-article/SKILL.md"),
    readPackageFile("agents/content-director/AGENTS.md"),
    readPackageFile("COMPANY.md"),
    readPackageFile("projects/content-pipeline/PROJECT.md"),
    readPackageFile("projects/content-pipeline/tasks/sample-article-brief/TASK.md"),
  ]);
  const packageDocs = [company, project, sampleBrief].join("\n");

  assert.match(writerInstructions, /paperclip\.kie-image:generate_image/);
  assert.match(writerInstructions, /hero-v1/);
  assert.match(writerInstructions, /article-draft/);
  assert.match(writerInstructions, /\/api\/attachments\/<attachment-id>\/content/);
  assert.match(writerInstructions, /hero-image/);
  assert.match(writerInstructions, /only after[\s\S]+Reviewer/i);
  assert.match(writerInstructions, /Content\s+Director\/admin/);
  assert.match(writerInstructions, /must not[\s\S]+Reviewer/i);
  assert.match(writerSkill, /select the first successful result URL/i);
  assert.match(writerSkill, /only after[\s\S]+reassign to the Reviewer/i);
  assert.match(contentDirectorInstructions, /exactly one[\s\S]+hero-image[\s\S]+provider `paperclip`/i);
  assert.match(contentDirectorInstructions, /do not generate a replacement image/i);
  assert.match(contentDirectorInstructions, /do\s+not hand the issue to the Reviewer/i);
  assert.match(packageDocs, /hero-image/);
  assert.match(packageDocs, /KIE_API_KEY/);
});
