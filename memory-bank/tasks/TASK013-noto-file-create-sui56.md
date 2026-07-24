# TASK013 — Noto file creation and SUI-56 repair

**Status:** blocked by external Noto file-create semantics
**Created:** 2026-07-23
**Company:** Suijin Content (`57b0a2e8-a5bc-4102-a9c3-d0a92f8192f6`)

## Goal

Expose Noto file storage through the managed Paperclip plugin and repair SUI-56
using the existing Paperclip attachment, with one verified private Noto image
and one approval-gated Facebook publication.

## Source-of-truth API decision

File creation uses only the complete mentor-provided document
`D:/seatek_tasks/Docs/Noto/Tạo file với content.txt` and its documented
`POST /v1/file/create` request. The Paperclip-facing tool remains named
`upload_file` for compatibility, but it must not use the previously explored
chunk/session endpoints. The actual image bytes are sent as base64 in the
document's string `content` field; because the document does not define binary
semantics or idempotency, the adapter validates the returned record and fails
closed on mismatch or an ambiguous result.

## Implementation scope

- Keep the six managed storage tools: `list_folders`, `create_folder`,
  `list_files`, `upload_file`, `get_file`, and `get_file_access`.
- Upload actual Kie bytes, verify SHA-256, filename, MIME type, byte size,
  folder, active/deleted state, and `isPublic:false`; reuse exactly one exact
  matching file on retry and block duplicates or mismatches.
- Keep fresh access references ephemeral; never persist temporary Kie/Noto URLs.
- Update the Noto skill, Suijin Image Agent, Facebook Publisher, and contract
  tests so storage is required before Facebook execution and Facebook function
  selection remains schema-driven.
- Remove the chunk-upload-only Paperclip binary bridge if it is not needed by
  the final implementation.
- Rebuild/reinstall the plugin, reconcile the managed skill, reuse attachment
  `e9a2aa91-f000-4456-89b3-a3973f244033`, update the existing SUI-56 artifact,
  preserve the existing blocker comment, add corrective handoff context, run
  approval, publish once, verify the post artifact, and confirm retry
  idempotency.

## Guardrails

- Do not create additional test folders or manually insert a Facebook photo ID.
- Do not retry an ambiguous `/v1/file/create` response because the documented
  API does not define an idempotency key.
- Never record credentials, temporary URLs, or raw provider secrets in files,
  comments, activity logs, or artifacts.

## Verification

Run the focused Noto typecheck/tests/build and Suijin contract test first, then
the repository handoff checks where the environment permits. Report any root
check blocked by the existing pnpm/dependency environment. Live completion
requires one private folder, exactly one verified image file, valid Noto
metadata on SUI-56, one fresh-access publication, and no duplicate on retry.

## Live checkpoint (2026-07-23)

The rebuilt plugin is installed and Paperclip exposes all six storage tools;
the managed `noto` skill was reconciled and contains `/v1/file/create`. The
retained private folder `Suijin Facebook Images` is accessible. The existing
attachment was sent once with SHA-256
`1d4e7ab1884520c787f6ceaec4763aa7a45939334b5f8266f657acdac249f23e` and
1,575,116 bytes. Noto created file `6a61f584c2a1ee58e194cb93`, but the file
record is invalid for an image: `status:draft`, `isPublic:true`,
`mimeType:null`, and `size:2100156`; only the metadata object echoes the
requested MIME type and byte size. The adapter returned
`noto_upload_ambiguous` and did not retry. No SUI-56 artifact, approval, or
Facebook publication was changed. The file remains as an external invalid
record because the supplied document does not define a safe cleanup endpoint.
