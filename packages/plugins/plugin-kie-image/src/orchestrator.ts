import { randomUUID } from "node:crypto";
import type { PluginContext, ToolResult } from "@paperclipai/plugin-sdk";
import {
  DEFAULT_POLL_INTERVAL_SECONDS,
  GENERATION_TIMEOUT_MINUTES,
  MAX_ACTIVE_PER_COMPANY,
  MAX_ESTIMATED_SPEND_CENTS_PER_RUN,
  MAX_IMAGES_PER_RUN,
  normalizeGenerationInput,
  type CostEstimate,
  type GenerationInput,
  type GenerationRecord,
  type GenerationStatus,
  isGenerationStatus,
  type PluginConfig,
  type ProviderStatus,
} from "./contracts.js";
import { createKieClient, KieApiError } from "./kie-client.js";
import { createGenerationStore } from "./store.js";

export type GenerationRunContext = {
  companyId: string;
  agentId: string;
  runId: string;
  projectId?: string;
};

export class GenerationInputError extends Error {
  readonly status = 400;
  readonly code = "invalid_input";
}

export class GenerationNotFoundError extends Error {
  readonly status = 404;
  readonly code = "not_found";
}

export class GenerationQuotaError extends Error {
  readonly status = 409;
  readonly code = "guardrail_exceeded";
}

export type GenerationOrchestrator = ReturnType<typeof createGenerationOrchestrator>;

