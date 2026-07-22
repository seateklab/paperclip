# TASK012 — Suijin fresh-issue workflow hardening

**Status:** implementation in progress; current Suijin issues are intentionally not being resumed.
**Created:** 2026-07-21
**Company:** Suijin Content (`57b0a2e8-a5bc-4102-a9c3-d0a92f8192f6`)

## Goal

Make a fresh Research → Writer → Image → approval → Facebook Publisher run
reliable, UTF-8-safe, observable, and safe to retry without duplicate posts.

## Why this task exists

The recent Facebook post exposed two different classes of failure:

1. Facebook Writer had the `verifying-published-text` skill, but Facebook
   Publisher did not. Publisher therefore read or transported the approved
   Vietnamese text through an unsafe Windows PowerShell/API boundary.
2. The Publisher reached the external Noto connector through a raw HTTP
   proxy path instead of a supported, UTF-8-safe Paperclip/plugin tool bridge.

The saved Paperclip `facebook-post` document was valid Unicode, while the
Publisher's message preview and Facebook response contained mojibake. This
shows that the primary corruption occurred at the Publisher execution
boundary, not in research or document persistence.

Other observed workflow weaknesses were stale approval/comment state,
incorrect or generic image-artifact typing, unavailable Noto tool dispatch,
missing post-content readback, and excessive diagnostic child issues that
obscured the real blocker.

## Approved direction

Use both layers of protection:

- Add Publisher-side skill and preflight guardrails.
- Add a supported Paperclip/plugin-runtime tool bridge that preserves UTF-8
  and prevents agents from needing raw PowerShell/HTTP calls.
- Keep Noto external and dynamically discovered; do not hardcode a
  Facebook-specific provider API into Paperclip core.

## Planned work

### 1. Runtime/tool bridge

- Define or complete one supported plugin-tool execution path for agent runs.
- Preserve UTF-8 explicitly for request bodies and decoded responses.
- Surface missing session context, unavailable tools, schema failures, and
  connector errors as clear blocked outcomes.
- Keep company scoping, approval authority, and dynamic plugin loading intact.
- Add a bridge health/discovery check before a Publisher can claim work.

### 2. Facebook Publisher safeguards

- Sync `verifying-published-text` to Facebook Publisher.
- Read the saved `facebook-post` document through the safe helper and reject
  replacement characters (`�`), mojibake, suspicious embedded `?`, missing
  required fields, or a wrong Page.
- Validate exactly one active image artifact with
  `metadata.artifactKind=facebook-image`.
- Fetch a fresh approval immediately before publishing and validate its
  target Page, document revision, image artifact, and publication key.
- Discover Noto connections/tools dynamically and use the supported bridge.

### 3. Post-publication verification and idempotency

- Require an explicit Facebook post ID and permalink from Noto.
- Read the actual Facebook post body back and compare it with the approved
  source before marking success.
- On a mismatch, record a durable blocked/manual-correction outcome including
  the post ID; do not blindly retry and create a duplicate.
- Check for an existing publication artifact before every publish attempt.
- Create the durable artifact and completion comment only after verification.

### 4. Workflow and observability cleanup

- Define a small, explicit state machine for each child issue: content ready,
  image ready, approval fresh, bridge ready, published, verified.
- Make blocked reasons actionable and distinguish infrastructure blockers
  from content/approval blockers.
- Avoid creating diagnostic child issues for routine recovery; retain logs,
  activity entries, and a single visible blocker instead.
- Add safe wake/resume behavior after a dependency becomes available, while
  preserving manual approval and pause controls.
- Document fresh-run recovery and operator checks.

### 5. Contract tests

Cover at least:

- Vietnamese and other non-ASCII text through the full request/response path.
- Replacement-character and mojibake rejection.
- Dynamic Noto discovery and supported tool dispatch.
- Fresh/stale/mismatched approvals.
- Valid versus generic image artifacts.
- Facebook body readback mismatch.
- Existing publication artifact and ambiguous provider responses.
- No duplicate publication on retry.
- Windows line-ending normalization in the package contract test; the current
  ordered-marker test is CRLF-sensitive and fails on `never\r\n   create`.

## Non-goals

- Do not resume, repair, or repost the current SUI-2 children as part of this
  task.
