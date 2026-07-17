import { createHmac, timingSafeEqual } from "node:crypto";
import type { PluginContext } from "@paperclipai/plugin-sdk";
import {
  KIE_API_BASE_URL,
  type CostEstimate,
  estimateCostCents,
  type NormalizedGenerationInput,
  type PluginConfig,
  type ProviderStatus,
  toKieInput,
} from "./contracts.js";

export class KieApiError extends Error {
  readonly status: number | null;
  readonly code: string;
  readonly retryable: boolean;

  constructor(message: string, options: { status?: number | null; code?: string; retryable?: boolean } = {}) {
    super(message);
    this.name = "KieApiError";
    this.status = options.status ?? null;
    this.code = options.code ?? "kie_api_error";
    this.retryable = options.retryable ?? false;
  }
}

export type KieClient = ReturnType<typeof createKieClient>;

export function createKieClient(ctx: PluginContext) {
  async function createTask(config: PluginConfig, input: NormalizedGenerationInput, callbackUrl?: string): Promise<{ taskId: string }> {
    const body: Record<string, unknown> = {
      model: input.model,
      input: toKieInput(input),
    };
    if (callbackUrl) body.callBackUrl = callbackUrl;
    const payload = await requestJson(ctx, config, "/api/v1/jobs/createTask", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const taskId = readStringAt(payload, ["data", "taskId"]) ?? readStringAt(payload, ["taskId"]);
    if (!taskId) throw new KieApiError("KieAPI did not return a task id", { code: "missing_task_id" });
    return { taskId };
  }

  async function getStatus(config: PluginConfig, taskId: string): Promise<ProviderStatus> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const payload = await requestJson(ctx, config, `/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, { method: "GET" });
        return parseProviderStatus(payload, taskId);
      } catch (error) {
        lastError = error;
        if (!(error instanceof KieApiError) || !error.retryable || attempt === 1) throw error;
        await wait(50 * (attempt + 1));
      }
    }
    throw lastError instanceof Error ? lastError : new KieApiError("Unable to read Kie task status", { retryable: true });
  }

  async function getCreditEstimate(config: PluginConfig, input: NormalizedGenerationInput): Promise<CostEstimate> {
    const estimatedCostCents = estimateCostCents(input);
    try {
      const payload = await requestJson(ctx, config, "/api/v1/chat/credit", { method: "GET" });
      const value = readNumberAt(payload, ["data"]) ?? readNumberAt(payload, ["credit"]);
      return {
        estimatedCostCents,
        currency: "USD",
        creditBalance: value,
        basis: "snapshot",
      };
    } catch {
      return {
        estimatedCostCents,
        currency: "USD",
        creditBalance: null,
        basis: "unknown",
      };
    }
  }

  async function verifyWebhookSignature(config: PluginConfig, rawBody: string, headers: Record<string, string | string[]>): Promise<boolean> {
    if (!config.webhookHmacKeyRef) return false;
    const timestamp = headerValue(headers, "x-webhook-timestamp");
    const signature = headerValue(headers, "x-webhook-signature");
    if (!timestamp || !signature) return false;
    const timestampMs = Number(timestamp) * 1000;
    if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) return false;
    const secret = await ctx.secrets.resolve(config.webhookHmacKeyRef, { configPath: "webhookHmacKeyRef" });
    const expected = createHmac("sha256", secret).update(`${rawBodyTaskId(rawBody)}.${timestamp}`).digest("base64");
    const expectedBytes = Buffer.from(expected);
    const receivedBytes = Buffer.from(signature);
    return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
  }

  return { createTask, getStatus, getCreditEstimate, verifyWebhookSignature };
}

async function requestJson(ctx: PluginContext, config: PluginConfig, path: string, init: RequestInit): Promise<unknown> {
  const apiKeyRef = config.apiKeyRef.trim();
  if (!apiKeyRef) throw new KieApiError("KieAPI secret reference is not configured", { code: "missing_api_key_ref" });
  const apiKey = await ctx.secrets.resolve(apiKeyRef, { configPath: "apiKeyRef" });
  const response = await ctx.http.fetch(`${KIE_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(init.headers ?? {}),
    },
  });
  const body = await readResponseJson(response);
  if (!response.ok) {
    const providerMessage = readStringAt(body, ["msg"]) ?? readStringAt(body, ["message"]);
    throw new KieApiError(providerMessage ?? `KieAPI request failed (${response.status})`, {
      status: response.status,
      code: response.status === 402 ? "insufficient_credits" : response.status === 429 ? "rate_limited" : "http_error",
      retryable: response.status === 429 || response.status === 455 || response.status >= 500,
    });
  }
  return body;
}

