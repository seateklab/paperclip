import { describe, expect, it, vi } from "vitest";

import type { HostServices } from "../src/host-client-factory.js";
import { createHostClientHandlers } from "../src/host-client-factory.js";

describe("host client company-scoped config and secrets", () => {
  it("forwards invocation scope to config and secret service adapters", async () => {
    const configGet = vi.fn(async (context?: { invocationScope?: { companyId: string } | null }) => {
      expect(context?.invocationScope?.companyId).toBe("company-a");
      return { publicBaseUrl: "https://paperclip.example", apiKeyRef: "secret-a" };
    });
    const secretResolve = vi.fn(async (
      params: { secretRef: string; configPath?: string },
      context?: { invocationScope?: { companyId: string } | null },
    ) => {
      expect(context?.invocationScope?.companyId).toBe("company-a");
      expect(params.configPath).toBe("apiKeyRef");
      return "secret-value-a";
    });
    const handlers = createHostClientHandlers({
      pluginId: "paperclip.kie-image",
      capabilities: ["secrets.read-ref"],
      services: {
        config: { get: configGet },
        secrets: { resolve: secretResolve },
      } as unknown as HostServices,
    });
    const context = { invocationScope: { companyId: "company-a" } };

    await expect(handlers["config.get"]({}, context)).resolves.toEqual({
      publicBaseUrl: "https://paperclip.example",
      apiKeyRef: "secret-a",
    });
    await expect(
      handlers["secrets.resolve"](
        { secretRef: "secret-a", configPath: "apiKeyRef" } as never,
        context,
      ),
    ).resolves.toBe("secret-value-a");

    expect(configGet).toHaveBeenCalledWith(context);
    expect(secretResolve).toHaveBeenCalledWith(
      { secretRef: "secret-a", configPath: "apiKeyRef" },
      context,
    );
  });
});
