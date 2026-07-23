import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";

type Harness = ReturnType<typeof createTestHarness>;
type SeedIssue = NonNullable<Parameters<Harness["seed"]>[0]["issues"]>[number];
type IssueComment = Awaited<ReturnType<Harness["ctx"]["issues"]["createComment"]>>;

type DbRow = Record<string, unknown> & {
  id: string;
  company_id: string;
  issue_id: string;
  agent_id: string;
  run_id: string;
  request_key: string;
  status: string;
  task_id: string | null;
};

function createIssue(id = "issue-1", companyId = "company-1"): SeedIssue {
  return { id, companyId } as SeedIssue;
}

function installFakeDb(harness: Harness) {
  const rows = new Map<string, DbRow>();
  const now = () => new Date().toISOString();

  harness.ctx.db.query = async <T,>(sql: string, params: unknown[] = []) => {
    if (sql.includes("task_id = $1")) {
      return [...rows.values()].filter((row) => row.task_id === String(params[0])).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))) as T[];
    }
    const companyId = String(params[0] ?? "");
    if (sql.includes("count(*)") && sql.includes("run_id")) {
      return [{ count: [...rows.values()].filter((row) => row.company_id === companyId && row.run_id === String(params[1])).length }] as T[];
    }
    if (sql.includes("COALESCE(sum(estimated_cost_cents)")) {
      return [{ total: [...rows.values()].filter((row) => row.company_id === companyId && row.run_id === String(params[1])).reduce((sum, row) => sum + Number(row.estimated_cost_cents ?? 0), 0) }] as T[];
    }
    if (sql.includes("count(*)") && sql.includes("status IN")) {
      return [{ count: [...rows.values()].filter((row) => row.company_id === companyId && ["preflight", "waiting", "queuing", "generating"].includes(row.status)).length }] as T[];
    }
    if (sql.includes("request_key = $2")) {
      const row = [...rows.values()].find((entry) => entry.company_id === companyId && entry.request_key === String(params[1]));
      return (row ? [row] : []) as T[];
    }
    if (sql.includes("id = $2")) {
      const row = rows.get(String(params[1]));
      return (row && row.company_id === companyId ? [row] : []) as T[];
    }
    let result = [...rows.values()].filter((row) => row.company_id === companyId);
    if (sql.includes("issue_id = $2")) result = result.filter((row) => row.issue_id === String(params[1]));
    if (sql.includes("status = $2")) result = result.filter((row) => row.status === String(params[1]));
    if (sql.includes("task_id")) result = result.filter((row) => row.task_id === String(params[1]));
    return result.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))) as T[];
  };

  harness.ctx.db.execute = async (sql: string, params: unknown[] = []) => {
    if (sql.includes("INSERT INTO")) {
      const requestKey = String(params[5]);
      const companyId = String(params[1]);
      if ([...rows.values()].some((row) => row.company_id === companyId && row.request_key === requestKey)) return { rowCount: 0 };
      const timestamp = now();
      rows.set(String(params[0]), {
        id: String(params[0]), company_id: companyId, issue_id: String(params[2]), agent_id: String(params[3]), run_id: String(params[4]),
        request_key: requestKey, model: String(params[6]), prompt: String(params[7]), purpose: params[8] as string | null,
        aspect_ratio: String(params[9]), resolution: params[10] as string | null, output_format: params[11] as string | null,
        status: "preflight", task_id: null, result_urls: "[]", estimated_cost_cents: params[12], credit_balance: params[13], actual_cost_cents: null,
        preflight_comment_id: null, submitted_at: null, completed_at: null, callback_received_at: null, last_polled_at: null,
        terminal_comment_sent_at: null, wakeup_sent_at: null, attempt_count: 0, failure_code: null, failure_message: null,
        created_at: timestamp, updated_at: timestamp,
      });
      return { rowCount: 1 };
    }
    const companyId = String(params[0]);
    const id = String(params[1]);
    const row = rows.get(id);
    if (!row || row.company_id !== companyId) return { rowCount: 0 };
    if (sql.includes("preflight_comment_id")) {
      row.preflight_comment_id = String(params[2]);
      return { rowCount: 1 };
    }
    if (sql.includes("SET task_id")) {
      row.task_id = String(params[2]);
      row.status = "waiting";
      row.submitted_at = now();
      row.attempt_count = Number(row.attempt_count) + 1;
      return { rowCount: 1 };
    }
    if (sql.includes("SET status = 'fail'")) {
      row.status = "fail";
      row.failure_code = String(params[2]);
      row.failure_message = String(params[3]);
      row.completed_at = now();
      return { rowCount: 1 };
    }
    if (sql.includes("SET status = $3")) {
      row.status = String(params[2]);
      row.result_urls = params[3];
      row.actual_cost_cents = params[4];
      row.failure_code = params[5];
      row.failure_message = params[6];
      if (["success", "fail", "timeout"].includes(row.status)) row.completed_at = now();
      return { rowCount: 1 };
    }
    if (sql.includes("terminal_comment_sent_at") || sql.includes("wakeup_sent_at")) {
      const column = sql.includes("terminal_comment_sent_at") ? "terminal_comment_sent_at" : "wakeup_sent_at";
      if (!row[column]) {
        row[column] = now();
        return { rowCount: 1 };
      }
    }
    return { rowCount: 0 };
  };

  return rows;
}

