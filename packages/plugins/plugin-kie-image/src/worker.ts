import {
  definePlugin,
  runWorker,
  type PluginApiRequestInput,
  type PluginContext,
  type ToolRunContext,
} from "@paperclipai/plugin-sdk";
import manifest, { PLUGIN_ID } from "./manifest.js";
import {
  isGenerationStatus,
  type GenerationStatus,
  type PluginConfig,
} from "./contracts.js";
import {
  createGenerationOrchestrator,
  GenerationInputError,
  GenerationNotFoundError,
  GenerationQuotaError,
  type GenerationOrchestrator,
} from "./orchestrator.js";

let activeOrchestrator: GenerationOrchestrator | null = null;
let activeContext: PluginContext | null = null;

const plugin = definePlugin({
  async setup(ctx) {
    activeContext = ctx;
    const orchestrator = createGenerationOrchestrator(ctx);
    activeOrchestrator = orchestrator;

    const findTool = (name: string) => manifest.tools?.find((tool: { name: string }) => tool.name === name);
    const generateDeclaration = findTool("generate_image");
    const getDeclaration = findTool("get_generation");
    const listDeclaration = findTool("list_generations");
    if (!generateDeclaration || !getDeclaration || !listDeclaration) throw new Error("Kie image tool declarations are incomplete");

    ctx.tools.register("generate_image", generateDeclaration, async (params, runCtx) => orchestrator.toolGenerate(params, toolRunContext(runCtx)));
    ctx.tools.register("get_generation", getDeclaration, async (params, runCtx) => orchestrator.toolGet(params, toolRunContext(runCtx)));
    ctx.tools.register("list_generations", listDeclaration, async (params, runCtx) => orchestrator.toolList(params, toolRunContext(runCtx)));

    ctx.jobs.register("reconcile-generations", async (job) => {
      if (!job.companyId) {
        throw new GenerationInputError("Company-scoped configuration is required for reconciliation");
      }
      await orchestrator.reconcile(job.companyId);
    });

    ctx.data.register("kie-history", async (params) => {
      const companyId = stringValue(params.companyId);
      if (!companyId) throw new GenerationInputError("companyId is required");
      const records = await orchestrator.list({
        companyId,
        issueId: stringValue(params.issueId) ?? undefined,
        status: params.status,
        limit: params.limit,
      });
      return { generations: records.map(toHistoryRecord) };
    });

    ctx.data.register("kie-settings", async () => {
      const config = await ctx.config.get();
      return {
        apiKeyConfigured: Boolean(stringValue(config.apiKeyRef)),
        webhookHmacConfigured: Boolean(stringValue(config.webhookHmacKeyRef)),
        publicBaseUrl: stringValue(config.publicBaseUrl),
        pollIntervalSeconds: numberOrDefault(config.pollIntervalSeconds, 60),
        timeoutMinutes: numberOrDefault(config.timeoutMinutes, 15),
        guardrails: {
          maxImagesPerRun: 2,
          maxActivePerCompany: 3,
          maxEstimatedSpendCentsPerRun: 20,
        },
      };
    });
  },

  async onWebhook(input) {
    if (input.endpointKey !== "kie-callback") throw new GenerationInputError("Unknown Kie webhook endpoint");
    if (!input.companyId) throw new GenerationInputError("Company-scoped webhook is required");
    const orchestrator = requireOrchestrator();
    await orchestrator.handleCallback(input.rawBody, input.headers, input.companyId);
  },

  async onApiRequest(input: PluginApiRequestInput) {
    const orchestrator = requireOrchestrator();
    const companyId = input.companyId;
    const body = asRecord(input.body);
    try {
      if (input.routeKey === "generate") {
        const run = apiRunContext(input, companyId);
        const result = await orchestrator.generate({ ...body, companyId }, run);
        return { status: 200, body: { ...toHistoryRecord(result.generation), created: result.created, estimate: result.estimate } };
      }
      if (input.routeKey === "get-generation") {
        const generationId = input.params.generationId;
        const record = await orchestrator.get(generationId, apiRunContext(input, companyId), parseBoolean(input.query.refresh));
        return { status: 200, body: toHistoryRecord(record) };
      }
      if (input.routeKey === "list-generations") {
        const recordStatus = firstQuery(input.query.status);
        const records = await orchestrator.list({
          companyId,
          issueId: firstQuery(input.query.issueId) ?? undefined,
          status: recordStatus,
          limit: firstQuery(input.query.limit),
        });
        return { status: 200, body: { generations: records.map(toHistoryRecord) } };
      }
      return { status: 404, body: { error: "Unknown Kie image route" } };
    } catch (error) {
      return { status: errorStatus(error), body: { error: errorMessage(error), code: errorCode(error) } };
    }
  },

  async onValidateConfig(config) {
    const errors: string[] = [];
    // `validateConfig` is the instance-config RPC. The Kie credential lives in
    // the company-scoped config and is therefore intentionally absent here.
    // When a company config is passed by a future scoped validator, validate
    // the reference if present without making the instance defaults unusable.
    if (Object.prototype.hasOwnProperty.call(config, "apiKeyRef") && !stringValue(config.apiKeyRef)) {
      errors.push("apiKeyRef must be a Paperclip secret reference");
    }
    if (Object.prototype.hasOwnProperty.call(config, "apiKey")) errors.push("raw apiKey is not accepted; use apiKeyRef");
    if (config.publicBaseUrl != null && !isHttpUrl(config.publicBaseUrl)) errors.push("publicBaseUrl must be an http(s) URL");
    return errors.length > 0 ? { ok: false, errors } : { ok: true };
  },

  async onHealth() {
    const config: Record<string, unknown> = activeContext ? await activeContext.config.get() : {};
    return stringValue(config.apiKeyRef)
      ? { status: "ok", message: "Kie image generation ready" }
      : { status: "degraded", message: "Configure apiKeyRef in the host-managed plugin settings form" };
  },
});

