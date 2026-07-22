# Progress

## TASK010 Noto Connection external plugin (2026-07-20)

The external `@seatek/noto` worker plugin was implemented and validated
against the deployed Noto connector API. It uses `/v1/connectors/connections`,
connection detail, tools, and execution endpoints; normalizes the tested
response envelopes; resolves company-scoped secrets; redacts execution
responses; and records safe pre-call/completion audits.

Fresh package checks passed: typecheck, 6 test files/27 tests, and build. The
running Paperclip plugin was explicitly uninstalled/reinstalled from
`D:/seatek_tasks/Plugins/noto` without purging configuration. Health is ready,
all diagnostics pass, four tools are registered, and the Suijin Content
company configuration has the required credential reference, client ID,
workspace ID, and app ID. Live read-only Noto requests passed: discovery 200,
detail 200, tools 200 with 43 functions, and
`FACEBOOK_GET_CURRENT_USER` execution 201 with root success.

Remaining: make `appId` required because the current Noto contract requires
`x-app-id`, then rebuild and retest. Paperclip's plugin tool route rejected
the available historical run context with a run/company ownership 403 before
the worker was invoked; no new heartbeat was created solely for testing.
No secret values or private provider response data were recorded.

## Rollback checkpoint (2026-07-16)

The most recent generic Phase 0 host work was rolled back at the user's
request. Host-side tracked files and generated company-config migrations were
restored/removed; the Kie package and unrelated worktree changes remain. The
Kie token-reading fix is still pending implementation of the rewritten
secret-resolution MVP.

## Current baseline

Repository specifications and source remain authoritative. The memory bank is
now a standardized durable journal with explicit ownership, refresh triggers,
state dimensions, archival handling, and sensitivity rules.

## Active task

### TASK009 Unicode-safe article output skill (2026-07-17)

Completed as one reusable Cognito Content skill. It guides English and
Vietnamese article writers to use UTF-8, use the existing Paperclip request
helper for Windows PowerShell JSON, inspect suspicious replacement patterns,
and fetch the saved document for a manual readback check. The broader temporary
workflow, agent, script, test, and plan changes were removed and the affected
pre-existing company files were restored byte-for-byte.

### TASK008 Windows PowerShell UTF-8 JSON mutations (2026-07-17)

Completed the UTF-8 prevention task from the WRIA-18/WRIA-19 investigation.
The installed Paperclip skill now bundles a Windows PowerShell JSON request
helper that converts serialized JSON to BOM-less UTF-8 bytes and preserves auth
and run-audit headers. The focused static contract and real Windows round-trip
tests passed using Vietnamese multiline JSON. Existing corrupted records were
not modified. Direct server typecheck remains blocked by unrelated existing
plugin-route errors; scoped whitespace validation passed.

TASK006 tracks the autonomous KieAPI image-generation plugin. Its executable
source of truth is
[`doc/plans/2026-07-15-autonomous-kie-image-plugin.md`](../doc/plans/2026-07-15-autonomous-kie-image-plugin.md).
The package implementation and package-local validation have passed, but the
recent generic host prerequisite was rolled back; activation is paused pending
implementation of the rewritten secret-resolution MVP.

### TASK007 Content Pipeline hero integration (2026-07-16)

The approved design integrates the working Kie plugin into the Cognito Content
Writer stage. The Writer will generate one `hero-v1`, persist it as an issue
attachment/work product, insert it inline in `article-draft`, and block the
Reviewer handoff until that succeeds. Guardrail/limit failures reassign to the
Content Director/admin. The user approved implementation; the source-of-truth
spec and task checklist are now active.

### TASK007 implementation start (2026-07-16)

Memory-bank status was updated before code changes. Work remains company-package
only and test-first. The first slice is the failing static contract test,
followed by Writer instructions and the minimum company/project/sample-brief
documentation updates. No Kie token or resolved secret is recorded.

### TASK006 checkpoint

