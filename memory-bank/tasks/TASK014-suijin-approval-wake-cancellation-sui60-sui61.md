# TASK014 — Suijin approval wake cancellation for SUI-60/SUI-61

**Status:** implementation in progress
**Created:** 2026-07-24
**Company:** Suijin Content (`57b0a2e8-a5bc-4102-a9c3-d0a92f8192f6`)

## Goal

Prevent the Task Agent run created immediately after approving the SUI-60 or
SUI-61 topic approval from being cancelled before it starts.

## Observed production evidence

- SUI-60 approval `b5e8c840-9c84-41bd-b931-a6ca83de49d0` was approved at
  `2026-07-23T13:18:33.322Z`; wake run
  `a93d4c81-8c7d-48ee-9809-c94278f74fa1` was cancelled at
  `2026-07-23T13:18:33.415Z` with `issue_assignee_changed`.
- SUI-61 approval `a57cd5b3-d5e6-4cd6-b130-e62c9e10fe57` was approved at
  `2026-07-23T14:16:07.616Z`; wake run
  `080edf65-1bc1-425b-917c-d72292112315` was cancelled at
  `2026-07-23T14:16:07.672Z` with `issue_assignee_changed`.
- Both approval wakes targeted Task Agent while the topic issue was in
  `in_review` and intentionally unassigned pending board approval.

## Root cause

The approval route wakes the approval requester with `wakeReason:
approval_approved`. The heartbeat queued-run staleness check then applies the
ordinary assignment rule and requires `issue.assigneeAgentId` to equal the
requester. That is incompatible with the Suijin review state, where the
approved topic is unassigned until the requester performs the handoff.

## Implementation scope

- Validate the approval wake against the actual approved approval row linked to
  the exact issue.
- Allow that requester wake to pass the assignee check only while the issue is
  `in_review`.
- Preserve terminal-status, dependency, pause-hold, agent-invokability, and
  review-participant cancellation behavior.
- Add a focused heartbeat regression test.
- Do not modify or review unrelated approvals, children, or publication flows.

## Validation

- Focused regression test added to
  `server/src/__tests__/heartbeat-stale-queue-invalidation.test.ts`.
- `git diff --check` passes.
- Direct server TypeScript checking reaches two pre-existing errors in
  `server/src/routes/plugins.ts`; no error is reported from this task's files.
- Vitest currently times out during embedded-Postgres initialization in this
  environment before test assertions run.

## Follow-up

Existing cancelled runs are historical and are not automatically retried. A
future approval wake must be observed after the running server reloads this
change before the task can be marked complete.
