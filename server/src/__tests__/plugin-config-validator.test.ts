import { describe, expect, it } from "vitest";
import type { JsonSchema } from "@paperclipai/shared";
import { validateInstanceConfig } from "../services/plugin-config-validator.js";

const notoInstanceSchema: JsonSchema = {
  type: "object",
  properties: {
    apiBaseUrl: {
      type: "string",
      format: "uri",
      minLength: 1,
    },
  },
  required: ["apiBaseUrl"],
  additionalProperties: false,
};

describe("validateInstanceConfig", () => {
  it("accepts the valid Noto API base URL", () => {
    expect(validateInstanceConfig({ apiBaseUrl: "https://api.ai.seateklab.vn" }, notoInstanceSchema)).toEqual({
      valid: true,
    });
  });

  it("rejects unknown properties and identifies the unexpected property", () => {
    const result = validateInstanceConfig({
      apiBaseUrl: "https://api.ai.seateklab.vn",
      devUiUrl: "http://localhost:4173",
    }, notoInstanceSchema);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        field: "/",
        message: expect.stringContaining("devUiUrl"),
      }),
    ]));
  });

  it("rejects a malformed API base URL with a field-specific error", () => {
    const result = validateInstanceConfig({ apiBaseUrl: "not-a-url" }, notoInstanceSchema);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        field: "/apiBaseUrl",
        message: expect.stringContaining("format"),
      }),
    ]));
  });
});