The plugin package contains the manifest/contracts, Kie client, company-scoped
SQL store, autonomous worker tools/routes/jobs/webhook, managed agent skill,
history/settings UI, and documentation. The focused suite has 13 passing
tests, direct source/test typechecks pass, the emitted TypeScript/UI build
passes, and npm dry-run packaging is clean. Callback reconciliation and
exactly-once terminal notification are covered. The rewritten plan now requires
only company config/bindings and invocation-aware secret resolution for one
tool call before a real Kie credential can be used; generic job/webhook
fan-out is deferred.

### TASK006 Windows activation checkpoint

Installing the local Kie plugin exposed a generic host bug: the development
plugin loader passed a raw Windows drive-letter path to Node `--import`, which
Node parses as the unsupported `d:` URL scheme. The host now converts that
path with `pathToFileURL` before spawning any repo-local plugin worker. The regression
test and existing worker-manager suite pass, server typecheck passes, and the
Kie package tests/typechecks remain green. This is a host portability fix,
not a Kie-specific integration surface.

## Completed milestones

- Initialized the repository memory bank.
- Built and validated the Cognito Content company package and article pipeline.
- Applied the first package correction pass.
- Added portable `idle | paused` agent status across the shared portability
  contract and import/export service.
- Corrected the Cognito work-product contracts and regenerated a source-parity
  ZIP with the Facebook publisher paused.
- Sanitized every live memory file and verified relative navigation.

## Verification summary

- 49 focused company-portability tests passed.
- Direct no-emit typechecks passed for both affected workspaces.
- ZIP inventory/content checks and live memory checks passed.
- Diff whitespace validation passed.

## 2026-07-16 live configuration correction

The live instance now reports the current company-scoped Kie manifest and a
ready plugin. The old global token-shaped config field was replaced with
non-secret defaults. Saving a company config with only the required Kie secret
reference exposed a validator bug: omitted optional secret-ref paths were
classified as invalid. The test-first presence-check correction is complete;
the focused helper/route suites and server typecheck pass, and the live company
binding now saves as a UUID-shaped reference. No secret value or reference is
recorded here.
- The recursive workspace typecheck was unavailable because the shell exposed
  an incompatible package-manager major version; dependencies were not purged
  or reinstalled.
- Package-local plugin typechecks, Vitest (5 files/13 tests), emitted build,
  UI bundle, and full npm dry-run pack lifecycle checks passed. The package has no lint script;
  the canonical filtered pnpm wrapper remained unavailable because the
  workspace lockfile lacks the new importer and pnpm attempted a non-TTY
  module cleanup.

## Remaining

TASK006 package work is preserved, but activation is not ready for handoff.
The recent Phase 0 host implementation was rolled back, so company-scoped
secret resolution still needs a smaller approved implementation. TASK005 and
all other unrelated worktree changes remain out of scope.

## 2026-07-16 dependency-repair incident

While validating the Kie manifest change, a filtered pnpm test invoked the
workspace dependency verifier. Its non-interactive module cleanup aborted with
`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`, leaving the root pnpm store absent
while workspace package links (including `server/node_modules/tsx`) remained as
dangling junctions. The resulting `pnpm dev` failure reported a missing
`tsx/dist/cli.mjs`; this was a dependency-tree state problem, not a PostgreSQL
or Kie plugin runtime error.

The first repair attempt was also blocked because the sandbox could not reach
the npm registry. A single elevated `pnpm install --no-frozen-lockfile`
completed successfully without changing lockfile resolution, restored the
workspace links, and Paperclip then returned a healthy `/api/health` response.
The focused Kie manifest test passed afterward. Avoid running filtered pnpm
commands while the workspace install is incomplete; repair dependencies once,
then run the dev command normally.

## 2026-07-16 Kie authentication investigation (historical root cause)

The Kie failure is not a provider rejection. The live plugin worker logs
`Invalid secret reference` before an outbound Kie request is made. The saved
`apiKeyRef` value is a non-UUID raw token, while the host secret handler accepts
only Paperclip secret UUIDs. More importantly, the then-current host deliberately
failed closed for all plugin secret resolution with
`Plugin secret references are disabled until company-scoped plugin config
lands`. The correction pass now supplies the company-scoped contract expected
by `ctx.secrets.resolve()`.

