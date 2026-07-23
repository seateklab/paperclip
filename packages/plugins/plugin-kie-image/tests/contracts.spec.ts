import { describe, expect, it } from "vitest";
import {
  estimateCostCents,
  normalizeGenerationInput,
  toKieInput,
} from "../src/contracts.js";

describe("Kie image contracts", () => {
  it("normalizes curated GPT Image 2 input and builds its provider payload", () => {
    const input = normalizeGenerationInput({
      issueId: "issue-1",
      requestKey: "hero-v1",
      prompt: "  A clean hero illustration  ",
      purpose: "landing page",
      model: "gpt-image-2-text-to-image",
      aspectRatio: "16:9",
      resolution: "2K",
      outputFormat: "png",
    });

    expect(input.prompt).toBe("A clean hero illustration");
    expect(toKieInput(input)).toEqual({
      prompt: "A clean hero illustration",
      aspect_ratio: "16:9",
      resolution: "2K",
      output_format: "png",
    });
    expect(estimateCostCents(input)).toBe(5);
  });

  it("adds Nano Banana 2 defaults and image_input", () => {
    const input = normalizeGenerationInput({
      issueId: "issue-1",
      requestKey: "social-v1",
      prompt: "A friendly mascot",
      model: "nano-banana-2",
      aspectRatio: "1:1",
    });

    expect(toKieInput(input)).toEqual({
      prompt: "A friendly mascot",
      image_input: [],
      aspect_ratio: "1:1",
      resolution: "1K",
      output_format: "png",
    });
    expect(estimateCostCents(input)).toBe(4);
  });

  it("rejects arbitrary models and oversized prompts", () => {
    expect(() => normalizeGenerationInput({
      issueId: "issue-1",
      requestKey: "bad",
      prompt: "prompt",
      model: "arbitrary-provider-model",
      aspectRatio: "1:1",
    })).toThrow("model must be one of");

    expect(() => normalizeGenerationInput({
      issueId: "issue-1",
      requestKey: "bad",
      prompt: "x".repeat(8001),
      model: "nano-banana-2",
      aspectRatio: "1:1",
    })).toThrow("prompt exceeds");
  });
});
