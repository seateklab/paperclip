import { readFileSync } from "node:fs";
import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import {
  DEFAULT_POLL_INTERVAL_SECONDS,
  KIE_ASPECT_RATIOS,
  KIE_MODELS,
  KIE_OUTPUT_FORMATS,
  KIE_RESOLUTIONS,
  MAX_ACTIVE_PER_COMPANY,
  MAX_ESTIMATED_SPEND_CENTS_PER_RUN,
  MAX_IMAGES_PER_RUN,
} from "./contracts.js";

export const PLUGIN_ID = "paperclip.kie-image";
export const KIE_PROJECT_KEY = "kie-image-operations";
export const KIE_SKILL_KEY = "kie-image-generation";
export const KIE_HISTORY_PAGE_SLOT_ID = "kie-images";
export const KIE_SETTINGS_PAGE_SLOT_ID = "kie-image-settings";

const skillMarkdown = readFileSync(new URL("../skills/kie-image-generation/SKILL.md", import.meta.url), "utf8");

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Kie Image Generation",
  description: "Autonomous curated text-to-image generation through KieAPI with Paperclip artifact persistence.",
  author: "Paperclip",
  categories: ["automation", "ui"],
  capabilities: [
    "database.namespace.migrate",
    "database.namespace.read",
    "database.namespace.write",
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "api.routes.register",
    "jobs.schedule",
    "webhooks.receive",
    "companies.read",
    "issues.read",
    "issue.comments.create",
    "issues.wakeup",
    "activity.log.write",
    "projects.managed",
    "skills.managed",
    "ui.page.register",
    "instance.settings.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      publicBaseUrl: {
        type: "string",
        format: "uri",
        title: "Public Paperclip URL",
        description: "Optional public base URL used to register the Kie callback endpoint.",
      },
      pollIntervalSeconds: {
        type: "integer",
        minimum: 15,
        maximum: 300,
        default: DEFAULT_POLL_INTERVAL_SECONDS,
        title: "Polling interval (seconds)",
      },
      timeoutMinutes: {
        type: "integer",
        minimum: 5,
        maximum: 60,
        default: 15,
        title: "Generation timeout (minutes)",
      },
    },
    additionalProperties: false,
  },
  companyConfigSchema: {
    type: "object",
    properties: {
      apiKeyRef: {
        type: "string",
        format: "secret-ref",
        minLength: 1,
        title: "KieAPI secret reference",
        description: "Paperclip secret reference containing the KieAPI bearer key.",
      },
      webhookHmacKeyRef: {
        type: "string",
        format: "secret-ref",
        minLength: 1,
        title: "Webhook HMAC secret reference",
        description: "Optional Paperclip secret reference used to verify Kie callbacks.",
      },
    },
    required: ["apiKeyRef"],
    additionalProperties: false,
  },
  jobs: [
    {
      jobKey: "reconcile-generations",
      displayName: "Reconcile Kie image generations",
      description: "Poll active Kie tasks and complete issue notifications.",
      schedule: "* * * * *",
    },
  ],
  webhooks: [
    {
      endpointKey: "kie-callback",
      displayName: "KieAPI callback",
      description: "Receives signed asynchronous KieAPI task updates.",
    },
  ],
  tools: [
    {
      name: "generate_image",
      displayName: "Generate image",
      description: "Submit one curated GPT Image 2 or Nano Banana 2 text-to-image generation autonomously after posting a preflight report.",
      parametersSchema: {
        type: "object",
        required: ["issueId", "requestKey", "prompt", "model", "aspectRatio"],
        properties: {
          issueId: { type: "string", minLength: 1 },
          requestKey: { type: "string", minLength: 1, description: "Stable idempotency key for this image request." },
          prompt: { type: "string", minLength: 1, maxLength: 8000 },
          purpose: { type: "string", maxLength: 500 },
          model: { type: "string", enum: [...KIE_MODELS] },
          aspectRatio: { type: "string", enum: [...KIE_ASPECT_RATIOS] },
          resolution: { type: "string", enum: [...KIE_RESOLUTIONS] },
          outputFormat: { type: "string", enum: [...KIE_OUTPUT_FORMATS] },
        },
        additionalProperties: false,
      },
    },
    {
      name: "get_generation",
      displayName: "Get image generation",
      description: "Read one Kie image generation and optionally refresh its provider status.",
      parametersSchema: {
        type: "object",
        required: ["generationId"],
        properties: {
          generationId: { type: "string", minLength: 1 },
          refresh: { type: "boolean", default: false },
        },
        additionalProperties: false,
      },
    },
    {
      name: "list_generations",
      displayName: "List image generations",
      description: "List this company's recent Kie image generations, optionally scoped to an issue or status.",
      parametersSchema: {
        type: "object",
        properties: {
          issueId: { type: "string" },
          status: { type: "string", enum: ["preflight", "waiting", "queuing", "generating", "success", "fail", "timeout"] },
          limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
        },
        additionalProperties: false,
      },
    },
  ],
  apiRoutes: [
    {
      routeKey: "generate",
      method: "POST",
      path: "/generations",
      auth: "agent",
      capability: "api.routes.register",
      checkoutPolicy: "required-for-agent-in-progress",
      companyResolution: { from: "body", key: "companyId" },
    },
    {
      routeKey: "get-generation",
      method: "GET",
      path: "/generations/:generationId",
      auth: "agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" },
    },
    {
      routeKey: "list-generations",
      method: "GET",
      path: "/generations",
      auth: "agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" },
    },
  ],
  database: {
    namespaceSlug: "kie_image",
    migrationsDir: "migrations",
    coreReadTables: ["companies", "issues"],
  },
  projects: [
    {
      projectKey: KIE_PROJECT_KEY,
      displayName: "Kie Image Operations",
      description: "Autonomous KieAPI image generation requests, reconciliation, and artifact persistence.",
      status: "in_progress",
      color: "#7c3aed",
    },
  ],
  skills: [
    {
      skillKey: KIE_SKILL_KEY,
      displayName: "Kie Image Generation",
      slug: "kie-image-generation",
      description: "Autonomously submit, monitor, download, and persist KieAPI images as Paperclip artifacts.",
      markdown: skillMarkdown,
    },
  ],
  ui: {
    slots: [
      {
        type: "page",
        id: KIE_HISTORY_PAGE_SLOT_ID,
        displayName: "Kie Images",
        exportName: "KieHistoryPage",
        routePath: "kie-images",
        order: 40,
      },
      {
        type: "companySettingsPage",
        id: KIE_SETTINGS_PAGE_SLOT_ID,
        displayName: "Kie Image Generation",
        exportName: "KieSettingsPage",
        routePath: "kie-image-generation",
        order: 40,
      },
    ],
  },
};

export default manifest;