export function createGenerationOrchestrator(ctx: PluginContext) {
  const store = createGenerationStore(ctx);
  const kie = createKieClient(ctx);

  async function generate(rawInput: unknown, run: GenerationRunContext): Promise<{
    generation: GenerationRecord;
    estimate: CostEstimate;
    created: boolean;
  }> {
    let input;
    try {
      input = normalizeGenerationInput(rawInput);
    } catch (error) {
      throw new GenerationInputError(error instanceof Error ? error.message : "Invalid generation input");
    }
    const issue = await ctx.issues.get(input.issueId, run.companyId);
    if (!issue) throw new GenerationNotFoundError("Issue is not in the current company");

    const existing = await store.getByRequestKey(run.companyId, input.requestKey);
    if (existing) {
      return {
        generation: existing,
        estimate: {
          estimatedCostCents: existing.estimatedCostCents,
          currency: "USD",
          creditBalance: existing.creditBalance,
          basis: existing.creditBalance === null ? "unknown" : "snapshot",
        },
        created: false,
      };
    }

    const runCount = await store.countForRun(run.companyId, run.runId);
    if (runCount >= MAX_IMAGES_PER_RUN) {
      throw new GenerationQuotaError(`This agent run has reached the ${MAX_IMAGES_PER_RUN}-image limit`);
    }
    const activeCount = await store.countActive(run.companyId);
    if (activeCount >= MAX_ACTIVE_PER_COMPANY) {
      throw new GenerationQuotaError(`This company has reached the ${MAX_ACTIVE_PER_COMPANY}-generation concurrency limit`);
    }

    const config = await readConfig(ctx);
    const estimate = await kie.getCreditEstimate(config, input);
    const currentSpend = await store.sumEstimatedCostForRun(run.companyId, run.runId);
    if (currentSpend + estimate.estimatedCostCents > MAX_ESTIMATED_SPEND_CENTS_PER_RUN) {
      throw new GenerationQuotaError(`Estimated spend would exceed the $${(MAX_ESTIMATED_SPEND_CENTS_PER_RUN / 100).toFixed(2)} per-run limit`);
    }

    const inserted = await store.insertPreflight({
      id: randomUUID(),
      companyId: run.companyId,
      agentId: run.agentId,
      runId: run.runId,
      generation: input,
      estimatedCostCents: estimate.estimatedCostCents,
      creditBalance: estimate.creditBalance,
    });
    if (!inserted.created) {
      return { generation: inserted.record, estimate, created: false };
    }

    let preflightComment;
    try {
      preflightComment = await ctx.issues.createComment(
        input.issueId,
        preflightCommentBody(inserted.record, estimate),
        run.companyId,
        { authorAgentId: run.agentId },
      );
      await store.setPreflightCommentId(run.companyId, inserted.record.id, preflightComment.id);
    } catch (error) {
      await store.markFailure(run.companyId, inserted.record.id, "preflight_comment_failed", errorMessage(error));
      throw error;
    }

    try {
      const callbackUrl = buildCallbackUrl(config, run.companyId);
      const task = await kie.createTask(config, input, callbackUrl);
      const submitted = await store.markSubmitted(run.companyId, inserted.record.id, task.taskId);
      if (!submitted) throw new Error("Generation disappeared while submitting");
      await ctx.activity.log({
        companyId: run.companyId,
        message: "Kie image generation submitted",
        entityType: "kie_image_generation",
        entityId: submitted.id,
        metadata: { model: submitted.model, taskId: submitted.taskId, issueId: submitted.issueId },
      });
      return { generation: submitted, estimate, created: true };
    } catch (error) {
      const failed = await store.markFailure(run.companyId, inserted.record.id, errorCode(error), errorMessage(error));
      if (failed) await notifyTerminal(failed);
      throw error;
    }
  }

  async function get(generationId: string, run: GenerationRunContext, refresh = false): Promise<GenerationRecord> {
    const record = await store.getById(run.companyId, generationId);
    if (!record) throw new GenerationNotFoundError("Generation not found");
    if (!refresh || !record.taskId || isTerminal(record.status)) return record;
    const config = await readConfig(ctx);
    const provider = await kie.getStatus(config, record.taskId);
    const updated = await applyProviderStatus(record, provider, "poll");
    return updated ?? record;
  }

  async function list(input: { companyId: string; issueId?: string; status?: unknown; limit?: unknown }): Promise<GenerationRecord[]> {
    let status: GenerationStatus | undefined;
    if (input.status != null) {
      if (!isGenerationStatus(input.status)) throw new GenerationInputError("status is invalid");
      status = input.status;
    }
    const limit = typeof input.limit === "number" && Number.isFinite(input.limit) ? input.limit : 20;
    return store.list({ companyId: input.companyId, issueId: stringValue(input.issueId) ?? undefined, status, limit });
  }

  async function reconcile(companyId: string): Promise<void> {
    if (!companyId) throw new GenerationInputError("companyId is required for reconciliation");
    const active = await store.listActive(companyId, 50);
      for (const record of active) {
        if (isExpired(record)) {
          const timedOut = await store.applyProviderStatus({
            companyId,
            id: record.id,
            status: "timeout",
            resultUrls: record.resultUrls,
            actualCostCents: record.actualCostCents,
            failureCode: "timeout",
            failureMessage: `Kie task exceeded the ${GENERATION_TIMEOUT_MINUTES}-minute timeout`,
            source: "poll",
          });
          if (timedOut) await notifyTerminal(timedOut);
          continue;
        }
        if (!record.taskId) continue;
        try {
          const provider = await kie.getStatus(await readConfig(ctx), record.taskId);
          await applyProviderStatus(record, provider, "poll");
        } catch (error) {
          ctx.logger.warn("Kie status reconciliation failed", { generationId: record.id, error: errorMessage(error) });
        }
      }
  }

  async function handleCallback(rawBody: string, headers: Record<string, string | string[]>, companyId: string): Promise<void> {
    if (!companyId) throw new GenerationInputError("companyId is required for callback reconciliation");
    const config = await readConfig(ctx);
    if (!(await kie.verifyWebhookSignature(config, rawBody, headers))) {
      throw new GenerationInputError("Invalid or stale Kie webhook signature");
    }
    const taskId = extractTaskId(rawBody);
    if (!taskId) throw new GenerationInputError("Kie webhook did not include a task id");
    for (const record of (await store.listByTaskId(taskId)).filter((item) => item.companyId === companyId)) {
      const provider = await kie.getStatus(config, taskId);
      await applyProviderStatus(record, provider, "callback");
    }
  }

  async function applyProviderStatus(record: GenerationRecord, provider: ProviderStatus, source: "callback" | "poll"): Promise<GenerationRecord | null> {
    const status = provider.status;
    const updated = await store.applyProviderStatus({
      companyId: record.companyId,
      id: record.id,
      status,
      resultUrls: provider.resultUrls,
      actualCostCents: provider.actualCostCents,
      failureCode: provider.failureCode,
      failureMessage: provider.failureMessage,
      source,
    });
    if (updated && isTerminal(updated.status)) await notifyTerminal(updated);
    return updated;
  }

  async function notifyTerminal(record: GenerationRecord): Promise<void> {
    if (await store.claimTerminalNotification(record.companyId, record.id, "comment")) {
      try {
        await ctx.issues.createComment(record.issueId, terminalCommentBody(record), record.companyId, { authorAgentId: record.agentId });
      } catch (error) {
        ctx.logger.error("Unable to post Kie terminal comment", { generationId: record.id, error: errorMessage(error) });
      }
    }
    if (await store.claimTerminalNotification(record.companyId, record.id, "wakeup")) {
      try {
        await ctx.issues.requestWakeup(record.issueId, record.companyId, {
          reason: `Kie image generation ${record.status}`,
          contextSource: "paperclip.kie-image",
          idempotencyKey: `paperclip.kie-image:wakeup:${record.id}`,
          actorAgentId: record.agentId,
        });
      } catch (error) {
        ctx.logger.error("Unable to wake issue after Kie generation", { generationId: record.id, error: errorMessage(error) });
      }
    }
    await ctx.activity.log({
      companyId: record.companyId,
      message: `Kie image generation ${record.status}`,
      entityType: "kie_image_generation",
      entityId: record.id,
      metadata: { model: record.model, taskId: record.taskId, status: record.status },
    });
  }

  async function toolGenerate(input: unknown, run: GenerationRunContext): Promise<ToolResult> {
    try {
      const result = await generate(input, run);
      return {
        content: result.created ? "Kie image generation submitted after preflight reporting." : "Existing Kie image generation returned for this request key.",
        data: toToolData(result.generation, result.estimate),
      };
    } catch (error) {
      return { error: errorMessage(error), data: { code: errorCode(error) } };
    }
  }

  async function toolGet(input: unknown, run: GenerationRunContext): Promise<ToolResult> {
    const params = asRecord(input);
    try {
      const record = await get(stringValue(params.generationId) ?? "", run, params.refresh === true);
      return { content: `Kie generation ${record.status}`, data: toToolData(record, null) };
    } catch (error) {
      return { error: errorMessage(error), data: { code: errorCode(error) } };
    }
  }

  async function toolList(input: unknown, run: GenerationRunContext): Promise<ToolResult> {
    const params = asRecord(input);
    try {
      const records = await list({ companyId: run.companyId, issueId: stringValue(params.issueId) ?? undefined, status: params.status, limit: params.limit });
      return { content: `${records.length} Kie generation(s)`, data: records.map((record) => toToolData(record, null)) };
    } catch (error) {
      return { error: errorMessage(error), data: { code: errorCode(error) } };
    }
  }

  return { generate, get, list, reconcile, handleCallback, toolGenerate, toolGet, toolList };
}

