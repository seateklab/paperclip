import { describe, expect, it } from "vitest";
import { collectSecretRefPaths } from "../services/json-schema-secret-refs.ts";
import { findInvalidSecretRefPaths } from "../services/plugin-secrets-handler.ts";

describe("collectSecretRefPaths", () => {
  it("collects nested secret-ref paths from object properties", () => {
    expect(Array.from(collectSecretRefPaths({
      type: "object",
      properties: {
        credentials: {
          type: "object",
          properties: {
            apiKey: { type: "string", format: "secret-ref" },
          },
        },
      },
    }))).toEqual(["credentials.apiKey"]);
  });

  it("collects secret-ref paths from JSON Schema composition keywords", () => {
    expect(Array.from(collectSecretRefPaths({
      type: "object",
      allOf: [
        {
          properties: {
            apiKey: { type: "string", format: "secret-ref" },
          },
        },
        {
          properties: {
            nested: {
              oneOf: [
                {
                  properties: {
                    token: { type: "string", format: "secret-ref" },
                  },
                },
              ],
            },
          },
        },
      ],
    })).sort()).toEqual(["apiKey", "nested.token"]);
  });

  it("allows an optional secret-ref field to be omitted", () => {
    expect(findInvalidSecretRefPaths(
      { apiKeyRef: "77777777-7777-4777-8777-777777777777" },
      {
        type: "object",
        required: ["apiKeyRef"],
        properties: {
          apiKeyRef: { type: "string", format: "secret-ref" },
          webhookHmacKeyRef: { type: "string", format: "secret-ref" },
        },
      },
    )).toEqual([]);
  });
});
