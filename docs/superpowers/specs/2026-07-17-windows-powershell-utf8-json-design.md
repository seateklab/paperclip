# Windows PowerShell UTF-8 JSON Mutation Design

## Problem

Windows local-agent runs can generate correct Vietnamese text and still corrupt
it before Paperclip receives it. The WRIA-19 creation transcript shows intact
Vietnamese in a PowerShell command, followed by an immediate API response whose
stored title and description contain replacement characters and question
marks. WRIA-18 remains intact through the same UI, API, and database stack.

The failing boundary is a Windows PowerShell `Invoke-RestMethod` mutation that
passes a JSON string without explicitly converting it to UTF-8 bytes. Changing
the UI font, response encoding, or PostgreSQL cannot restore characters already
lost in the request body.

## Goals

- Give installed Paperclip skills a reliable Windows PowerShell path for JSON
  mutations containing Vietnamese or any other non-ASCII text.
- Preserve authentication and run-audit headers.
- Prove the real Windows path with a byte-level round-trip regression test.
- Keep Linux/macOS curl-based flows unchanged.

## Non-goals

- Do not guess or transcode malformed request bodies in Express.
- Do not reject all replacement characters server-side; U+FFFD can be valid
  user content, and literal question marks are ambiguous.
- Do not modify fonts, schemas, migrations, or existing issue data.
- Do not automatically rewrite WRIA-19 or other historical records.

## Considered approaches

### 1. Documentation-only PowerShell recipe

Add a snippet that converts JSON strings to UTF-8 bytes before calling
`Invoke-RestMethod`.

This is small, but every agent must reproduce the details correctly and the
behavior is difficult to regression-test as a reusable contract.

### 2. Bundled PowerShell request helper (selected)

Ship `skills/paperclip/scripts/paperclip-api-request.ps1`. It accepts a method,
relative or absolute API path, and an optional object or JSON string body. For
body-bearing requests it serializes objects with `ConvertTo-Json`, converts the
result with a BOM-less `System.Text.UTF8Encoding`, and sends the byte array with
`application/json; charset=utf-8`.

This centralizes the fragile behavior, needs no dependency, matches the
Windows runtime that produced the bug, and can be tested against a local HTTP
listener.

### 3. Server-side repair or rejection

Attempt to detect malformed text in Express, decode a legacy code page, or
reject suspicious characters.

Repair is unsafe because `?` replacement is irreversible and legacy byte
encodings are ambiguous. Broad rejection would reject valid content. This
approach is not selected.

## Architecture and data flow

1. The agent builds a PowerShell hashtable/array or an already serialized JSON
   string containing the mutation payload.
2. `paperclip-api-request.ps1` resolves the request URI from
   `PAPERCLIP_API_URL` and the supplied path, unless an absolute URI is passed.
3. The helper adds `Authorization: Bearer ...` and
   `X-Paperclip-Run-Id: ...` from explicit parameters or Paperclip environment
   variables.
4. For an explicitly supplied body, the helper produces JSON text and converts
   it to BOM-less UTF-8 bytes.
5. `Invoke-RestMethod` sends those bytes with
   `Content-Type: application/json; charset=utf-8`.
6. Paperclip receives ordinary UTF-8 JSON; no server behavior changes.

## Error handling

- Missing API URL or API key fails before making a request.
- A relative path requires `PAPERCLIP_API_URL`; an absolute URI does not.
- HTTP failures remain visible through `Invoke-RestMethod` exceptions.
- The helper does not log or echo authentication values.
- Body serialization failures stop the request rather than sending partial
  data.

## Documentation

The Paperclip skill will explicitly require the bundled helper for Windows
PowerShell JSON mutations and explain why raw string-body
`Invoke-RestMethod` calls are unsafe for non-ASCII content. The Windows section
of `doc/DEVELOPING.md` will distinguish console UTF-8 settings from HTTP body
encoding.

## Testing

- A cross-platform skill contract test verifies that the helper is bundled and
  the skill points agents to it.
- On Windows, a regression test starts a local HTTP server, invokes the helper
  through Windows PowerShell with a UTF-8-BOM wrapper script containing a
  Vietnamese title and multiline body, and asserts:
  - raw request bytes decode to the exact original strings;
  - JSON parses successfully;
  - content type includes `charset=utf-8`;
  - authorization and run-id headers are preserved.
- Run the focused server test, server typecheck where available, and
  `git diff --check`.

## Rollout and compatibility

The change only adds a script and guidance to the bundled Paperclip skill.
Existing curl, Node, Linux, and macOS flows are unchanged. Existing corrupted
records remain untouched and require explicit data correction if desired.
