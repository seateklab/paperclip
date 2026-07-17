---
name: kie-image-generation
description: Generate curated KieAPI images autonomously and persist them as Paperclip issue artifacts.
---

# Kie image generation

Use this skill when an issue needs a text-to-image asset. This integration is
fully autonomous: do not ask the board for confirmation. The generation tool
posts a preflight report to the issue and then submits immediately.

## Generate

1. Keep the work attached to the current Paperclip issue. Choose a stable
   `requestKey` such as `hero-v1` or `social-card-2026-07-15`; reuse it when
   retrying the same request so the plugin can return the original generation.
2. Call the namespaced Paperclip plugin tool `paperclip.kie-image:generate_image`
   with `issueId`, `requestKey`, a precise `prompt`, a short `purpose`, one of
   `gpt-image-2-text-to-image` or `nano-banana-2`, an allowed `aspectRatio`, and
   optional `resolution`/`outputFormat`.
3. The tool result and its issue comment are the preflight report. Continue
   without a confirmation step. If a guardrail or validation error is returned,
   explain it in the issue and adjust the request rather than bypassing it.

## Monitor and persist

1. Use `paperclip.kie-image:get_generation` with `refresh: true` when status is
   not terminal. A callback or issue wakeup may arrive first; reread the
   generation and do not submit a duplicate request.
2. For each result URL in a successful generation, download the bytes
   immediately. Kie result URLs are temporary and must not be the final
   deliverable.
3. Upload each byte stream as an issue attachment with the authenticated
   Paperclip API:

   `POST {PAPERCLIP_API_URL}/api/companies/{PAPERCLIP_COMPANY_ID}/issues/{issueId}/attachments`

   Use multipart form data and the bearer value from `PAPERCLIP_API_KEY`. Do
   not print the header or key. Then POST an `artifact` work product to
   `{PAPERCLIP_API_URL}/api/issues/{issueId}/work-products` with `projectId`
   when known, `provider: "paperclip-attachment"`, a descriptive `title`,
   `status: "active"`, and metadata containing the returned UUID
   `attachmentId`, `contentType`, `byteSize`,
   `contentPath: "/api/attachments/{attachmentId}/content"`, the same
   `openPath`, and
   `downloadPath: "/api/attachments/{attachmentId}/content?download=1"`.
4. Comment the durable Paperclip attachment/work-product links on the issue,
   including the model, prompt purpose, and generation id. Report completion
   only after the upload and artifact record succeed.

## REST fallback

If the adapter does not expose plugin tools, use the authenticated plugin API
with the injected values `PAPERCLIP_API_URL`, `PAPERCLIP_API_KEY`,
`PAPERCLIP_COMPANY_ID`, `PAPERCLIP_AGENT_ID`, and `PAPERCLIP_RUN_ID`. Send
`Authorization: Bearer $PAPERCLIP_API_KEY` and `X-Paperclip-Run-Id:
$PAPERCLIP_RUN_ID` on every request:

- `POST /api/plugins/paperclip.kie-image/api/generations` with `companyId`,
  `issueId`, `projectId`, `requestKey`, `prompt`, `purpose`, `model`, and
  settings.
- `GET /api/plugins/paperclip.kie-image/api/generations/{generationId}?companyId=...`
  to read or refresh status.
- `GET /api/plugins/paperclip.kie-image/api/generations?companyId=...&issueId=...`
  to list requests.

Never echo Paperclip/Kie authorization values, persist a Kie secret, or claim
that an expiring Kie URL is a durable artifact.