function comment(id: string, issueId: string, companyId: string, body: string): IssueComment {
  return {
    id,
    issueId,
    companyId,
    body,
    authorType: "agent",
    authorAgentId: "agent-1",
    authorUserId: null,
    presentation: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("Kie image worker", () => {
  it("validates instance defaults without requiring company credentials", async () => {
    const result = await plugin.definition.onValidateConfig?.({
      publicBaseUrl: "https://paperclip.example",
      pollIntervalSeconds: 60,
      timeoutMinutes: 15,
    });

    expect(result).toEqual({ ok: true });
    await expect(plugin.definition.onValidateConfig?.({ apiKey: "raw-token" }))
      .resolves.toMatchObject({ ok: false, errors: ["raw apiKey is not accepted; use apiKeyRef"] });
  });

  it("reports preflight before spending and submits without confirmation", async () => {
    const harness = createTestHarness({ manifest });
    installFakeDb(harness);
    harness.setConfig({ apiKeyRef: "KIE_API_KEY" });
    harness.seed({ issues: [createIssue()] });
    const events: string[] = [];
    const comments: IssueComment[] = [];
    harness.ctx.issues.createComment = async (issueId, body, companyId) => {
      events.push("comment");
      const value = comment(`comment-${comments.length + 1}`, issueId, companyId, body);
      comments.push(value);
      return value;
    };
    harness.ctx.issues.createInteraction = async () => {
      throw new Error("confirmation interaction must not be requested");
    };
    const resolvedRefs: Array<{ secretRef: string; configPath?: string }> = [];
    harness.ctx.secrets.resolve = async (secretRef, options) => {
      resolvedRefs.push({ secretRef, configPath: options?.configPath });
      return "KIE_SECRET_VALUE";
    };
    harness.ctx.http.fetch = async (url, init) => {
      if (url.includes("/chat/credit")) return new Response(JSON.stringify({ data: 100 }), { status: 200 });
      expect(init?.headers).toMatchObject({ Authorization: "Bearer KIE_SECRET_VALUE" });
      events.push("kie-create");
      return new Response(JSON.stringify({ data: { taskId: "task-1" } }), { status: 200 });
    };
    await plugin.definition.setup(harness.ctx);

    const result = await harness.executeTool("generate_image", {
      issueId: "issue-1",
      requestKey: "hero-v1",
      prompt: "A paperclip hero image",
      purpose: "landing page",
      model: "nano-banana-2",
      aspectRatio: "1:1",
    }, { companyId: "company-1", agentId: "agent-1", runId: "run-1", projectId: "project-1" });

    expect(result.error).toBeUndefined();
    expect(resolvedRefs).toEqual([
      { secretRef: "KIE_API_KEY", configPath: "apiKeyRef" },
      { secretRef: "KIE_API_KEY", configPath: "apiKeyRef" },
    ]);
    expect(events).toEqual(["comment", "kie-create"]);
    expect(comments[0]?.body).toContain("no confirmation step is required");
  });

  it("fails closed when a company invocation has no Kie company config", async () => {
    const harness = createTestHarness({ manifest });
    installFakeDb(harness);
    harness.seed({ issues: [createIssue()] });
    await plugin.definition.setup(harness.ctx);

    const result = await harness.executeTool("generate_image", {
      issueId: "issue-1",
      requestKey: "missing-company-config",
      prompt: "A paperclip hero image",
      model: "nano-banana-2",
      aspectRatio: "1:1",
    }, { companyId: "company-1", agentId: "agent-1", runId: "run-1", projectId: "project-1" });

    expect(result.error).toContain("KieAPI secret reference is not configured");
  });

  it("returns the original request for a duplicate request key", async () => {
    const harness = createTestHarness({ manifest });
    installFakeDb(harness);
    harness.setConfig({ apiKeyRef: "KIE_API_KEY" });
    harness.seed({ issues: [createIssue()] });
    let createCount = 0;
    let commentCount = 0;
    harness.ctx.issues.createComment = async (issueId, body, companyId) => {
      commentCount += 1;
      return comment(`comment-${commentCount}`, issueId, companyId, body);
    };
    harness.ctx.http.fetch = async (url) => {
      if (url.includes("/chat/credit")) return new Response(JSON.stringify({ data: 100 }), { status: 200 });
      createCount += 1;
      return new Response(JSON.stringify({ data: { taskId: "task-1" } }), { status: 200 });
    };
    await plugin.definition.setup(harness.ctx);
    const input = {
      issueId: "issue-1", requestKey: "hero-v1", prompt: "A paperclip hero image", model: "nano-banana-2", aspectRatio: "1:1",
    };
    await harness.executeTool("generate_image", input, { companyId: "company-1", agentId: "agent-1", runId: "run-1", projectId: "project-1" });
    const duplicate = await harness.executeTool("generate_image", input, { companyId: "company-1", agentId: "agent-1", runId: "run-1", projectId: "project-1" });

    expect(duplicate.error).toBeUndefined();
    expect(createCount).toBe(1);
    expect(commentCount).toBe(1);
  });

  it("enforces the two-image per-run guardrail before the third provider call", async () => {
    const harness = createTestHarness({ manifest });
    installFakeDb(harness);
    harness.setConfig({ apiKeyRef: "KIE_API_KEY" });
    harness.seed({ issues: [createIssue()] });
    harness.ctx.issues.createComment = async (issueId, body, companyId) => comment("comment", issueId, companyId, body);
    harness.ctx.http.fetch = async (url) => {
      if (url.includes("/chat/credit")) return new Response(JSON.stringify({ data: 100 }), { status: 200 });
      return new Response(JSON.stringify({ data: { taskId: `task-${Date.now()}` } }), { status: 200 });
    };
    await plugin.definition.setup(harness.ctx);
    const base = { issueId: "issue-1", prompt: "A paperclip hero image", model: "nano-banana-2", aspectRatio: "1:1" };
    await harness.executeTool("generate_image", { ...base, requestKey: "one" }, { companyId: "company-1", agentId: "agent-1", runId: "run-1", projectId: "project-1" });
    await harness.executeTool("generate_image", { ...base, requestKey: "two" }, { companyId: "company-1", agentId: "agent-1", runId: "run-1", projectId: "project-1" });
    const third = await harness.executeTool("generate_image", { ...base, requestKey: "three" }, { companyId: "company-1", agentId: "agent-1", runId: "run-1", projectId: "project-1" });

    expect(third.error).toContain("2-image limit");
  });

  it("accepts a signed callback and emits terminal notification exactly once", async () => {
    const harness = createTestHarness({ manifest });
    const rows = installFakeDb(harness);
    harness.setConfig({
      apiKeyRef: "KIE_API_KEY",
      webhookHmacKeyRef: "KIE_WEBHOOK_SECRET",
      publicBaseUrl: "https://paperclip.example",
    });
    harness.seed({ issues: [{ ...createIssue(), status: "in_progress", assigneeAgentId: "agent-1" } as SeedIssue] });
    const comments: IssueComment[] = [];
    const wakeups: Array<Record<string, unknown> | undefined> = [];
    harness.ctx.issues.createComment = async (issueId, body, companyId) => {
      const value = comment(`comment-${comments.length + 1}`, issueId, companyId, body);
      comments.push(value);
      return value;
    };
    harness.ctx.issues.requestWakeup = async (_issueId, _companyId, options) => {
      wakeups.push(options as Record<string, unknown> | undefined);
      return { queued: true, runId: "wakeup-1" };
    };
    harness.ctx.http.fetch = async (url) => {
      if (url.includes("/chat/credit")) return new Response(JSON.stringify({ data: 100 }), { status: 200 });
      if (url.includes("/recordInfo")) {
        return new Response(JSON.stringify({
          data: {
            state: "success",
            resultJson: JSON.stringify({ resultUrls: ["https://cdn.example/hero.png"] }),
            cost: 4,
          },
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: { taskId: "task-1" } }), { status: 200 });
    };
    await plugin.definition.setup(harness.ctx);

    await harness.executeTool("generate_image", {
      issueId: "issue-1",
      requestKey: "hero-v1",
      prompt: "A paperclip hero image",
      model: "nano-banana-2",
      aspectRatio: "1:1",
    }, { companyId: "company-1", agentId: "agent-1", runId: "run-1", projectId: "project-1" });

    const rawBody = JSON.stringify({ taskId: "task-1", state: "success" });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", "resolved:KIE_WEBHOOK_SECRET")
      .update(`task-1.${timestamp}`)
      .digest("base64");
    const webhook = {
      endpointKey: "kie-callback",
      companyId: "company-1",
      headers: { "X-Webhook-Timestamp": timestamp, "X-Webhook-Signature": signature },
      rawBody,
      parsedBody: { taskId: "task-1", state: "success" },
      requestId: "webhook-1",
    };
    await plugin.definition.onWebhook?.(webhook);
    await plugin.definition.onWebhook?.(webhook);

    expect(comments).toHaveLength(2);
    expect(comments[1]?.body).toContain("Use the Kie image skill");
    expect([...rows.values()][0]?.status).toBe("success");
    expect([...rows.values()][0]?.result_urls).toContain("https://cdn.example/hero.png");
    expect(wakeups).toHaveLength(1);
    expect(wakeups[0]).toMatchObject({
      contextSource: "paperclip.kie-image",
      actorAgentId: "agent-1",
    });
  });
});
