import { describe, expect, it } from "vitest";
import manifest from "../src/manifest.js";

describe("Kie image manifest", () => {
  it("declares autonomous tools, persistence, callback, and UI surfaces", () => {
    expect(manifest.id).toBe("paperclip.kie-image");
    expect(manifest.tools?.map((tool: { name: string }) => tool.name)).toEqual([
      "generate_image",
      "get_generation",
      "list_generations",
    ]);
    expect(manifest.jobs).toContainEqual(expect.objectContaining({ jobKey: "reconcile-generations" }));
    expect(manifest.webhooks).toContainEqual(expect.objectContaining({ endpointKey: "kie-callback" }));
    expect(manifest.database?.migrationsDir).toBe("migrations");
    expect(manifest.ui?.slots).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "page", routePath: "kie-images" }),
      expect.objectContaining({ type: "companySettingsPage", routePath: "kie-image-generation" }),
    ]));
  });

  it("keeps defaults instance-scoped and credentials company-scoped", () => {
    expect(manifest.instanceConfigSchema).toMatchObject({
      type: "object",
      properties: {
        publicBaseUrl: { type: "string" },
      },
    });
    expect(manifest.instanceConfigSchema).not.toHaveProperty("properties.apiKeyRef");
    expect(manifest.companyConfigSchema).toMatchObject({
      type: "object",
      required: ["apiKeyRef"],
      properties: {
        apiKeyRef: { format: "secret-ref" },
        webhookHmacKeyRef: { format: "secret-ref" },
      },
    });
  });
});
