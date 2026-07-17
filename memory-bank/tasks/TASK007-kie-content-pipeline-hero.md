# [TASK007] - Kie Hero Image in Cognito Content Pipeline

## Status

**State:** Live sample complete; forced-limit smoke deferred for safety
**Created:** 2026-07-16
**Source of truth:** [`docs/superpowers/specs/2026-07-16-kie-content-pipeline-hero-design.md`](../../docs/superpowers/specs/2026-07-16-kie-content-pipeline-hero-design.md)

The user approved the source-of-truth design on 2026-07-16. Implementation is
limited to the listed Cognito Content company-package files and its static
contract test; no Paperclip core or Kie runtime changes are authorized.

## Goal

Have the Cognito Content Writer autonomously generate one KieAPI hero image,
store it as a durable Paperclip attachment/work product, place it inline in
`article-draft`, and only then hand the issue to the Reviewer.

## Approved decisions

- First output is one article hero/cover image.
- Generation occurs during the Writer stage, before Reviewer handoff.
- The image is rendered inline in the Markdown document and also remains a
  durable issue attachment/work product.
- Provider/transient failures keep the issue blocked with the Writer.
- Kie guardrail/limit failures notify through an issue comment and reassign to
  the Content Director/admin; the Reviewer must not receive the issue.
- The existing hero is reused during revision loops unless a new visual is
  explicitly requested.
- No new agent, Paperclip core hook, or Kie runtime change is planned.

## Planned files

- Cognito Content Writer agent instructions and `write-article` skill.
- Cognito Content company/project/sample-brief documentation.
- One static company-package contract test.

## Validation target

The static contract test passes, and a live sample brief proves that the
Writer's `article-draft` visibly includes the hero image, a durable
`hero-image` work product exists, Reviewer handoff waits for image success, and
limit escalation reassigns to the Content Director/admin. No secret values are
recorded.

## Implementation checklist

- [x] Update Writer agent instructions and `write-article` skill.
- [x] Update Cognito Content/company/project/sample-brief documentation.
- [x] Add and pass the static hero-pipeline contract test.
- [x] Run focused checks: static contract test, Kie plugin tests, Kie plugin
      typechecks, whitespace scan, and `git diff --check`.
- [x] Perform the configured live sample without recording credentials. WRIA-7
      completed a real Writer -> Kie -> durable attachment -> inline document ->
      Reviewer handoff on the running local instance.
- [ ] Perform a forced-limit smoke check. Do not intentionally spend extra Kie
      credits or force provider quota in the live company; the deterministic Kie
      guardrail tests remain the safe coverage for this branch.

## Implementation checkpoint (2026-07-16)

The company package now contains the autonomous Writer Kie hero gate. Writer
instructions and the `write-article` skill require `hero-v1`, immediate
download of temporary Kie output, a durable Paperclip attachment, a
`hero-image` artifact work product, and an inline attachment Markdown path in
`article-draft` before Reviewer handoff. Guardrail/quota failures escalate to
the Content Director/admin without retrying around the limit. The company,
project, README, and sample task document the `KIE_API_KEY` company secret
reference and the same ordering contract.

The static contract test passes and now checks ordering within the Writer files
and the Content Director no-fallback guard directly. The Writer selects one
successful provider URL, so one request cannot produce multiple hero
attachments. Kie package tests (16 tests) and both Kie TypeScript configs pass
when invoked directly, and the plugin UI build passes. A local-trusted dev
server without `PAPERCLIP_AGENT_JWT_SECRET` cannot inject the managed agent
Bearer token; the local ignored `.env` now supplies that runtime prerequisite.

Live evidence (2026-07-16): WRIA-7 run `c1bf3d6d-3413-4ddb-baa8-6010464454dd`
completed successfully. It produced one `image/png` attachment
`f0cec7ba-3437-40f4-b13a-a5ec955f7844`, one Kie hero artifact
`2c6e8754-4c5b-4ef5-91b4-af9f67445048` (Paperclip canonical provider
`paperclip-attachment`, model `gpt-image-2-text-to-image`, generation id
`18c9b5f8-5d6c-491c-833d-3a10485938a2`), placed the durable path directly below
the deck, and only then assigned Reviewer. No credential values were recorded.

The earlier WRIA-6 run exposed the missing local JWT and also showed why the
Content Director guard is required: it synthesized an SVG fallback after a
403. The live Content Director instructions now explicitly reject fallback
images and Reviewer handoff without a genuine Kie-backed artifact.

Root TypeScript build references still report pre-existing
`droid-local/tsconfig.json` and CLI fixture errors;
the root pnpm scripts could not complete because this environment exposes pnpm
11 while the repository pins pnpm 9.15.4 and its recursive preflight retried
registry metadata. No secret value or provider request was recorded.

## 2026-07-17 clean demonstration run

WRIA-6 is now a superseded historical diagnostic and is cancelled. Its invalid
SVG attachment, stale draft/final documents, artifact/document work products,
and obsolete pending approval were removed; the outline and audit comments
were preserved. Because the stale comments caused agents to re-enter the old
approval path, WRIA-6 was not reused for the demonstration.

WRIA-9 (`d2d3575e-1608-491b-9615-5f37deceeaf3`) is the clean demonstration
issue. The Writer made exactly one Kie request using generation
`430afea1-07a0-429d-870d-4833e16dff72` and model `gpt-image-2-text-to-image`.
The result was downloaded to one durable `image/jpeg` attachment
`3a7036da-9117-4ee2-bc4d-2163b50bc25a` and one active
`paperclip-attachment` hero work product
`6c4a5e4c-0f02-4001-a652-a9bf4b846fdf`. `article-draft` now contains exactly
one inline `/api/attachments/<id>/content` image, and the issue is in_review
with Reviewer assigned. The original Writer run was cancelled only after the
Kie result, attachment, and artifact were durable; no second generation was
submitted. No secret values or forced-limit requests were recorded.
