# Active Context

## Rollback checkpoint (historical, 2026-07-16)

The user requested undoing the most recent generic Phase 0 host work. The
tracked DB, SDK, shared, server, example, and UI host changes were restored to
their pre-Phase 0 state, and the five generated company-config schema/migration
files were removed. The untracked Kie plugin package, earlier Windows ESM
loader fix, plan documents, safety backups, and unrelated worktree edits were
preserved. Kie secret-reference resolution was unresolved at that checkpoint; no secret
values were recorded.

## Current focus

TASK009 is complete as one reusable `verifying-published-text` company skill.
The skill defaults article output to UTF-8 for English and Vietnamese, points
Windows PowerShell mutations to the existing Paperclip UTF-8 helper, and asks
the agent to fetch and inspect the saved document. The discarded broader
helper/agent/workflow plan was removed; no agent assignment, server code, font,
schema, or additional helper is part of TASK009.

TASK008 is complete. The bundled Paperclip skill now includes a Windows
PowerShell request helper that converts JSON to explicit UTF-8 bytes and sends
`application/json; charset=utf-8`. A real Windows round-trip regression passed
with the serialized Vietnamese payload shape that failed in WRIA-19. Existing
corrupted issue data remains unchanged; any repair is a separate explicit task.
Direct server typecheck is still red on unrelated plugin-route edits.

TASK006's package implementation is preserved. The broad generic Phase 0
design was rolled back at the user's request; the narrower secret-resolution
MVP is now implemented through the host boundary. Live Kie activation remains
unclaimed until final lockfile review and integration checks are closed.
[`doc/plans/2026-07-15-autonomous-kie-image-plugin.md`](../doc/plans/2026-07-15-autonomous-kie-image-plugin.md).

TASK007 is now the active implementation task for integrating the working Kie
plugin with the Cognito Content `content-pipeline` project. Its approved,
source-of-truth design is stored in
[`docs/superpowers/specs/2026-07-16-kie-content-pipeline-hero-design.md`](../docs/superpowers/specs/2026-07-16-kie-content-pipeline-hero-design.md).
The user approved implementation on 2026-07-16. Work is limited to the
Cognito company package and its static contract test: Writer generates one
`hero-v1`, persists the image, inserts it into `article-draft`, and only then
hands off to Reviewer; guardrail failures escalate to Content Director/admin.

## Verified state

- The package scaffold, worker/orchestrator, Kie client, migration, managed
  skill, UI, and README are implemented.
- Focused package tests pass (16 tests), direct source/test TypeScript checks
  pass, the emitted TypeScript/UI build passes, and npm dry-run packaging
  contains the intended publishable files without backups.
- The full npm pack lifecycle passes on Windows through Node-based prepack and
  postpack hooks; the publish manifest is restored after packing.
- Product decisions are locked: plugin-owned product behavior, autonomous
  submission, preflight report without confirmation, GPT Image 2 and Nano
  Banana 2, balanced guardrails, history/settings UI, and agent-side
  attachment persistence.
- SDK and Context7 inspection confirmed the base capability contract. The
  current host now has the company-config/binding and invocation-aware
  resolution needed for one scoped tool call; a real provider request has not
  been made during validation.
- Callback coverage verifies HMAC validation, provider result persistence, and
  exactly-once terminal comment/wakeup behavior.
- Windows repo-local worker activation now passes the development `tsx` loader
  as a `file://` URL, preventing Node's `ERR_UNSUPPORTED_ESM_URL_SCHEME` before
  plugin initialization. The fix is generic in
  `server/src/services/plugin-loader.ts` and covered by a focused regression
  test plus worker-manager coverage.
- This package has no `lint` script; its README records that typecheck is the
  available static check. The canonical filtered pnpm wrapper remains unsuitable
  for this non-TTY session because its module cleanup aborts; direct package-
  local equivalents and direct workspace typechecks pass.
- Existing unrelated worktree changes remain untouched.

## Next action

Execute TASK007's approved company-package checklist test-first. Preserve the
existing Kie plugin and Paperclip core; do not add a new agent, workflow hook,
provider model, or generic attachment/document abstraction.

## TASK007 implementation checkpoint (2026-07-16)

The design is approved and memory-bank status is synchronized. Implementation
has not yet changed the Cognito package. The next slice is a failing static
contract test, followed by the minimum Writer/company documentation updates.

After the correction pass, restart the development server so it loads the host
portability fix, then enable or reinstall the Kie plugin from Instance Settings
-> Plugins. Create/select a Paperclip company secret UUID in the company plugin
settings; do not paste or rotate a Kie token as a workaround.

The live reinstall now loads the corrected company schema. A config-save probe
found one narrow validation defect: an omitted optional `webhookHmacKeyRef` was
reported as invalid before the selected `apiKeyRef` binding could be stored.
The optional-path validator fix and regression tests are complete. The legacy
token-shaped global field has been cleared to non-secret defaults, and the live
company binding now saves as a UUID-shaped reference. No provider request has
been made.

An earlier generic Phase 0 slice briefly added a separate company-config
schema/migration, but that work was rolled back before the plan rewrite. No
`plugin_company_config` table or migration is part of the current checkout or
the current plan. The workspace pnpm wrapper incident and its recovery remain
recorded below; they are unrelated to the Kie secret contract.

## Incident note (2026-07-16)

The missing `tsx/dist/cli.mjs` startup error came from an incomplete pnpm
dependency cleanup during test validation. The workspace links survived but
their root `.pnpm` targets were gone. A completed elevated
`pnpm install --no-frozen-lockfile` restored the links; the server health check
and focused Kie manifest test passed. This was an environment/dependency-tree
incident, not a database or plugin-worker failure.