- Do not duplicate the malformed Facebook post.
- Do not add a provider-specific Facebook API implementation to Paperclip core.
- Do not bypass human approval, company scoping, Noto idempotency, or durable
  artifact requirements.
- Do not make the Writer skill the only safeguard again; Publisher is the
  final transport boundary and must validate independently.

## Definition of done

- A fresh test issue can move through the complete pipeline with Vietnamese
  text preserved exactly.
- Publisher cannot publish when bridge, content, image, Page, approval, or
  idempotency preconditions fail.
- A successful run proves both post ID/permalink and published-body equality
  before completion.
- A post-created-but-mismatched result is durable, visible, and non-retrying.
- Focused contract/integration tests pass, including Windows UTF-8 coverage.
- The implementation plan, changed contracts, operational guidance, and
  verification results are recorded before enabling a new production run.

## Implementation checkpoint (2026-07-21)

Implemented the first three hardening layers without touching live SUI issues:

- Added `skills/paperclip/scripts/paperclip-plugin-tool.mjs`, a UTF-8-safe,
  cross-platform client for plugin discovery and execution using the existing
  Paperclip dispatcher routes. It derives the authenticated run context,
  resolves `projectId` from the current task when needed, returns sanitized
  structured errors, and never retries.
- Added four helper tests covering UTF-8 byte round trips, project resolution,
  run-context construction, no-secret error handling, and no-retry behavior.
- Added Publisher-side `verifying-published-text`, transport preflight,
  actual Facebook-body readback requirements, manual-correction blocking, and
  duplicate prevention instructions.
- Fixed the Suijin contract test's CRLF-sensitive ordered-marker assertion and
  added Publisher/readback/helper contract checks.

Focused Node tests pass. The Vitest server suites could not start because the
workspace dependency runner attempted a non-interactive pnpm modules purge;
this remains a verification follow-up. Phase 4 workflow cleanup and a
dedicated test-Page smoke run are intentionally not enabled yet.

## Dependency incident note (2026-07-21)

After the implementation work, the assistant ran these repository checks before
the user later ran `pnpm dev`:

- `pnpm exec vitest run --project @paperclipai/server server/src/__tests__/paperclip-skill-utils.test.ts`
- `pnpm exec vitest run --project @paperclipai/server server/src/__tests__/plugin-routes-authz.test.ts`
- a full `pnpm test` attempt with `CI=true` enabled; it hung and was stopped.

The Vitest attempts reported pnpm's
`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` modules-purge/setup failure. The
current broken state is consistent with those commands leaving stale workspace
links while the pnpm virtual store was absent. This is the most likely trigger,
but the workspace does not preserve a command-level deletion trace, so no
individual command is proven to have deleted the store. The assistant did not
run `pnpm dev` or `pnpm install` during implementation. The user's later
`pnpm dev` only exposed the already-broken `tsx` link.

## Managed-tool UTF-8 transport checkpoint (2026-07-22)

The reusable prevention layer is now shipped as the bundled catalog skill
`paperclipai/bundled/software-development/managed-tool-utf8-transport`.
It applies to every Paperclip managed-tool call that carries non-ASCII JSON,
not only Facebook. On Windows, agents must write a BOM-less UTF-8 parameters
file, verify its bytes/content, and invoke
`skills/paperclip/scripts/paperclip-plugin-tool.mjs --parameters-file`.
PowerShell string pipelines (`$json | node ...`), `--stdin`,
`--parameters-json`, and raw provider HTTP are prohibited. If byte-safe
transport cannot be proven, the agent must stop before any external mutation.

This incident also clarified the boundary between verification and prevention:
published-body readback can detect a corrupted external post, but it cannot
undo or prevent a mutation that has already been sent. The transport preflight
must therefore run before Noto/Facebook execution. The saved Paperclip document
can be correct while a PowerShell process boundary changes Vietnamese code
points to `?`; console display is not evidence of payload fidelity.

The catalog manifest was regenerated and validated. The skill is installed for
Suijin Content and attached to Facebook Publisher under the canonical key
above (live company skill id `9d0cde68-f8f0-47d7-bf3e-5d388d0c763a`). The live
server was healthy during verification. The change is provider-neutral: it does
not change Facebook image upload, public-image URL handling, or the Noto
connector. Focused catalog, helper regression, Suijin contract, and whitespace
checks passed. The broader fresh-run/test-Page smoke work remains separate and
the current external post must not be retried automatically.
