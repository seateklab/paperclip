---
name: persist-facebook-image-to-noto
description: Use when a Suijin Image Agent has a successful Kie image that must be available to the managed Noto Facebook publisher.
---

# Persist Facebook image to Noto

Use this skill after `paperclip.kie-image:get_generation` reaches terminal
success and before handing the topic to Facebook Publisher. This is a Suijin
workflow layered on top of the generic `kie-image-generation` skill.

## Upload

1. Keep the work attached to the current issue and read its exact
   `Target Facebook Page:` value.
2. Call `seatek.noto:list_folders` and paginate through the configured
   workspace. Reuse exactly one active private folder named `Suijin Facebook
   Images`, or call `seatek.noto:create_folder` once when it is absent. Do not
   create a folder per retry.
3. Verify the selected folder ID, exact name, and `isPublic:false` before using
   it. A folder that is missing, duplicated, inactive, deleted, or not private
   blocks the handoff.
4. Use only the managed file operations. The documented creation contract is
   `/v1/file/create`; its `content` field is the transient HTTPS Kie source URL
   that Noto downloads. The managed tool validates that source URL and never
   persists it.
5. Do not move the managed folder to trash during normal operation.
6. Use a deterministic filename containing the current issue ID and Kie
   generation ID. Search the folder first and reuse one matching active file.
   Multiple matches are a durable blocker.
7. When no matching file exists, call `seatek.noto:upload_file` with the
   transient Kie HTTPS URL, actual image MIME type, downloaded byte size, and
   SHA-256. The managed tool sends exactly the documented URL-ingestion body,
   then downloads the Noto copy in memory and verifies HTTP success, byte
   size, SHA-256, and the PNG signature. Do not put source URLs in activity,
   comments, documents, artifacts, or issue metadata.
8. Call `seatek.noto:get_file_detail` (the documented
   `/v1/file/detail/{folderId}/{fileId}` operation) and verify the returned Noto file ID,
   folder ID, deterministic filename, image MIME type, integer byte size,
   SHA-256, HTTPS storage path, and active/private or draft state. The Noto
   file ID and verified byte metadata are durable identities; Noto links are
   short-lived transport values only.

Use `skills/paperclip/scripts/paperclip-plugin-tool.mjs` for every managed Noto
tool call. Never call a raw Noto endpoint, guess a function name, print a
credential, or persist a Noto secret.

## Paperclip handoff

After Noto succeeds, upload exactly one image attachment to the current issue
and create exactly one work product:

```json
{
  "type": "artifact",
  "provider": "paperclip",
  "externalId": "<kie-generation-id>",
  "title": "Facebook image",
  "status": "active",
  "reviewState": "none",
  "metadata": {
    "artifactKind": "facebook-image",
    "attachmentId": "<paperclip-attachment-id>",
    "kieGenerationId": "<generation-id>",
    "notoFileId": "<noto-file-id>",
    "notoFolderId": "<noto-folder-id>",
    "notoFileName": "<deterministic-file-name>",
    "contentType": "image/png",
    "byteSize": 12345,
    "sha256": "<verified-sha256>"
  }
}
```

Report completion and assign Facebook Publisher only after the Noto file,
Paperclip attachment, and artifact record all succeed. On retry, reuse the
existing Noto file and Paperclip artifact; never call Kie or create another
Noto file. Temporary Kie or Noto access URLs must never enter comments,
documents, artifact metadata, or durable issue state. If Noto does not expose
the managed `upload_file` operation, or its detail/verification does not
confirm the expected private file, remain blocked and report the missing or
invalid capability. Ambiguous or incomplete create results block without a
retry because the documented API has no idempotency key.