## Kie credential blocker (historical root cause, 2026-07-16)

The current Kie error is emitted before any Kie API call: the worker receives a
raw non-UUID `apiKeyRef`, and Paperclip reports `Invalid secret reference`. The
host then failed closed for UUID references because plugin secret resolution was
disabled until company-scoped plugin configuration existed. The correction pass
now provides that scoped path. Do not ask the user to rotate or retry the Kie
token. Scheduled and webhook paths remain explicitly deferred in the rewritten
plan.

## Historical TASK006 scope review checkpoint (2026-07-16; superseded)

The user narrowed the immediate goal to fixing the agent's ability to read the
KieAPI plugin secret reference. Implementation is frozen while the plan is
reviewed. The minimum proof target is one company-scoped agent tool invocation:
select a Paperclip secret UUID, verify its plugin/config-path binding, resolve it
at execution time, and issue the Kie request. Broader Kie product surfaces and
generic job/webhook fan-out are deferred unless the user approves the revised
design. No secret values or runtime tokens are recorded here.

## Historical TASK006 plan rewrite checkpoint (2026-07-16; superseded)

The source-of-truth plan was rewritten at
`doc/plans/2026-07-15-autonomous-kie-image-plugin.md` after the Context7 review.
It now targets only the Kie secret-read MVP: extend the existing
`plugin_config` row with nullable company scope, validate and bind company
secret references, propagate the existing tool invocation scope through SDK
config/secrets RPC, and prove one authenticated `generate_image` call. It does
not create a second config table or implement generic job/webhook fan-out.
The previous broad Phase 0 design is superseded; no implementation changes
were made in this checkpoint.

## Historical TASK006 implementation start checkpoint (2026-07-16; superseded)

The user approved proceeding with the rewritten MVP. TASK006 is now in
progress. The first implementation slice follows the plan's TDD order: add
failing company-isolation/config/Kie-client tests, then implement only the
existing `plugin_config` company scope and invocation-aware secret contract.
No raw token, secret value, or provider credential is recorded here.

## Audit correction checkpoint (2026-07-16)

The current implementation follows the narrow secret-resolution MVP through
the database, routes, SDK/host, Kie tool, and minimum UI. A focused audit found
no architecture expansion into jobs, webhooks, history, or attachments, but
handoff is not yet justified: invalid-secret errors must not echo raw input,
the plan and task checkboxes are stale, the lockfile has installation changes,
and registry/binding integration coverage is incomplete. Focused tests are
green; direct workspace typechecks and the Kie build are now green. The raw
invalid-reference and provider-error echoes were fixed with red regressions,
and foreign-company route rejection is covered. The embedded-Postgres
integration test and lockfile review remain open; the next work is handoff/demo
validation only.

## TASK007 implementation checkpoint (2026-07-16)

TASK007 is the active approved scope for the Cognito Content company package;
its source of truth is
`docs/superpowers/specs/2026-07-16-kie-content-pipeline-hero-design.md`.
The Writer instructions, `write-article` skill, company README/manifest,
content-pipeline project, sample brief, and static contract test now implement
the autonomous Kie hero gate. The gate uses `hero-v1`, selects one successful
provider URL, persists it as a Paperclip attachment and `hero-image` artifact,
inserts the inline
attachment path in `article-draft`, and only then hands off to the Reviewer.
Quota/guardrail responses escalate to the Content Director/admin; no secret
values are recorded.

Focused validation passed: the static contract test, all 16 Kie plugin tests,
and both Kie TypeScript configs. The repository-wide TypeScript reference
build remains red on pre-existing missing `droid-local/tsconfig.json` and CLI
fixture `status` errors. Root `pnpm test`/`pnpm typecheck` could not complete
because the Codex shell exposes pnpm 11 while the repo pins 9.15.4, causing a
recursive preflight registry-metadata retry; dependencies were restored with a
frozen-lockfile install. That earlier unavailable-port checkpoint is superseded
by the live result below.

## TASK007 live checkpoint (2026-07-16)

The server is healthy on port 3100. The local-trusted process now loads an
ignored local `PAPERCLIP_AGENT_JWT_SECRET`, which is required for managed local
agents to receive the short-lived `PAPERCLIP_API_KEY` injection. WRIA-7
completed the approved live sample: one successful GPT Image 2 Kie generation,
one durable PNG attachment, one canonical `paperclip-attachment` hero artifact,
an inline attachment path directly below the article deck, and only then the
Writer -> Reviewer handoff. The live Content Director bundle was updated to
reject placeholder/SVG fallbacks and invalid handoffs after the earlier WRIA-6
403 exposed that gap.

The live forced-limit scenario remains intentionally unexecuted. Existing Kie
guardrail tests cover the limit response; forcing a live limit would spend extra
provider credits or require mutating plugin state. No secret values were
recorded.

## 2026-07-17 demonstration cleanup checkpoint

WRIA-6 is cancelled and should not be reused: it is the historical 403/SVG
fallback diagnostic. Its invalid SVG attachment, stale article documents, work
products, and obsolete approval were deleted; outline and comments remain for
audit context. The clean demonstration is WRIA-9
It has one real Kie generation, one durable image attachment, one active
`paperclip-attachment` hero artifact, and exactly one inline image in
`article-draft`. WRIA-9 is in_review with Reviewer assigned. The initial Writer
run stalled after persistence and was cancelled; orphaned Writer continuations
were also stopped, with no duplicate Kie request. Do not force provider limits
or rotate credentials.
