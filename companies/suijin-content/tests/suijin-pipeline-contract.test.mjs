import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const packageRoot = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(packageRoot, relativePath), "utf8");
}

function assertOrdered(text, markers) {
  let previous = -1;
  for (const marker of markers) {
    const position = text.indexOf(marker);
    assert.notEqual(position, -1, `missing ordered marker: ${marker}`);
    assert.ok(position > previous, `marker is out of order: ${marker}`);
    previous = position;
  }
}

function assertNotPresent(text, forbidden) {
  for (const value of forbidden) {
    assert.equal(text.includes(value), false, `forbidden content present: ${value}`);
  }
}

test("Suijin package declares the complete approval-gated Facebook pipeline", () => {
  const company = read("COMPANY.md");
  const sidecar = read(".paperclip.yaml");
  const project = read("projects/suijin/PROJECT.md");
  const starterTask = read("projects/suijin/tasks/sample-research-request/TASK.md");
  const researchAgent = read("agents/research-agent/AGENTS.md");
  const taskAgent = read("agents/task-agent/AGENTS.md");
  const writerAgent = read("agents/facebook-writer/AGENTS.md");
  const imageAgent = read("agents/image-agent/AGENTS.md");
  const publisherAgent = read("agents/facebook-publisher/AGENTS.md");
  const researchSkill = read("skills/research-facebook-topics/SKILL.md");
  const taskSkill = read("skills/create-reviewed-topic-tasks/SKILL.md");
  const writerSkill = read("skills/write-facebook-post/SKILL.md");
  const unicodeSkill = read("skills/verifying-published-text/SKILL.md");
  const imageSkill = read("skills/kie-image-generation/SKILL.md");
  const publisherSkill = read("skills/publish-facebook-via-noto/SKILL.md");
  const allPackageContent = [
    company,
    sidecar,
    project,
    starterTask,
    researchAgent,
    taskAgent,
    writerAgent,
    imageAgent,
    publisherAgent,
    researchSkill,
    taskSkill,
    writerSkill,
    unicodeSkill,
    imageSkill,
    publisherSkill,
  ].join("\n");

  assert.match(company, /name:\s*Suijin Content/);
  assert.match(company, /slug:\s*suijin-content/);
  assert.match(company, /schema:\s*agentcompanies\/v1/);
  for (const marker of [
    "task-agent",
    "Task Agent",
    "research-agent",
    "Research Agent",
    "facebook-writer",
    "Facebook Writer",
    "image-agent",
    "Image Agent",
    "facebook-publisher",
    "Facebook Publisher",
    "Suijin",
  ]) {
    assert.ok(company.includes(marker), `company metadata missing ${marker}`);
  }
  assertOrdered(company, [
    "Task Agent",
    "Research Agent",
    "Facebook Writer",
    "Image Agent",
    "Facebook Publisher",
  ]);

  assert.match(taskAgent, /reportsTo:\s*null/);
  for (const specialist of [researchAgent, writerAgent, imageAgent, publisherAgent]) {
    assert.match(specialist, /reportsTo:\s*task-agent/);
  }
  assertOrdered(taskAgent, ["- paperclip", "- create-reviewed-topic-tasks"]);
  assertOrdered(researchAgent, ["- paperclip", "- research-facebook-topics", "- agent-browser"]);
  assertOrdered(writerAgent, ["- paperclip", "- write-facebook-post", "- verifying-published-text"]);
  assertOrdered(imageAgent, ["- paperclip", "- kie-image-generation"]);
  assertOrdered(publisherAgent, ["- paperclip", "- publish-facebook-via-noto", "- noto"]);

  assert.match(project, /name:\s*Suijin/);
  assert.match(project, /owner:\s*task-agent/);
  assert.match(starterTask, /assignee:\s*research-agent/);
  assert.match(starterTask, /project:\s*suijin/);

  assert.match(researchSkill, /research-results/);
  assert.match(researchSkill, /five|5/i);
  assert.match(researchSkill, /Rationale:/);
  assert.match(researchSkill, /Sources:/);
  assert.match(researchSkill, /TAVILY_API_KEY/);
  assert.match(researchSkill, /2[–-]6|2 to 6|six/i);
  assert.doesNotMatch(researchSkill, /hard-coded topic|fixed topic|default topic/i);

  assert.match(taskSkill, /request_confirmation/);
  assert.match(taskSkill, /supersedeOnUserComment:\s*true/);
  assert.match(taskSkill, /continuationPolicy:\s*["']none["']/);
  assert.match(taskSkill, /in_review/);
  for (const phrase of ["Approved", "Agree", "Đồng ý", "Duyệt"]) {
    assert.ok(taskSkill.includes(phrase), `missing approval phrase: ${phrase}`);
  }
  assertOrdered(taskSkill, ["reuse", "never create a second", "Create unmatched"]);

  assert.match(writerSkill, /facebook-post/);
  assert.match(writerSkill, /Language/);
  assert.match(writerSkill, /Vietnamese/);
  assert.match(unicodeSkill, /UTF-8/);
  assertOrdered(writerAgent, ["read", "facebook-post", "assign", "Image Agent"]);

  assert.match(imageSkill, /facebook-image-v1/);
  assert.match(imageSkill, /gpt-image-2-text-to-image/);
  assert.match(imageSkill, /1:1/);
  assert.match(imageSkill, /1K/);
  assert.match(imageSkill, /png/i);
  assertOrdered(imageSkill, ["attachment", "work product", "Publisher"]);
  assert.match(imageSkill, /artifactKind["']?\s*:\s*["']facebook-image["']/);

  for (const field of ["action", "targetPage", "documentKey", "imageWorkProduct", "publicationKey"]) {
    assert.ok(publisherSkill.includes(field), `missing final approval field: ${field}`);
  }
  assertOrdered(publisherSkill, ["approval", "approved", "noto"]);
  assert.match(publisherSkill, /provider["']?\s*:\s*["']noto["']/);
  assert.match(publisherSkill, /external post id|externalId/i);
  assert.match(publisherSkill, /permalink|url/i);
  assert.match(publisherSkill, /mark.*done|done.*topic/i);
  assertOrdered(publisherSkill, [
    "list_connections",
    "get_connection",
    "list_connection_tools",
    "execute_connection_function",
  ]);
  for (const marker of [
    "platformSlug",
    "connected",
    "connectionId",
    "functionName",
    "inputSchema",
    "schema-compatible",
    "image/media",
    "success: false",
    "noto_execution_ambiguous",
    "external post ID",
    "permalink",
  ]) {
    assert.ok(publisherSkill.includes(marker), `missing Noto Publisher marker: ${marker}`);
  }
  assertOrdered(publisherSkill, [
    "inputSchema",
    "execute_connection_function",
    "external post ID",
    "Facebook publication",
  ]);

  assertOrdered(publisherSkill, [
    "local URL",
    "block",
    "before execution",
  ]);
  assertOrdered(publisherSkill, [
    "success: false",
    "definitive",
    "retry",
  ]);
  assertOrdered(publisherSkill, [
    "ambiguous",
    "Never retry",
  ]);

  assertNotPresent(allPackageContent, [
    "FACEBOOK_CREATE_POST",
    "FACEBOOK_PUBLISH_POST",
    "publishToFacebook",
    "facebook.graph.",
  ]);

  assertNotPresent(allPackageContent, [
    "FACEBOOK_PAGE_ACCESS_TOKEN",
    "graph.facebook.com",
    "temporary Kie URL",
    "temporary provider URL",
    "placeholder image",
    "SVG fallback",
    "paperclip.noto:",
  ]);
  assert.doesNotMatch(allPackageContent, /(?:sk|pk|api[_-]?key|token|secret)[=:]\s*["'][A-Za-z0-9_-]{16,}["']/i);

  assert.match(sidecar, /schema:\s*paperclip\/v1/);
  assert.match(sidecar, /research-agent:[\s\S]*TAVILY_API_KEY/);
  assert.match(sidecar, /kind:\s*secret/);
  assert.match(sidecar, /requirement:\s*required/);
  assert.doesNotMatch(sidecar, /adapter:/);
  assert.doesNotMatch(sidecar, /facebook-publisher:[\s\S]*(?:paused|status:)/i);
});