Do not rotate or retry the Kie token. The working fix uses company-scoped
plugin credential storage/binding plus invocation-scoped secret resolution for
one tool call; changing the token field alone cannot authenticate with Kie.
Scheduled and webhook reconciliation remain deferred follow-up work.

## 2026-07-16 Context7 plan refinement

Context7 resolved the upstream Paperclip library and confirmed the intended
plugin capability surface: `secrets.read-ref`, execution-time secret
resolution, outbound HTTP, tools, jobs, webhooks, and plugin database
namespaces. The initial Kie plan was broader than the immediate blocker. The
rewritten plan keeps the company-scoped credential split but limits the first
proof to one tool invocation; the package remains blocked until those focused
isolation tests pass.

## 2026-07-16 Earlier Phase 0 attempt (superseded)

An earlier generic Phase 0 attempt added a separate `plugin_company_config`
schema and migration, but it was rolled back at the user's request. No such
table or migration is current. The rewritten plan instead extends the existing
`plugin_config` row with nullable company scope and limits the first proof to a
single company-scoped Kie tool invocation. No raw-token fallback is allowed.

## 2026-07-16 Scope review

The current plan is now scoped to the user's immediate goal: make a
company-scoped KieAPI secret reference readable by the agent during one tool
invocation. The package's autonomous image workflow remains downstream, and
no new Kie features should be added while this focused plan is implemented.

## 2026-07-16 Implementation start

The user approved execution of the rewritten TASK006 MVP. The task index now
marks TASK006 in progress. Work must remain test-first and bounded to one
company-scoped `generate_image` call: existing `plugin_config` company scope,
company secret bindings, SDK/host resolution, the Kie adapter signature, and
minimum settings UI. Jobs, webhooks, history, attachments, and guardrails
remain deferred.

## 2026-07-16 Plan rewrite

Rewrote `doc/plans/2026-07-15-autonomous-kie-image-plugin.md` as the current
implementation source of truth. The plan preserves the existing Kie package
and limits implementation to the host contract needed for one scoped
`generate_image` call: company-aware rows in the existing `plugin_config`,
company secret-binding synchronization, invocation-aware SDK config/secrets
RPC, the Kie client adapter signature, and the minimum settings UI. It
explicitly defers a new config table, scheduler/webhook redesign, history,
attachments, guardrails, and provider expansion. The rewritten plan was
self-reviewed for placeholders and checked with `git diff --check`; no code
implementation was performed.

## 2026-07-16 Audit correction pass

Fresh focused verification is green for the server secret handler, plugin
routes, SDK invocation-scope bridge, all Kie package tests, the UI secret form,
and the Windows worker `file://` regression. The raw invalid-reference and
provider-error echoes were fixed with red-green regression tests, and
foreign-company route rejection was added. Direct no-emit typechecks for
shared, DB, SDK, server, UI, Kie, and
Kie tests passed; Kie TypeScript emit and the UI bundle passed as well. The
plan and memory-bank checkboxes are synchronized. The embedded Postgres
registry test is still blocked by the Windows shared-memory startup hang, and
the modified lockfile remains a handoff review item. No secret value is
recorded.

## 2026-07-16 TASK007 Kie hero pipeline implementation

The approved Cognito Content pipeline work is implemented in the company
package only. Writer instructions and `write-article` now require one
`hero-v1` Kie generation, immediate temporary-URL download, durable Paperclip
attachment upload, `hero-image` artifact creation, and inline Markdown in
`article-draft` before Reviewer handoff. Company/project/README/sample-task
docs describe the `KIE_API_KEY` company secret reference and Content
Director/admin escalation for Kie quota or guardrail limits. A static contract
test protects the ordering and redaction rules, including the single-result
hero invariant and per-file Reviewer handoff ordering.

Verification: static contract test passed; all 16 Kie plugin tests passed; Kie
runtime and test TypeScript configs passed; whitespace scan and `git diff
--check` passed. The root lint script does not exist. Root pnpm test/typecheck
could not complete in this shell because pnpm 11 is exposed while the repo
pins pnpm 9.15.4 and recursive preflight repeatedly attempted blocked registry
metadata; dependencies were restored with `pnpm install --frozen-lockfile`.
Direct root TypeScript references still expose unrelated existing droid-local
and CLI fixture errors. Live sample/forced-limit smoke remains pending because
ports 3100/3101 were unavailable; no secret or provider request was made.