async function readConfig(ctx: PluginContext): Promise<PluginConfig> {
  const config = await ctx.config.get();
  const apiKeyRef = stringValue(config.apiKeyRef);
  if (!apiKeyRef) throw new GenerationInputError("KieAPI secret reference is not configured");
  const pollIntervalSeconds = boundedInteger(config.pollIntervalSeconds, DEFAULT_POLL_INTERVAL_SECONDS, 15, 300);
  const timeoutMinutes = boundedInteger(config.timeoutMinutes, GENERATION_TIMEOUT_MINUTES, 5, 60);
  return {
    apiKeyRef,
    webhookHmacKeyRef: stringValue(config.webhookHmacKeyRef) ?? undefined,
    publicBaseUrl: stringValue(config.publicBaseUrl) ?? undefined,
    pollIntervalSeconds,
    timeoutMinutes,
  };
}

function buildCallbackUrl(config: PluginConfig, companyId: string): string | undefined {
  if (!config.publicBaseUrl || !config.webhookHmacKeyRef) return undefined;
  return `${config.publicBaseUrl.replace(/\/$/, "")}/api/plugins/paperclip.kie-image/companies/${encodeURIComponent(companyId)}/webhooks/kie-callback`;
}

function preflightCommentBody(record: GenerationRecord, estimate: CostEstimate): string {
  return [
    "### Kie image preflight (autonomous)",
    `- Generation: \`${record.id}\``,
    `- Model: \`${record.model}\``,
    `- Purpose: ${record.purpose ?? "Not specified"}`,
    `- Prompt: ${record.prompt}`,
    `- Settings: ${record.aspectRatio}${record.resolution ? ` · ${record.resolution}` : ""}${record.outputFormat ? ` · ${record.outputFormat}` : ""}`,
    `- Estimate: $${(estimate.estimatedCostCents / 100).toFixed(2)} USD${estimate.creditBalance == null ? " (best-effort balance unavailable)" : ` · account balance ${estimate.creditBalance} credits`}`,
    "- Action: submitting immediately; no confirmation step is required.",
  ].join("\n");
}

