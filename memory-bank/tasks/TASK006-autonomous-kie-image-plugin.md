# [TASK006] - Autonomous KieAPI Image Generation Plugin

## Execution checkpoint (2026-07-16)

The earlier broad Phase 0 host implementation was undone on request. The Kie
package was intentionally preserved, and the rewritten MVP plan is now being
executed. The current implementation target is the smallest safe host change
that lets one company-scoped `generate_image` call resolve a Paperclip secret
UUID.

**Status:** In progress - Kie secret-resolution MVP
**Added:** 2026-07-15
**Updated:** 2026-07-16
**Implementation:** Tasks 1-6 implemented; optional-secret omission correction complete
**Validation:** focused tests, server typecheck, and live local config save green; embedded DB integration and lockfile review remain open
**Activation/follow-up:** live_company_binding_verified_pending_provider_demo

## Execution start (2026-07-16)

Kaizen implementation follows the rewritten linked plan as the current source
of truth. Work is test-first and limited to the existing `plugin_config` table,
company secret bindings, invocation-aware SDK RPC, and one Kie tool call. No
raw-token fallback, second config table, scheduler redesign, or Kie-specific
host bypass is permitted.

The memory bank is updated before implementation. Each plan task is recorded
below as it moves from red test to green implementation and verification.

## Source of truth

Execution follows the implementation plan in
[`doc/plans/2026-07-15-autonomous-kie-image-plugin.md`](../../doc/plans/2026-07-15-autonomous-kie-image-plugin.md).
The plan is decision-complete for this MVP: preserve the existing autonomous
Kie package, keep global defaults non-secret, add company-scoped configuration
and binding checks, carry invocation scope through SDK config/secrets RPC, and
prove one `generate_image` request. Jobs, webhooks, history, attachments,
guardrails, and provider expansion are explicitly deferred follow-up work.

## Current checkpoint

The package scaffold, manifest/contracts, Kie client, SQL repository, worker
orchestrator, managed skill, UI, and README are implemented. Focused contract,
client, manifest, skill, and worker tests pass (16 tests), the package source
and test projects typecheck directly, the emitted build and UI bundle succeed,
and npm dry-run packaging contains the intended 36 publishable files without
backup files. Existing unrelated worktree changes remain out of scope.

The plan was refined after SDK and Context7 inspection: the current host
exposes the base plugin capability model but fails closed for secret refs until
company-scoped plugin configuration exists. The custom plugin page remains
diagnostic; company config writes belong to the host-managed company settings
form/route.

The Windows activation checkpoint also required a generic host fix: Node must
receive the development `tsx` loader through a `file://` URL, not a raw drive
letter path. This preserves the pure plugin boundary while making local worker
activation portable.

## Required implementation

Execute Tasks 1-7 in the linked MVP plan in order. Start with failing tests,
then implement the smallest host/SDK change that makes them pass. Extend the
existing `plugin_config` row with nullable company scope; do not create a
second configuration table. Synchronize `company_secret_bindings`, require
`secrets.read-ref` plus the active company invocation scope, and resolve only
the exact `configPath` binding. Connect the already-built Kie client to that
contract for one `generate_image` call. Do not add a raw-token or Kie-only core
bypass, do not modify the lockfile, and do not redesign jobs or webhooks.

## Validation record

### Task 1 red checkpoint (2026-07-16)

- Added failing tests for company-scoped secret resolution, invocation context
  forwarding, and the Kie client's exact `configPath`.
- Red evidence was observed before production edits: server secret handler
  (3 expected failures), SDK host-client factory (1 expected failure), and
  shared manifest validation (3 expected failures). The Kie client regression
  already passed against the existing package implementation.
- Task 1 is complete; Task 2 is now in progress. No provider request or secret
  value was used.

### Task 2 source checkpoint (2026-07-16)

- Added nullable `companyId` to the existing `plugin_config` schema and shared
  `PluginConfig` type, with partial unique indexes for global and company rows.
- Added `companyConfigSchema` and validation that keeps secret-ref fields out
  of global instance configuration; the kitchen-sink example now follows the
  contract.
- Generated migration `0095_mute_living_lightning.sql` and inspected it: it
  only drops the old global unique index, adds the nullable company foreign
  key, and creates the two partial indexes. No second config table or lockfile
  change was retained.
- The shared focused validator suite and DB source typecheck pass. The new
  embedded-Postgres registry isolation test could not start within 120 seconds
  on this Windows host because the local embedded database process hangs; it
  remains the appropriate CI/integration check and no secret value was used.

- Package-local source typecheck: passed with `tsc --noEmit -p tsconfig.json`.
- Package-local test typecheck: passed with `tsc --noEmit -p tsconfig.test.json`.
- Focused Vitest suite: 5 files, 16 tests passed, including signed callback
  reconciliation and exactly-once terminal notification coverage.
- Host loader regression: 2 Windows-path argument tests and the existing
  plugin-worker-manager suite (11 tests) passed.
