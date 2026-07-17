import type { PluginContext } from "@paperclipai/plugin-sdk";
import {
  ACTIVE_GENERATION_STATUSES,
  GENERATION_STATUSES,
  type GenerationRecord,
  type GenerationStatus,
  type KieAspectRatio,
  type KieModel,
  type KieOutputFormat,
  type KieResolution,
  type NormalizedGenerationInput,
} from "./contracts.js";

type GenerationRow = {
  id: string;
  company_id: string;
  issue_id: string;
  agent_id: string;
  run_id: string;
  request_key: string;
  model: string;
  prompt: string;
  purpose: string | null;
  aspect_ratio: string;
  resolution: string | null;
  output_format: string | null;
  status: string;
  task_id: string | null;
  result_urls: unknown;
  estimated_cost_cents: number | string;
  credit_balance: number | string | null;
  actual_cost_cents: number | string | null;
  preflight_comment_id: string | null;
  submitted_at: string | Date | null;
  completed_at: string | Date | null;
  callback_received_at: string | Date | null;
  last_polled_at: string | Date | null;
  terminal_comment_sent_at: string | Date | null;
  wakeup_sent_at: string | Date | null;
  attempt_count: number | string;
  failure_code: string | null;
  failure_message: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

export type GenerationStore = ReturnType<typeof createGenerationStore>;

const TERMINAL_STATUSES: readonly GenerationStatus[] = ["success", "fail", "timeout"];

export function createGenerationStore(ctx: PluginContext) {
  const table = tableName(ctx.db.namespace, "kie_image_generations");

  async function getById(companyId: string, generationId: string): Promise<GenerationRecord | null> {
    const rows = await ctx.db.query<GenerationRow>(
      `SELECT * FROM ${table} WHERE company_id = $1 AND id = $2 LIMIT 1`,
      [companyId, generationId],
    );
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async function getByRequestKey(companyId: string, requestKey: string): Promise<GenerationRecord | null> {
    const rows = await ctx.db.query<GenerationRow>(
      `SELECT * FROM ${table} WHERE company_id = $1 AND request_key = $2 LIMIT 1`,
      [companyId, requestKey],
    );
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async function listByTaskId(taskId: string): Promise<GenerationRecord[]> {
    const rows = await ctx.db.query<GenerationRow>(
      `SELECT * FROM ${table} WHERE task_id = $1 ORDER BY created_at ASC LIMIT 50`,
      [taskId],
    );
    return rows.map(toRecord);
  }

  async function insertPreflight(input: {
    id: string;
    companyId: string;
    agentId: string;
    runId: string;
    generation: NormalizedGenerationInput;
    estimatedCostCents: number;
    creditBalance: number | null;
  }): Promise<{ record: GenerationRecord; created: boolean }> {
    const result = await ctx.db.execute(
      `INSERT INTO ${table}
        (id, company_id, issue_id, agent_id, run_id, request_key, model, prompt, purpose,
         aspect_ratio, resolution, output_format, status, estimated_cost_cents, credit_balance)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'preflight', $13, $14)
       ON CONFLICT (company_id, request_key) DO NOTHING`,
      [
        input.id,
        input.companyId,
        input.generation.issueId,
        input.agentId,
        input.runId,
        input.generation.requestKey,
        input.generation.model,
        input.generation.prompt,
        input.generation.purpose ?? null,
        input.generation.aspectRatio,
        input.generation.resolution ?? null,
        input.generation.outputFormat ?? null,
        input.estimatedCostCents,
        input.creditBalance,
      ],
    );
    const record = await getByRequestKey(input.companyId, input.generation.requestKey);
    if (!record) throw new Error("Generation record was not available after insert");
    return { record, created: result.rowCount === 1 };
  }

  async function countForRun(companyId: string, runId: string): Promise<number> {
    const rows = await ctx.db.query<{ count: number | string }>(
      `SELECT count(*)::int AS count FROM ${table} WHERE company_id = $1 AND run_id = $2`,
      [companyId, runId],
    );
    return numeric(rows[0]?.count);
  }

  async function sumEstimatedCostForRun(companyId: string, runId: string): Promise<number> {
    const rows = await ctx.db.query<{ total: number | string }>(
      `SELECT COALESCE(sum(estimated_cost_cents), 0)::int AS total FROM ${table} WHERE company_id = $1 AND run_id = $2`,
      [companyId, runId],
    );
    return numeric(rows[0]?.total);
  }

  async function countActive(companyId: string): Promise<number> {
    const statuses = ACTIVE_GENERATION_STATUSES.map((status) => `'${status}'`).join(", ");
    const rows = await ctx.db.query<{ count: number | string }>(
      `SELECT count(*)::int AS count FROM ${table} WHERE company_id = $1 AND status IN (${statuses})`,
      [companyId],
    );
    return numeric(rows[0]?.count);
  }

  async function setPreflightCommentId(companyId: string, id: string, commentId: string): Promise<void> {
    await ctx.db.execute(
      `UPDATE ${table} SET preflight_comment_id = $3, updated_at = now() WHERE company_id = $1 AND id = $2`,
      [companyId, id, commentId],
    );
  }

  async function markSubmitted(companyId: string, id: string, taskId: string): Promise<GenerationRecord | null> {
    await ctx.db.execute(
      `UPDATE ${table}
       SET task_id = $3, status = 'waiting', submitted_at = now(), attempt_count = attempt_count + 1, updated_at = now()
       WHERE company_id = $1 AND id = $2 AND status = 'preflight'`,
      [companyId, id, taskId],
    );
    return getById(companyId, id);
  }

  async function markFailure(companyId: string, id: string, code: string, message: string): Promise<GenerationRecord | null> {
    await ctx.db.execute(
      `UPDATE ${table}
       SET status = 'fail', failure_code = $3, failure_message = $4, completed_at = now(), updated_at = now()
       WHERE company_id = $1 AND id = $2 AND status NOT IN ('success', 'fail', 'timeout')`,
      [companyId, id, code, safeFailureMessage(message)],
    );
    return getById(companyId, id);
  }

  async function applyProviderStatus(input: {
    companyId: string;
    id: string;
    status: GenerationStatus;
    resultUrls: string[];
    actualCostCents: number | null;
    failureCode: string | null;
    failureMessage: string | null;
    source: "callback" | "poll";
  }): Promise<GenerationRecord | null> {
    const terminal = TERMINAL_STATUSES.includes(input.status);
    const statusTimestamp = input.source === "callback" ? "callback_received_at" : "last_polled_at";
    const completed = terminal ? ", completed_at = now()" : "";
    await ctx.db.execute(
      `UPDATE ${table}
       SET status = $3,
           result_urls = $4::jsonb,
           actual_cost_cents = $5,
           failure_code = $6,
           failure_message = $7,
           ${statusTimestamp} = now()${completed},
           updated_at = now()
       WHERE company_id = $1 AND id = $2`,
      [
        input.companyId,
        input.id,
        input.status,
        JSON.stringify(input.resultUrls.slice(0, 8)),
        input.actualCostCents,
        input.failureCode,
        input.failureMessage ? safeFailureMessage(input.failureMessage) : null,
      ],
    );
    return getById(input.companyId, input.id);
  }

  async function listActive(companyId: string, limit: number): Promise<GenerationRecord[]> {
    const rows = await ctx.db.query<GenerationRow>(
      `SELECT * FROM ${table}
       WHERE company_id = $1 AND status IN ('preflight', 'waiting', 'queuing', 'generating')
       ORDER BY created_at ASC LIMIT $2`,
      [companyId, Math.min(Math.max(Math.trunc(limit), 1), 50)],
    );
    return rows.map(toRecord);
  }

  async function list(input: { companyId: string; issueId?: string; status?: GenerationStatus; limit: number }): Promise<GenerationRecord[]> {
    const clauses = ["company_id = $1"];
    const params: unknown[] = [input.companyId];
    if (input.issueId) {
      params.push(input.issueId);
      clauses.push(`issue_id = $${params.length}`);
    }
    if (input.status) {
      params.push(input.status);
      clauses.push(`status = $${params.length}`);
    }
    params.push(Math.min(Math.max(Math.trunc(input.limit), 1), 50));
    const rows = await ctx.db.query<GenerationRow>(
      `SELECT * FROM ${table} WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT $${params.length}`,
      params,
    );
    return rows.map(toRecord);
  }

  async function claimTerminalNotification(companyId: string, id: string, kind: "comment" | "wakeup"): Promise<boolean> {
    const column = kind === "comment" ? "terminal_comment_sent_at" : "wakeup_sent_at";
    const result = await ctx.db.execute(
      `UPDATE ${table} SET ${column} = now(), updated_at = now()
       WHERE company_id = $1 AND id = $2 AND status IN ('success', 'fail', 'timeout') AND ${column} IS NULL`,
      [companyId, id],
    );
    return result.rowCount === 1;
  }

  return {
    getById,
    getByRequestKey,
    listByTaskId,
    insertPreflight,
    countForRun,
    sumEstimatedCostForRun,
    countActive,
    setPreflightCommentId,
    markSubmitted,
    markFailure,
    applyProviderStatus,
    listActive,
    list,
    claimTerminalNotification,
  };
}

function tableName(namespace: string, table: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(namespace) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) {
    throw new Error("Unsafe plugin database identifier");
  }
  return `"${namespace}"."${table}"`;
}

function numeric(value: number | string | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIso(value: string | Date | null): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseResultUrls(value: unknown): string[] {
  let candidate: unknown = value;
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      candidate = [];
    }
  }
  if (!Array.isArray(candidate)) return [];
  return candidate.filter((entry): entry is string => typeof entry === "string" && /^https?:\/\//i.test(entry)).slice(0, 8);
}

function toRecord(row: GenerationRow): GenerationRecord {
  const status = GENERATION_STATUSES.includes(row.status as GenerationStatus) ? row.status as GenerationStatus : "fail";
  return {
    id: row.id,
    companyId: row.company_id,
    issueId: row.issue_id,
    agentId: row.agent_id,
    runId: row.run_id,
    requestKey: row.request_key,
    model: row.model as KieModel,
    prompt: row.prompt,
    purpose: row.purpose,
    aspectRatio: row.aspect_ratio as KieAspectRatio,
    resolution: row.resolution as KieResolution | null,
    outputFormat: row.output_format as KieOutputFormat | null,
    status,
    taskId: row.task_id,
    resultUrls: parseResultUrls(row.result_urls),
    estimatedCostCents: numeric(row.estimated_cost_cents),
    creditBalance: row.credit_balance == null ? null : numeric(row.credit_balance),
    actualCostCents: row.actual_cost_cents == null ? null : numeric(row.actual_cost_cents),
    preflightCommentId: row.preflight_comment_id,
    submittedAt: toIso(row.submitted_at),
    completedAt: toIso(row.completed_at),
    callbackReceivedAt: toIso(row.callback_received_at),
    lastPolledAt: toIso(row.last_polled_at),
    terminalCommentSentAt: toIso(row.terminal_comment_sent_at),
    wakeupSentAt: toIso(row.wakeup_sent_at),
    attemptCount: numeric(row.attempt_count),
    failureCode: row.failure_code,
    failureMessage: row.failure_message,
    createdAt: toIso(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function safeFailureMessage(value: string): string {
  return value.replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]").slice(0, 1000);
}