function terminalCommentBody(record: GenerationRecord): string {
  if (record.status === "success") {
    return [
      "### Kie image generation complete",
      `- Generation: \`${record.id}\``,
      `- Model: \`${record.model}\``,
      `- Images: ${record.resultUrls.length}`,
      `- Cost: ${record.actualCostCents == null ? "provider did not report a cost" : `$${(record.actualCostCents / 100).toFixed(2)} USD`}`,
      "Use the Kie image skill to download the temporary result URL(s) and persist durable Paperclip attachments/artifacts before reporting completion.",
    ].join("\n");
  }
  return [
    "### Kie image generation failed",
    `- Generation: \`${record.id}\``,
    `- Status: \`${record.status}\``,
    `- Reason: ${record.failureMessage ?? "The provider did not return a reason."}`,
  ].join("\n");
}

function toToolData(record: GenerationRecord, estimate: CostEstimate | null): Record<string, unknown> {
  return {
    generationId: record.id,
    taskId: record.taskId,
    status: record.status,
    issueId: record.issueId,
    model: record.model,
    prompt: record.prompt,
    purpose: record.purpose,
    aspectRatio: record.aspectRatio,
    resolution: record.resolution,
    outputFormat: record.outputFormat,
    resultUrls: record.resultUrls.slice(0, 8),
    estimatedCostCents: record.estimatedCostCents,
    actualCostCents: record.actualCostCents,
    creditBalance: record.creditBalance,
    estimate,
    failureCode: record.failureCode,
    failureMessage: record.failureMessage,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function isTerminal(status: GenerationStatus): boolean {
  return status === "success" || status === "fail" || status === "timeout";
}

function isExpired(record: GenerationRecord): boolean {
  const start = record.submittedAt ?? record.createdAt;
  return Date.now() - new Date(start).getTime() > GENERATION_TIMEOUT_MINUTES * 60 * 1000;
}

function extractTaskId(rawBody: string): string | null {
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    const record = asRecord(parsed);
    const data = asRecord(record.data);
    return stringValue(record.taskId) ?? stringValue(data.taskId);
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.trunc(parsed))) : fallback;
}

function errorCode(error: unknown): string {
  if (error instanceof KieApiError) return error.code;
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") return error.code;
  return "generation_failed";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]").slice(0, 1000);
  return "Kie image generation failed";
}
