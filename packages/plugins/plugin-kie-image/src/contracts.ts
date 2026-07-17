export const KIE_API_BASE_URL = "https://api.kie.ai";
export const KIE_CALLBACK_ENDPOINT_KEY = "kie-callback";
export const MAX_IMAGES_PER_RUN = 2;
export const MAX_ACTIVE_PER_COMPANY = 3;
export const MAX_ESTIMATED_SPEND_CENTS_PER_RUN = 20;
export const GENERATION_TIMEOUT_MINUTES = 15;
export const DEFAULT_POLL_INTERVAL_SECONDS = 60;

export const KIE_MODELS = [
  "gpt-image-2-text-to-image",
  "nano-banana-2",
] as const;
export type KieModel = (typeof KIE_MODELS)[number];

export const KIE_ASPECT_RATIOS = [
  "auto",
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
] as const;
export type KieAspectRatio = (typeof KIE_ASPECT_RATIOS)[number];

export const KIE_RESOLUTIONS = ["1K", "2K", "4K"] as const;
export type KieResolution = (typeof KIE_RESOLUTIONS)[number];

export const KIE_OUTPUT_FORMATS = ["png", "jpg", "webp"] as const;
export type KieOutputFormat = (typeof KIE_OUTPUT_FORMATS)[number];

export const GENERATION_STATUSES = [
  "preflight",
  "waiting",
  "queuing",
  "generating",
  "success",
  "fail",
  "timeout",
] as const;
export type GenerationStatus = (typeof GENERATION_STATUSES)[number];

export const ACTIVE_GENERATION_STATUSES: readonly GenerationStatus[] = [
  "preflight",
  "waiting",
  "queuing",
  "generating",
];

export type GenerationInput = {
  issueId: string;
  requestKey: string;
  prompt: string;
  purpose?: string;
  model: KieModel;
  aspectRatio: KieAspectRatio;
  resolution?: KieResolution;
  outputFormat?: KieOutputFormat;
};

export type NormalizedGenerationInput = Required<Pick<GenerationInput, "issueId" | "requestKey" | "prompt" | "model" | "aspectRatio">>
  & Pick<GenerationInput, "purpose" | "resolution" | "outputFormat">;

export type CostEstimate = {
  estimatedCostCents: number;
  currency: "USD";
  creditBalance: number | null;
  basis: "snapshot" | "unknown";
};

export type GenerationRecord = {
  id: string;
  companyId: string;
  issueId: string;
  agentId: string;
  runId: string;
  requestKey: string;
  model: KieModel;
  prompt: string;
  purpose: string | null;
  aspectRatio: KieAspectRatio;
  resolution: KieResolution | null;
  outputFormat: KieOutputFormat | null;
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
  terminalCommentSentAt: string | null;
  wakeupSentAt: string | null;
  attemptCount: number;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProviderStatus = {
  taskId: string;
  status: "waiting" | "queuing" | "generating" | "success" | "fail";
  resultUrls: string[];
  actualCostCents: number | null;
  failureCode: string | null;
  failureMessage: string | null;
};

export type GenerationToolResult = {
  generationId: string;
  taskId: string | null;
  status: GenerationStatus;
  estimate: CostEstimate;
  resultUrls: string[];
  issueId: string;
};

export type HistoryQuery = {
  companyId: string;
  issueId?: string;
  status?: GenerationStatus;
  limit?: number;
};

export type PluginConfig = {
  apiKeyRef: string;
  webhookHmacKeyRef?: string;
  publicBaseUrl?: string;
  pollIntervalSeconds?: number;
  timeoutMinutes?: number;
};

export function isKieModel(value: unknown): value is KieModel {
  return typeof value === "string" && KIE_MODELS.includes(value as KieModel);
}

export function isGenerationStatus(value: unknown): value is GenerationStatus {
  return typeof value === "string" && GENERATION_STATUSES.includes(value as GenerationStatus);
}

export function normalizeGenerationInput(value: unknown): NormalizedGenerationInput {
  if (!value || typeof value !== "object") throw new Error("generation input must be an object");
  const input = value as Record<string, unknown>;
  const issueId = stringField(input.issueId, "issueId", 200);
  const requestKey = stringField(input.requestKey, "requestKey", 200);
  const prompt = stringField(input.prompt, "prompt", 8000);
  const purpose = optionalString(input.purpose, 500);
  const model = input.model;
  if (!isKieModel(model)) throw new Error(`model must be one of: ${KIE_MODELS.join(", ")}`);
  const aspectRatio = input.aspectRatio;
  if (typeof aspectRatio !== "string" || !KIE_ASPECT_RATIOS.includes(aspectRatio as KieAspectRatio)) {
    throw new Error(`aspectRatio must be one of: ${KIE_ASPECT_RATIOS.join(", ")}`);
  }
  const resolution = optionalEnum(input.resolution, KIE_RESOLUTIONS, "resolution");
  const outputFormat = optionalEnum(input.outputFormat, KIE_OUTPUT_FORMATS, "outputFormat");
  return { issueId, requestKey, prompt, purpose, model, aspectRatio: aspectRatio as KieAspectRatio, resolution, outputFormat };
}

export function estimateCostCents(input: Pick<NormalizedGenerationInput, "model" | "resolution">): number {
  const resolution = input.resolution ?? "1K";
  const table: Record<KieModel, Record<KieResolution, number>> = {
    "gpt-image-2-text-to-image": { "1K": 3, "2K": 5, "4K": 8 },
    "nano-banana-2": { "1K": 4, "2K": 6, "4K": 9 },
  };
  return table[input.model][resolution];
}

export function toKieInput(input: NormalizedGenerationInput): Record<string, unknown> {
  const base = {
    prompt: input.prompt,
    aspect_ratio: input.aspectRatio,
  };
  if (input.model === "nano-banana-2") {
    return {
      ...base,
      image_input: [],
      resolution: input.resolution ?? "1K",
      output_format: input.outputFormat ?? "png",
    };
  }
  return {
    ...base,
    ...(input.resolution ? { resolution: input.resolution } : {}),
    ...(input.outputFormat ? { output_format: input.outputFormat } : {}),
  };
}

function stringField(value: unknown, name: string, maxLength: number): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${name} is required`);
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new Error(`${name} exceeds ${maxLength} characters`);
  return normalized;
}

function optionalString(value: unknown, maxLength: number): string | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string") throw new Error("purpose must be a string");
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new Error(`purpose exceeds ${maxLength} characters`);
  return normalized || undefined;
}

function optionalEnum<T extends readonly string[]>(value: unknown, options: T, name: string): T[number] | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string" || !options.includes(value)) throw new Error(`${name} must be one of: ${options.join(", ")}`);
  return value as T[number];
}