export default plugin;

export function getActiveOrchestrator(): GenerationOrchestrator | null {
  return activeOrchestrator;
}

runWorker(plugin, import.meta.url);

function requireOrchestrator(): GenerationOrchestrator {
  if (!activeOrchestrator) throw new Error("Kie image plugin has not been set up");
  return activeOrchestrator;
}

function toolRunContext(runCtx: ToolRunContext) {
  return {
    companyId: runCtx.companyId,
    agentId: runCtx.agentId,
    runId: runCtx.runId,
    projectId: runCtx.projectId,
  };
}

function apiRunContext(input: PluginApiRequestInput, companyId: string) {
  if (!input.actor.agentId || !input.actor.runId) throw new GenerationInputError("Agent run context is required");
  return {
    companyId,
    agentId: input.actor.agentId,
    runId: input.actor.runId,
    projectId: stringValue(asRecord(input.body).projectId) ?? undefined,
  };
}

function toHistoryRecord(record: {
  id: string;
  companyId: string;
  issueId: string;
  agentId: string;
  runId: string;
  requestKey: string;
  model: string;
  prompt: string;
  purpose: string | null;
  aspectRatio: string;
  resolution: string | null;
  outputFormat: string | null;
  status: GenerationStatus;
  taskId: string | null;
  resultUrls: string[];
  estimatedCostCents: number;
  creditBalance: number | null;
  actualCostCents: number | null;
  preflightCommentId: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  callbackReceivedAt: string | null;
  lastPolledAt: string | null;
  attemptCount: number;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    generationId: record.id,
    companyId: record.companyId,
    issueId: record.issueId,
    agentId: record.agentId,
    runId: record.runId,
    requestKey: record.requestKey,
    model: record.model,
    prompt: record.prompt,
    purpose: record.purpose,
    aspectRatio: record.aspectRatio,
    resolution: record.resolution,
    outputFormat: record.outputFormat,
    status: record.status,
    taskId: record.taskId,
    resultUrls: record.resultUrls,
    estimatedCostCents: record.estimatedCostCents,
    creditBalance: record.creditBalance,
    actualCostCents: record.actualCostCents,
    preflightCommentId: record.preflightCommentId,
    submittedAt: record.submittedAt,
    completedAt: record.completedAt,
    callbackReceivedAt: record.callbackReceivedAt,
    lastPolledAt: record.lastPolledAt,
    attemptCount: record.attemptCount,
    failureCode: record.failureCode,
    failureMessage: record.failureMessage,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberOrDefault(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function firstQuery(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseBoolean(value: string | string[] | undefined): boolean {
  const normalized = firstQuery(value)?.toLowerCase();
  return normalized === "1" || normalized === "true";
}

function isHttpUrl(value: unknown): boolean {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function errorStatus(error: unknown): number {
  if (error instanceof GenerationInputError) return error.status;
  if (error instanceof GenerationNotFoundError) return error.status;
  if (error instanceof GenerationQuotaError) return error.status;
  return 500;
}

function errorCode(error: unknown): string {
  if (error instanceof GenerationInputError) return error.code;
  if (error instanceof GenerationNotFoundError) return error.code;
  if (error instanceof GenerationQuotaError) return error.code;
  return "generation_failed";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]").slice(0, 1000) : "Kie image request failed";
}