- Server source typecheck passed after the host loader change.
- Emitted TypeScript build and esbuild UI bundle: passed.
- `npm pack --dry-run`: passed through the Node prepack/postpack lifecycle;
  36 intended files were included, including the migration and managed skill,
  with no `.orig` backup files, and the development package manifest was
  restored cleanly.
- Lint script: not defined in this package; README documents the absence and
  typecheck is the available static check.
- Canonical filtered pnpm scripts were unavailable in this checkout because
  the workspace lockfile does not yet contain the new package importer and the
  installed pnpm attempted a non-interactive module-directory cleanup. Direct
  package-local equivalents passed; no lockfile was changed.
- `git diff --check`: passed. `git status --short --branch`: reviewed; the
  plugin, plan, and memory-bank files are present alongside pre-existing
  unrelated worktree changes, which remain out of scope.
- End-to-end live Kie authentication is not claimed: the host-side scoped
  resolver path is implemented and synthetic requests are covered, but no real
  provider request or real credential was used during this validation.

## Safety constraints

Never record KieAPI keys, secret values, authorization headers, runtime UUIDs,
or machine-specific absolute paths in the memory bank, logs, README, tests, or
artifacts. If a provider URL is temporary, persist the bytes into Paperclip
storage before the agent reports completion.

## Implementation checklist

- [x] Task 1: failing isolation/config/Kie client tests observed.
- [x] Task 2: existing `plugin_config` company scope and shared manifest contract.
- [x] Task 3: registry, company routes, and atomic secret-binding replacement.
- [x] Task 4: SDK/host config merge and invocation-aware secret resolution.
- [x] Task 5: Kie client uses the corrected resolver for one scoped tool call.
- [x] Task 6: company secret-picker UI and operator documentation.
- [ ] Task 7: focused tests, typechecks, build, diff review, and memory update; direct checks are green, but lockfile review and the unavailable embedded-Postgres integration remain open.

## Scope boundary (2026-07-16)

The immediate proof is that an agent can resolve a selected company-owned
Paperclip secret UUID as the KieAPI token for one scoped tool call. Jobs,
callbacks, history UI, durable image persistence, and other autonomous workflow
surfaces remain deferred unless the secret-resolution MVP passes and a new plan
is approved.

## Audit correction checkpoint (2026-07-16)

The implementation review confirmed that the core architecture follows the
rewritten MVP: company scope stays in the existing `plugin_config` table,
company secret bindings are replaced transactionally, invocation scope reaches
the SDK/host, and the Kie tool uses the scoped resolver. Fresh focused checks
passed for the server secret handler (6), plugin routes (36), SDK scope bridge
(1), Kie package (16), UI secret form (10), and Windows worker URL handling (2).

The correction pass redacted raw input from invalid-secret errors and added a
regression test, added foreign-company route coverage, reconciled the plan/task
checkpoints, and completed direct typecheck/build verification. The focused
server route and secret suites remain green. The embedded-Postgres registry
test remains unavailable on this Windows host because the local embedded
database process hangs. The workspace lockfile currently has changes from
dependency/package installation and remains a handoff review item because the
plan forbids lockfile edits. No Kie token or resolved secret value is recorded
here.

## Direct verification checkpoint (2026-07-16)

- Direct no-emit typechecks passed for shared, DB, SDK, server, UI, Kie, and
  Kie test projects.
- Kie TypeScript emit and the esbuild UI bundle passed.
- The malformed-secret and provider-error redaction tests were each observed
  red before their fixes and green afterward; the server secret suite now has
  6 passing tests.
- The plugin route suite now has 36 passing tests, including foreign-company
  secret rejection; Kie has 16 package tests and the UI secret-form suite has
  10 passing tests.
- No real provider request or credential was used. The remaining handoff items
  are lockfile review, the unavailable embedded-Postgres integration, and a
  live Paperclip demonstration.

## Live configuration correction checkpoint (2026-07-16)

- A live local API inspection confirmed the installed Kie manifest now has the
  company-scoped `companyConfigSchema` and the plugin is ready. The old global
  config still contained a token-shaped legacy field; it was replaced with
  non-secret polling/timeout defaults without recording or printing its value.
- The first company config save using the selected Paperclip secret reference
  failed before ownership lookup because `findInvalidSecretRefPaths` treated
  the optional `webhookHmacKeyRef` path as invalid when it was omitted.
- Correction scope is limited to allowing absent optional secret-ref fields;
  required-field validation remains owned by the manifest schema validator.
- Added the red regression test, changed only the optional-path presence check,
  and reran the focused helper (3 tests) and route (36 tests) suites plus the
  server typecheck. All passed.
- The live local instance then accepted the company binding, reports the Kie
  plugin `ready`, has no secret fields in global instance defaults, and stores
  the company `apiKeyRef` as a UUID-shaped reference. No provider request or
  plaintext secret was used.