## 2026-07-16 TASK007 live smoke result

The server became healthy on port 3100 after loading a local ignored
`PAPERCLIP_AGENT_JWT_SECRET`; without that runtime secret, managed local agents
cannot receive the short-lived Paperclip Bearer token. WRIA-7 then completed a
real Writer -> Kie -> durable attachment -> inline Markdown -> Reviewer
handoff. The run produced one PNG attachment, one Kie hero artifact with the
canonical `paperclip-attachment` provider, the configured GPT Image 2 model and
generation id, and an inline `/api/attachments/<id>/content` path immediately
below the deck before assigning Reviewer.

The Content Director instructions were synchronized into the live managed
agent and now reject SVG/placeholder fallbacks or Reviewer handoff without a
genuine Kie-backed artifact. The deterministic Kie guardrail tests cover the
limit path; a live forced-limit request was intentionally not run because
forcing it would require spending extra provider credits or mutating plugin
state. No credential values were recorded.

## 2026-07-17 clean WRIA-9 demonstration

The invalid WRIA-6 diagnostic was cleaned up and retired rather than reused:
its SVG fallback attachment, stale draft/final documents, work products, and
obsolete approval were removed while its outline/comments were retained for
audit history. WRIA-9 is the clean live sample. It submitted one autonomous Kie
generation, persisted one durable attachment and one `paperclip-attachment`
work product,
and placed exactly one attachment image inline in `article-draft` before
handoff. The Writer finalization process stalled after persistence, so its run
and automatic Writer continuations were cancelled without regenerating; the
existing artifact was handed to Reviewer and WRIA-9 is in_review. Forced-limit
smoke remains deferred.

## 2026-07-22 reusable managed-tool UTF-8 guard

The latest Suijin/Facebook investigation is now recorded as a reusable
prevention rule. The bundled catalog skill
`paperclipai/bundled/software-development/managed-tool-utf8-transport` is
installed for Suijin Content and attached to Facebook Publisher. It requires a
verified BOM-less UTF-8 parameters file and
`paperclip-plugin-tool.mjs --parameters-file` for non-ASCII managed-tool JSON;
PowerShell string pipelines and raw provider HTTP are prohibited. Preflight
must reject U+FFFD, mojibake, and unexpected `?` and stop before external
mutation if transport safety is uncertain.

The key lesson is that a correct saved document or post-publication readback
does not prove the outbound process boundary was safe. Verification can detect
an already-created bad post; only pre-mutation byte validation prevents it.
Image/public-URL upload concerns are separate and were intentionally not
changed. Catalog validation, catalog tests, the real helper Vietnamese
round-trip test, the Suijin contract test, and `git diff --check` passed.

## 2026-07-22 runtime and plugin-config review additions

The repository review also captured four core hardening details that were not
previously summarized in the memory bank:

- The MCP server discovers registered plugin tools at startup, converts their
  JSON Schemas into MCP/Zod input shapes, and executes through the existing
  `/api/plugins/tools/execute` route. A real project ID is mandatory; company
  IDs are never valid project-context fallbacks.
- OpenCode local runtime preparation preserves existing MCP configuration and
  injects the Paperclip MCP server only when the sibling built entry exists,
  keeping clean checkouts from referencing a nonexistent `dist/stdio.js`.
- Plugin config validation/UI now surfaces unexpected properties, projects
  form values onto strict schemas before save/test, trims URI values, retains
  allowed additional properties, and displays root-level errors.
- Kie payload-level authentication failures are classified as non-retryable,
  and deferred run-authored comment wakes no longer reopen or continue closed
  issues.

The focused Node contract/helper checks and direct MCP, OpenCode, UI,
validator, catalog, and Kie Vitest suites passed during this review. The
repository pnpm runner still hits its no-TTY modules-purge guard, while broad
Windows suites remain limited by symlink and default Paperclip workspace
permissions; no dependency installation or destructive module cleanup was
performed.
