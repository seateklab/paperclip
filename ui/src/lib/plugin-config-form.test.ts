import { describe, expect, it } from "vitest";
import {
  buildPluginConfigFormValues,
  getPluginConfigErrorState,
} from "./plugin-config-form";

describe("buildPluginConfigFormValues", () => {
  it("sanitizes saved values before hydrating the form", () => {
    expect(buildPluginConfigFormValues({
      type: "object",
      properties: {
        apiBaseUrl: { type: "string", format: "uri" },
      },
      additionalProperties: false,
    }, {
      apiBaseUrl: "  https://api.ai.seateklab.vn  ",
      devUiUrl: "http://localhost:4173",
    })).toEqual({
      apiBaseUrl: "https://api.ai.seateklab.vn",
    });
  });
});

describe("getPluginConfigErrorState", () => {
  it("maps server field errors and keeps root errors separate", () => {
    const result = getPluginConfigErrorState({
      message: "Request failed",
      body: {
        error: "Configuration does not match the plugin's instanceConfigSchema",
        fieldErrors: [
          { field: "/apiBaseUrl", message: "must match format uri" },
          { field: "/", message: "must NOT have additional properties (unexpected property: devUiUrl)" },
        ],
      },
    });

    expect(result.fieldErrors).toEqual({
      "/apiBaseUrl": "must match format uri",
      "/": "must NOT have additional properties (unexpected property: devUiUrl)",
    });
    expect(result.summary).toContain("devUiUrl");
  });

  it("falls back to the ordinary error message when no field errors exist", () => {
    expect(getPluginConfigErrorState(new Error("network failed"))).toEqual({
      fieldErrors: {},
      summary: "network failed",
    });
  });
});
