# [TASK008] - Preserve UTF-8 in Windows PowerShell JSON Mutations

## Status

**Task status:** completed
**Implementation:** complete
**Validation:** passed
**Activation/follow-up:** not_required
**Created:** 2026-07-17
**Source of truth:** [`docs/superpowers/specs/2026-07-17-windows-powershell-utf8-json-design.md`](../../docs/superpowers/specs/2026-07-17-windows-powershell-utf8-json-design.md)

## Goal

Prevent Vietnamese and other non-ASCII text from being corrupted when a local
agent sends JSON mutations to the Paperclip API from Windows PowerShell.

## Confirmed evidence

- The manually created parent issue WRIA-18 is stored and returned with intact
  Vietnamese, proving the browser, API response path, database, and current
  global UI font can represent the text.
- The WRIA-19 creation transcript contains intact Vietnamese in the generated
  PowerShell command, but the API response from that same command already
  contains replacement characters and question marks.
- The mutation used `Invoke-RestMethod` with a JSON string and
  `application/json` without explicitly encoding the request body as UTF-8.
- The corruption therefore occurs at the Windows PowerShell HTTP request-body
  boundary before Paperclip persists the payload. A font change cannot restore
  characters that have already been replaced.

## Approved design

Add a bundled, testable Windows PowerShell API request helper that serializes
objects or accepts JSON strings, converts request bodies to BOM-less UTF-8
bytes, and sends `application/json; charset=utf-8`. Update the installed
Paperclip skill to require this path for Windows JSON mutations and document
the distinction between console encoding and HTTP body encoding.

Server-side repair of arbitrary legacy-encoded request bodies is out of scope
because lost `?` characters cannot be reconstructed safely.

## Success criteria

- A regression test sends a Vietnamese title and multiline body through the
  selected Windows-compatible request path and receives the same Unicode text.
- Paperclip coordination guidance directs Windows agents to the safe path.
- Existing Linux/macOS mutation workflows remain unchanged.
- No dependency, schema, migration, or unrelated UI/font change is introduced.
- Existing corrupted records are treated as data cleanup, not silently guessed
  or rewritten by the transport fix.

## Next action

Use the bundled helper for future Windows PowerShell JSON mutations. Correct
historical corrupted issue content only through a separate, explicit data
cleanup task.

## Implementation checkpoint (2026-07-17)

Added `skills/paperclip/scripts/paperclip-api-request.ps1`. The helper accepts
a PowerShell object or serialized JSON string, converts the body to BOM-less
UTF-8 bytes, sends `application/json; charset=utf-8`, and preserves Paperclip
authentication and run-audit headers. The installed Paperclip skill and Windows
development guide now direct agents to this helper instead of raw string-body
`Invoke-RestMethod` calls.

The focused contract and Windows round-trip tests passed. The live regression
uses the same serialized-string shape that corrupted WRIA-19 and verifies exact
Vietnamese JSON plus the expected headers. Direct server typecheck remains red
on two unrelated pre-existing plugin-route errors. Scoped whitespace checking
passed. No runtime records, schemas, fonts, dependencies, or existing issues
were changed.