async function readResponseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new KieApiError("KieAPI returned invalid JSON", { code: "invalid_json", retryable: false });
  }
}

function parseProviderStatus(payload: unknown, taskId: string): ProviderStatus {
  const data = readRecordAt(payload, ["data"]) ?? (isRecord(payload) ? payload : {});
  const state = readString(data.state) ?? readString(data.status);
  if (!isProviderState(state)) throw new KieApiError("KieAPI returned an unknown task state", { code: "unknown_task_state" });
  const resultJson = data.resultJson ?? data.result_json ?? data.result;
  const resultUrls = parseResultUrls(resultJson);
  const failureMessage = state === "fail"
    ? readString(data.failMsg) ?? readString(data.error) ?? readString(data.message)
    : null;
  return {
    taskId,
    status: state,
    resultUrls,
    actualCostCents: readNumber(data.cost) ?? readNumber(data.costCents) ?? null,
    failureCode: state === "fail" ? readString(data.failCode) ?? "provider_failed" : null,
    failureMessage,
  };
}

function parseResultUrls(value: unknown): string[] {
  let candidate = value;
  const rawString = typeof candidate === "string" ? candidate : null;
  if (rawString !== null) {
    try {
      candidate = JSON.parse(rawString) as unknown;
    } catch {
      candidate = rawString.startsWith("http") ? [rawString] : [];
    }
  }
  if (Array.isArray(candidate)) {
    return candidate.filter(isHttpUrl).slice(0, 8);
  }
  if (isRecord(candidate)) {
    for (const key of ["resultUrls", "result_urls", "urls", "images", "output", "resultImageUrl"]) {
      const nested = candidate[key];
      const urls = parseResultUrls(nested);
      if (urls.length > 0) return urls;
    }
  }
  return [];
}

function rawBodyTaskId(rawBody: string): string {
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (isRecord(parsed)) {
      const taskId = readString(parsed.taskId) ?? readStringAt(parsed, ["data", "taskId"]);
      if (taskId) return taskId;
    }
  } catch {
    // Signature verification will fail when the callback does not carry JSON.
  }
  return "";
}

function headerValue(headers: Record<string, string | string[]>, name: string): string | null {
  const value = headers[name] ?? headers[Object.keys(headers).find((key) => key.toLowerCase() === name) ?? ""];
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" ? value : null;
}

function readStringAt(value: unknown, path: string[]): string | null {
  let current: unknown = value;
  for (const segment of path) {
    if (!isRecord(current)) return null;
    current = current[segment];
  }
  return readString(current);
}

function readNumberAt(value: unknown, path: string[]): number | null {
  let current: unknown = value;
  for (const segment of path) {
    if (!isRecord(current)) return null;
    current = current[segment];
  }
  return readNumber(current);
}

function readRecordAt(value: unknown, path: string[]): Record<string, unknown> | null {
  let current: unknown = value;
  for (const segment of path) {
    if (!isRecord(current)) return null;
    current = current[segment];
  }
  return isRecord(current) ? current : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function isProviderState(value: string | null): value is ProviderStatus["status"] {
  return value === "waiting" || value === "queuing" || value === "generating" || value === "success" || value === "fail";
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
