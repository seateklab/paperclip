import { describe, expect, it } from "vitest";

import { pluginManifestV1Schema } from "./plugin.js";

const baseManifest = {
  id: "paperclip.company-config-test",
  apiVersion: 1 as const,
  version: "0.1.0",
  displayName: "Company Config Test",
  description: "Tests company-scoped plugin configuration.",
  author: "Paperclip",
  categories: ["automation"] as const,
  capabilities: ["secrets.read-ref"] as const,
  entrypoints: { worker: "./dist/worker.js" },
};

describe("plugin company configuration manifest contract", () => {
  it("accepts secret-ref fields in companyConfigSchema", () => {
    const parsed = pluginManifestV1Schema.parse({
      ...baseManifest,
      companyConfigSchema: {
        type: "object",
        properties: {
          apiKeyRef: { type: "string", format: "secret-ref" },
        },
        required: ["apiKeyRef"],
      },
    });

    expect(parsed.companyConfigSchema).toMatchObject({
      properties: { apiKeyRef: { format: "secret-ref" } },
    });
  });

  it("rejects secret-ref fields in instanceConfigSchema", () => {
    const parsed = pluginManifestV1Schema.safeParse({
      ...baseManifest,
      instanceConfigSchema: {
        type: "object",
        properties: {
          apiKeyRef: { type: "string", format: "secret-ref" },
        },
      },
      companyConfigSchema: { type: "object" },
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues.some((issue) => issue.path[0] === "instanceConfigSchema")).toBe(true);
  });

  it("requires a company secret schema when secrets.read-ref is declared", () => {
    const parsed = pluginManifestV1Schema.safeParse(baseManifest);

    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues.some((issue) => issue.path[0] === "companyConfigSchema")).toBe(true);
  });
});
