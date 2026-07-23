import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import { createKieClient } from "../src/kie-client.js";
import { normalizeGenerationInput } from "../src/contracts.js";

const config = { apiKeyRef: "KIE_API_KEY", webhookHmacKeyRef: "KIE_WEBHOOK_SECRET" };

function input() {
  return normalizeGenerationInput({
    issueId: "issue-1",
    requestKey: "hero-v1",
    prompt: "A paperclip hero image",
    model: "nano-banana-2",
    aspectRatio: "1:1",
  });
}

describe("Kie client", () => {
  it("resolves the API key with the exact config path", async () => {
    const harness = createTestHarness({ manifest });
    const resolve = vi.fn(async (secretRef: string, options?: { configPath?: string }) => {
      expect(secretRef).toBe("KIE_API_KEY");
      expect(options).toEqual({ configPath: "apiKeyRef" });
      return "resolved:KIE_API_KEY";
    });
    harness.ctx.secrets.resolve = resolve;
    harness.ctx.http.fetch = async () => new Response(JSON.stringify({ data: { taskId: "task-1" } }), { status: 200 });

    const client = createKieClient(harness.ctx);
    await expect(client.createTask(config, input())).resolves.toEqual({ taskId: "task-1" });
    expect(resolve).toHaveBeenCalledWith("KIE_API_KEY", { configPath: "apiKeyRef" });
  });

  it("maps createTask payloads and keeps the bearer key out of the body", async () => {
    const harness = createTestHarness({ manifest });
    harness.ctx.http.fetch = async (_url, init) => {
      expect(init?.headers).toMatchObject({ Authorization: "Bearer resolved:KIE_API_KEY" });
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body).toEqual({
        model: "nano-banana-2",
        input: {
          prompt: "A paperclip hero image",
          image_input: [],
          aspect_ratio: "1:1",
          resolution: "1K",
          output_format: "png",
        },
        callBackUrl: "https://paperclip.example/api/plugins/paperclip.kie-image/webhooks/kie-callback",
      });
      return new Response(JSON.stringify({ data: { taskId: "task-1" } }), { status: 200 });
    };

    const client = createKieClient(harness.ctx);
    await expect(client.createTask(config, input(), "https://paperclip.example/api/plugins/paperclip.kie-image/webhooks/kie-callback"))
      .resolves.toEqual({ taskId: "task-1" });
  });

  it("maps provider status and bounded result URLs", async () => {
    const harness = createTestHarness({ manifest });
    harness.ctx.http.fetch = async () => new Response(JSON.stringify({
      data: {
        state: "success",
        resultJson: JSON.stringify({ resultUrls: ["https://cdn.example/image.png", "not-a-url"] }),
        cost: 4,
      },
    }), { status: 200 });

    const client = createKieClient(harness.ctx);
    await expect(client.getStatus(config, "task-1")).resolves.toMatchObject({
      taskId: "task-1",
      status: "success",
      resultUrls: ["https://cdn.example/image.png"],
      actualCostCents: 4,
    });
  });

  it("verifies the documented task-id/timestamp HMAC with freshness", async () => {
    const harness = createTestHarness({ manifest });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = JSON.stringify({ taskId: "task-1", state: "success" });
    const signature = createHmac("sha256", "resolved:KIE_WEBHOOK_SECRET")
      .update(`task-1.${timestamp}`)
      .digest("base64");
    const client = createKieClient(harness.ctx);

    await expect(client.verifyWebhookSignature(config, rawBody, {
      "X-Webhook-Timestamp": timestamp,
      "X-Webhook-Signature": signature,
    })).resolves.toBe(true);
    await expect(client.verifyWebhookSignature(config, rawBody, {
      "X-Webhook-Timestamp": String(Number(timestamp) - 600),
      "X-Webhook-Signature": signature,
    })).resolves.toBe(false);
  });
});
