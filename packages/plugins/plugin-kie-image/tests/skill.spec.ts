import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const skill = readFileSync(new URL("../skills/kie-image-generation/SKILL.md", import.meta.url), "utf8");

describe("managed Kie image skill", () => {
  it("makes autonomy and durable attachment persistence explicit", () => {
    expect(skill).toContain("do not ask the board for confirmation");
    expect(skill).toContain("/api/companies/{PAPERCLIP_COMPANY_ID}/issues/{issueId}/attachments");
    expect(skill).toContain("/api/issues/{issueId}/work-products");
    expect(skill).toContain("paperclip-attachment");
    expect(skill).toContain("downloadPath: \"/api/attachments/{attachmentId}/content?download=1\"");
    expect(skill).not.toContain("Authorization: Bearer resolved:");
  });
});
