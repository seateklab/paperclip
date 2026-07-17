# Windows PowerShell UTF-8 JSON Mutations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve Vietnamese and other non-ASCII text in Paperclip API mutations sent from Windows PowerShell.

**Architecture:** Add one bundled PowerShell request helper at the installed Paperclip skill boundary. The helper serializes request objects, converts JSON to BOM-less UTF-8 bytes, and calls `Invoke-RestMethod` with an explicit UTF-8 content type; no server or database behavior changes.

**Tech Stack:** Windows PowerShell 5.1, Node.js HTTP test server, Vitest, Markdown.

## Global Constraints

- Do not change UI fonts, Express request decoding, PostgreSQL, schemas, migrations, or existing runtime data.
- Do not attempt to reconstruct characters already stored as `?` or U+FFFD.
- Preserve `Authorization` and `X-Paperclip-Run-Id` behavior without exposing their values.
- Keep Linux/macOS curl workflows unchanged and add no dependency.
- Back up every existing file in its own directory before editing it.

---

### Task 1: Add the failing UTF-8 skill contract and Windows round-trip test

**Files:**
- Modify: `server/src/__tests__/paperclip-skill-utils.test.ts`
- Test: `server/src/__tests__/paperclip-skill-utils.test.ts`

**Interfaces:**
- Consumes: bundled files under `skills/paperclip/`
- Produces: a static packaging/documentation contract plus a Windows-only real HTTP round-trip regression

- [x] **Step 1: Back up the existing test file and verify the backup hash.**
- [x] **Step 2: Add a cross-platform test requiring `paperclip-api-request.ps1`, `UTF8Encoding`, and `application/json; charset=utf-8` guidance.**
- [x] **Step 3: Add a Windows-only test that starts a local HTTP server, invokes the helper through `powershell.exe`, and compares the received Vietnamese JSON and headers exactly.**
- [x] **Step 4: Run the focused test and verify RED because the helper and guidance do not exist.**

Run:

```sh
pnpm exec vitest run --project @paperclipai/server server/src/__tests__/paperclip-skill-utils.test.ts
```

Expected: FAIL on the missing PowerShell helper or missing skill guidance.

### Task 2: Implement the bundled PowerShell UTF-8 request helper

**Files:**
- Create: `skills/paperclip/scripts/paperclip-api-request.ps1`
- Modify: `skills/paperclip/SKILL.md`
- Modify: `doc/DEVELOPING.md`

**Interfaces:**
- Consumes: `PAPERCLIP_API_URL`, `PAPERCLIP_API_KEY`, `PAPERCLIP_RUN_ID`; parameters `Method`, `Path`, and optional `Body`
- Produces: a JSON API response from a request whose body bytes are explicitly UTF-8

- [x] **Step 1: Back up `SKILL.md` and `DEVELOPING.md` and verify both hashes.**
- [x] **Step 2: Create `paperclip-api-request.ps1` with validated method/path parameters, environment fallbacks, auth/run headers, object-or-string JSON handling, and BOM-less UTF-8 byte conversion.**
- [x] **Step 3: Update the Paperclip skill with a Windows JSON mutation section and a Vietnamese-safe example using the bundled helper.**
- [x] **Step 4: Update Windows development guidance to distinguish terminal output encoding from HTTP request-body encoding.**
- [x] **Step 5: Run the focused test and verify GREEN, including the real Windows round trip on Windows.**

Run:

```sh
pnpm exec vitest run --project @paperclipai/server server/src/__tests__/paperclip-skill-utils.test.ts
```

Expected: all tests in the file pass; Windows executes the UTF-8 round trip and non-Windows platforms skip only that platform-specific case.

### Task 3: Synchronize task records and verify handoff quality

**Files:**
- Modify: `memory-bank/tasks/TASK008-windows-powershell-utf8-json.md`
- Modify: `memory-bank/tasks/_index.md`
- Modify: `memory-bank/activeContext.md`
- Modify: `memory-bank/progress.md`

**Interfaces:**
- Consumes: fresh test/typecheck/diff output
- Produces: durable task status with independent implementation and validation states

- [x] **Step 1: Back up each existing Memory Bank file and verify hashes.**
- [x] **Step 2: Record the selected design, changed files, and fresh verification results without runtime UUIDs or credentials.**
- [x] **Step 3: Run the focused test again.**
- [x] **Step 4: Run the narrow server typecheck if the installed workspace permits it.**
- [x] **Step 5: Run `git diff --check` and inspect `git diff` plus `git status --short --branch`.**

Commands:

```sh
pnpm exec vitest run --project @paperclipai/server server/src/__tests__/paperclip-skill-utils.test.ts
pnpm --filter @paperclipai/server typecheck
git diff --check
git status --short --branch
```

Expected: focused tests pass, typecheck passes or an environment-specific blocker is recorded, and the diff has no whitespace errors or unrelated edits from this task.

## Execution results

- The regression suite was observed RED on the missing helper, then GREEN after
  implementation.
- The Windows round-trip test passed with an already serialized JSON string
  containing Vietnamese and verified the content type, Bearer header, and run
  header.
- The canonical pnpm wrapper could not run because its dependency preflight
  attempted a non-TTY module cleanup. Direct Vitest execution passed.
- Direct server typecheck reached two pre-existing errors in modified plugin
  route code unrelated to TASK008; TASK008 changed no plugin route types.
- Scoped whitespace validation passed.
