import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const packageRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(packageRoot, "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(packageRoot, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function readRepository(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function assertOrdered(text, markers) {
  let previous = -1;
  for (const marker of markers) {
    const position = marker instanceof RegExp ? text.search(marker) : text.indexOf(marker);
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
  const transportSkill = readRepository(
    "packages/skills-catalog/catalog/bundled/software-development/managed-tool-utf8-transport/SKILL.md",
  );
  const researchSkill = read("skills/research-facebook-topics/SKILL.md");
  const taskSkill = read("skills/create-reviewed-topic-tasks/SKILL.md");
  const writerSkill = read("skills/write-facebook-post/SKILL.md");
  const unicodeSkill = read("skills/verifying-published-text/SKILL.md");
  const imageSkill = imageAgent;
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
    transportSkill,
    researchSkill,
    taskSkill,
    writerSkill,
    unicodeSkill,
    imageSkill,
    publisherSkill,
  ].join("\n");
  const taskAgentMarker = company.match(/\btask-agent\b/)?.[0] ?? "";
  const topicSkill = [taskAgentMarker, taskSkill].join("\n");

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
  assertOrdered(publisherAgent, [
    "- paperclip",
    "- managed-tool-utf8-transport",
    "- publish-facebook-via-noto",
    "- noto",
  ]);

  assert.match(project, /name:\s*Suijin/);
  assert.match(project, /owner:\s*task-agent/);
  assert.match(company, /one independent[\s\S]*request_board_approval[\s\S]*separate Inbox item/);
  assert.match(project, /each approval appears separately[\s\S]*Inbox/i);
  assert.match(read("README.md"), /exactly one linked[\s\S]*request_board_approval[\s\S]*per result/);
  assert.match(starterTask, /assignee:\s*research-agent/);
  assert.match(starterTask, /project:\s*suijin/);

  assert.match(researchSkill, /research-results/);
  assert.match(researchSkill, /five|5/i);
  assert.match(researchSkill, /Rationale:/);
  assert.match(researchSkill, /Sources:/);
  assert.match(researchSkill, /TAVILY_API_KEY/);
  assert.match(researchSkill, /2[–-]6|2 to 6|six/i);
  assert.doesNotMatch(researchSkill, /hard-coded topic|fixed topic|default topic/i);

  assert.match(taskSkill, /request_board_approval/);
  assert.match(taskSkill, /paperclipCreateApproval/);
  assert.match(taskSkill, /issueIds[\s\S]*child/);
  assert.match(taskSkill, /exactly one[\s\S]*approval/);
  assert.match(taskSkill, /PAPERCLIP_APPROVAL_ID/);
  assert.match(taskSkill, /status is exactly `approved`/);
  assert.doesNotMatch(taskSkill, /request_confirmation/);
  assertOrdered(topicSkill, [
    "task-agent",
    "request_board_approval",
    "in_review",
    "facebook-writer",
  ]);
  assert.match(taskSkill, /resolve Task Agent's assigned agent ID in[\s\S]*`assigneeAgentId`/);
  assert.match(taskSkill, /List approvals linked to that child/);
  assert.match(taskSkill, /requestedByAgentId/);
  assert.match(taskSkill, /issueIds:\s*\[childId\]/);
  assert.match(taskSkill, /PAPERCLIP_APPROVAL_STATUS/);
  assert.match(taskSkill, /sibling children must not change/i);
  assert.match(taskSkill, /in_review/);
  assertOrdered(taskSkill, ["Reuse", "never\n   create a second", "Create unmatched"]);

  assert.match(writerSkill, /facebook-post/);
  assert.match(writerSkill, /Language/);
  assert.match(writerSkill, /Vietnamese/);
  assert.match(writerSkill, /paperclipListIssueApprovals/);
  assert.match(writerSkill, /paperclipGetApproval/);
  assert.match(writerSkill, /request_board_approval/);
  assert.match(writerSkill, /status\s+to be exactly `approved`/);
  assert.doesNotMatch(writerSkill, /request_confirmation/);
  assert.match(writerSkill, /duplicate/);
  assert.match(writerSkill, /Missing or ambiguous topic-child fields/);
  assert.match(writerSkill, /leave the child in_review/);
  assert.match(writerSkill, /approval of another topic never authorizes\s+this\s+child/i);
  assert.match(writerSkill, /Do not create or overwrite\s+facebook-post/);
  assertOrdered(writerSkill, [
    "## Topic gate preflight",
    "paperclipListIssueApprovals",
    "paperclipGetApproval",
    "Only after this preflight passes",
    "Write one concise Markdown document keyed `facebook-post`",
    /Only after readback succeeds should\s+Facebook Writer comment the handoff and assign Image Agent/,
  ]);
  assert.match(writerAgent, /paperclipListIssueApprovals/);
  assert.match(writerAgent, /paperclipGetApproval/);
  assert.match(writerAgent, /request_board_approval/);
  assert.doesNotMatch(writerAgent, /request_confirmation/);
  assert.match(writerAgent, /approval of another topic never authorizes\s+this\s+child/i);
  assert.match(writerAgent, /visibly blocks/);
  assert.match(writerAgent, /leaves the child in_review/);
  assert.match(writerAgent, /prevents writing, reassignment, continuation, or\s+assignment of Image Agent/);
  assertOrdered(writerAgent, [
    "Before reading or writing",
    "paperclipListIssueApprovals",
    "visibly block",
    "Only after that preflight passes",
    "document keyed `facebook-post`",
    "assign Image Agent. The handoff",
  ]);
  assert.match(unicodeSkill, /UTF-8/);
  assertOrdered(writerAgent, ["read", "document keyed `facebook-post`", "assign Image Agent. The handoff"]);

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
  assertOrdered(publisherSkill, ["## Final board gate", "require status `approved`", "managed skill `noto`"]);
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
  assert.match(publisherSkill, /connectionIds:\s*\[selectedConnectionId\]/);
  assert.match(
    publisherSkill,
    /execute_connection_function[\s\S]*?connectionId:\s*selectedConnectionId[\s\S]*?functionName/,
  );
  assert.match(
    publisherSkill,
    /After `get_connection`, require the refreshed connection's Page\/account\s+identity[\s\S]*?before\s+listing\s+tools\s+or\s+executing/,
  );
  assert.match(publisherSkill, /metadata\.targetPage[\s\S]*?exactly equal the current issue\s+Page/);
  assert.match(
    publisherSkill,
    /metadata\.publicationKey[\s\S]*?exactly equal the\s+current issue's publication key/,
  );
  assertOrdered(publisherSkill, ["platformSlug", "page", "limit", "total", "connectionIds"]);
  assert.match(publisherSkill, /returned group/);
  assert.match(publisherSkill, /terminal publication failure/);
  assert.match(publisherSkill, /durable `blocked`/);
  assert.match(publisherSkill, /sanitized action/);
  assert.match(publisherSkill, /Noto error code/);
  assert.match(publisherSkill, /sanitized operational summary/);
  assert.match(publisherSkill, /Never copy raw provider `error`, raw\s+`output`/);
  assert.match(publisherSkill, /explicitly\s+labeled\s+external post ID field or path/);
  assert.match(publisherSkill, /explicitly\s+labeled\s+permalink field or path/);
  assert.match(publisherSkill, /generic or ambiguous `id`, `url`, `link`/);
  assert.match(publisherSkill, /duplicate values, contradictory values/);
  assertOrdered(publisherSkill, [
    /successful publication\s+artifact/,
    /do not call Noto\s+again/,
    "idempotently",
  ]);
  assert.match(imageAgent, /outputFormat:\s*"png"/);
  assert.match(unicodeSkill, /document or post/);
  assert.match(unicodeSkill, /`facebook-post`/);
  assert.match(unicodeSkill, /hook, body, closing/);
  assert.match(unicodeSkill, /every source link/);
  assert.match(unicodeSkill, /After external publication/);
  assert.match(unicodeSkill, /actual Facebook post/);
  assert.match(unicodeSkill, /must not create a publication artifact/);
  assertOrdered(publisherSkill, [
    "inputSchema",
    "execute_connection_function",
    "external post ID field or path",
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
    /\bretried\b/,
  ]);
  assertOrdered(publisherSkill, [
    "ambiguous",
    /never retried/,
  ]);

  assertOrdered(publisherAgent, [
    "- publish-facebook-via-noto",
    "- verifying-published-text",
    "Publisher is invoked",
  ]);
  for (const marker of [
    "paperclip-plugin-tool.mjs",
    "actual Facebook post",
    "readback",
    "published body",
    "manual-correction",
    "must not mark the topic `done`",
  ]) {
    assert.ok(publisherSkill.includes(marker), `missing Publisher verification marker: ${marker}`);
  }
  assertOrdered(publisherSkill, [
    "Require a successful publication result",
    "read back the actual Facebook post",
    /create the\s+durable publication\s+artifact/i,
  ]);
  assertNotPresent(publisherSkill, [
    "Invoke-RestMethod",
    "curl",
    "graph.facebook.com",
  ]);

  assert.match(publisherAgent, /managed-tool-utf8-transport/);
  assert.match(transportSkill, /Use when.*non-ASCII.*managed.*tool/i);
  assert.match(transportSkill, /BOM-less UTF-8/);
  assert.match(transportSkill, /--parameters-file/);
  assert.match(transportSkill, /WriteAllText/);
  assert.match(transportSkill, /\$json \| node/);
  assert.match(transportSkill, /stop|block/i);
  assert.match(read("README.md"), /managed-tool-utf8-transport/);

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
