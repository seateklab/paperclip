import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSecretService = vi.hoisted(() => ({
  resolveSecretValue: vi.fn(),
}));

vi.mock("../services/secrets.js", () => ({
  secretService: () => mockSecretService,
}));
import {
  createPluginSecretsHandler,
} from "../services/plugin-secrets-handler.js";

describe("createPluginSecretsHandler", () => {
  beforeEach(() => {
    mockSecretService.resolveSecretValue.mockReset();
  });

  it("requires an invocation company before resolving a secret", async () => {
    const handler = createPluginSecretsHandler({
      db: {} as never,
      pluginId: "11111111-1111-4111-8111-111111111111",
    });

    await expect(
      handler.resolve({ secretRef: "77777777-7777-4777-8777-777777777777" }),
    ).rejects.toThrow("Secret resolution requires a company-scoped invocation");
  });

  it("still rejects malformed secret refs before the feature-disable guard", async () => {
    const handler = createPluginSecretsHandler({
      db: {} as never,
      pluginId: "11111111-1111-4111-8111-111111111111",
    });

    await expect(
      handler.resolve({ secretRef: "not-a-uuid" }),
    ).rejects.toThrow(/invalid secret reference/i);
  });

  it("does not echo a pasted credential in the invalid-reference error", async () => {
    const pastedCredential = "kie-live-token-must-not-appear-in-errors";
    const handler = createPluginSecretsHandler({
      db: {} as never,
      pluginId: "11111111-1111-4111-8111-111111111111",
    });

    const error = await handler.resolve({ secretRef: pastedCredential }).catch((value) => value);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Invalid secret reference");
    expect((error as Error).message).not.toContain(pastedCredential);
  });

  it("resolves the bound secret for the invocation company and config path", async () => {
    mockSecretService.resolveSecretValue.mockResolvedValue("resolved-company-a-secret");
    const handler = createPluginSecretsHandler({
      db: {} as never,
      pluginId: "11111111-1111-4111-8111-111111111111",
    });
    const resolve = handler.resolve as unknown as (
      params: { secretRef: string; configPath?: string },
      context?: { invocationScope?: { companyId: string } | null },
    ) => Promise<string>;

    await expect(
      resolve(
        {
          secretRef: "77777777-7777-4777-8777-777777777777",
          configPath: "apiKeyRef",
        },
        { invocationScope: { companyId: "22222222-2222-4222-8222-222222222222" } },
      ),
    ).resolves.toBe("resolved-company-a-secret");

    expect(mockSecretService.resolveSecretValue).toHaveBeenCalledWith(
      "22222222-2222-4222-8222-222222222222",
      "77777777-7777-4777-8777-777777777777",
      "latest",
      expect.objectContaining({
        consumerType: "plugin",
        consumerId: "11111111-1111-4111-8111-111111111111",
        pluginId: "11111111-1111-4111-8111-111111111111",
        configPath: "apiKeyRef",
      }),
    );
  });

  it("redacts provider failures before they reach the plugin worker", async () => {
    mockSecretService.resolveSecretValue.mockRejectedValue(
      new Error("provider leaked value kie-super-secret"),
    );
    const handler = createPluginSecretsHandler({
      db: {} as never,
      pluginId: "11111111-1111-4111-8111-111111111111",
    });
    const resolve = handler.resolve as unknown as (
      params: { secretRef: string; configPath?: string },
      context?: { invocationScope?: { companyId: string } | null },
    ) => Promise<string>;

    const error = await resolve(
      {
        secretRef: "77777777-7777-4777-8777-777777777777",
        configPath: "apiKeyRef",
      },
      { invocationScope: { companyId: "22222222-2222-4222-8222-222222222222" } },
    ).catch((value) => value);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Secret resolution failed");
    expect((error as Error).message).not.toContain("kie-super-secret");
  });

  it("does not resolve a company-B secret from a company-A invocation", async () => {
    mockSecretService.resolveSecretValue.mockImplementation(async (companyId: string, secretId: string) => {
      if (companyId === "22222222-2222-4222-8222-222222222222" && secretId === "88888888-8888-4888-8888-888888888888") {
        throw new Error("Secret must belong to same company");
      }
      return "resolved-secret";
    });
    const handler = createPluginSecretsHandler({
      db: {} as never,
      pluginId: "11111111-1111-4111-8111-111111111111",
    });
    const resolve = handler.resolve as unknown as (
      params: { secretRef: string; configPath?: string },
      context?: { invocationScope?: { companyId: string } | null },
    ) => Promise<string>;

    await expect(
      resolve(
        {
          secretRef: "88888888-8888-4888-8888-888888888888",
          configPath: "apiKeyRef",
        },
        { invocationScope: { companyId: "22222222-2222-4222-8222-222222222222" } },
      ),
    ).rejects.toThrow("Secret resolution failed");
  });
});
