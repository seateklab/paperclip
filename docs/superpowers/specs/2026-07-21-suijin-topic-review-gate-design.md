# Suijin Topic Review Gate Design

**Date:** 2026-07-21

**Status:** Design approved in conversation; implementation plan pending written-spec review

## Problem

Suijin topic children must pause for human review before Facebook Writer starts.
The observed live run violated that contract: topic children had no
`request_confirmation` interactions and were assigned directly to downstream
agents.

Read-only inspection of the live default instance showed:

- `SUI-3` through `SUI-7` had no issue interactions.
- Several children were already assigned to Facebook Writer, Image Agent, or
  Facebook Publisher.
- The installed Task Agent instructions referenced
  `create-reviewed-topic-tasks` and the required gate.
- The Task Agent persisted `adapterConfig.paperclipSkillSync` without
  `desiredSkills`.
- The company skill was present as `available` but had `desired: false` for
  the Task Agent and Facebook Writer.

The package skill itself already describes the intended gate, so the primary
failure boundary is skill synchronization during import/runtime setup, with a
defensive downstream check still required.

## Goals

1. Make imported agent `skills:` declarations authoritative for runtime skill
   synchronization.
2. Ensure Task Agent creates topic children in a human-review state before any
   Facebook Writer assignment.
3. Permit the Writer handoff only after an exact, human-authored approval
   comment.
4. Prevent downstream agents from acting when the topic gate is absent or
   unresolved.
5. Provide a safe reconciliation path for the currently imported Suijin
   company after active runs reach a safe boundary.
6. Preserve the currently running issue and avoid live provider calls during
   implementation and verification.

## Non-goals

- Do not cancel, reassign, pause, or mutate the currently active issue runs as
  part of this change.
- Do not add Suijin-specific Paperclip routes or a second approval state
  machine.
- Do not publish to Facebook or call Tavily, Kie, or Noto during verification.
- Do not bypass Paperclip interactions, assignments, or audit logging.

## Design

### 1. Import and runtime skill contract

The company portability importer maps each agent's declared skill reference to
its imported company-scoped skill key, for example:

```text
company/<company-id>/create-reviewed-topic-tasks
```

It persists the resolved keys in:

```json
{
  "paperclipSkillSync": {
    "desiredSkills": ["company/<company-id>/create-reviewed-topic-tasks"]
  }
}
```

The adapter's normal skill-sync path must materialize the desired skill before
the agent's next heartbeat. A skill that is merely listed as `available` is
not sufficient.

The implementation must first verify whether the current source importer path
already contains this behavior and whether the observed instance predates it.
If the source path is missing or loses the value during persistence, fix that
source path. If the source is correct, add an explicit import/reconciliation
operation and restart/reimport instructions rather than changing the live
issue.

### 2. Topic child lifecycle

For every valid numbered research result, Task Agent must:

1. Reuse an existing child identified by `Research result: N`, or create one.
2. Assign the child to Task Agent, never Facebook Writer.
3. Create a `request_confirmation` interaction first with the existing
   idempotency and supersession rules.
4. Patch the child to `in_review` only after the interaction exists.
5. Leave a comment identifying the human decision required.

Until the gate resolves, the child remains in review and no writer handoff is
permitted.

On a human-authored comment whose trimmed body exactly equals one of
`Approved`, `Agree`, `Đồng ý`, or `Duyệt` (case-insensitive), Task Agent may
atomically set the child to `todo` and assign Facebook Writer. Any other human
comment is feedback: the child remains `in_review`, requested changes are
applied, and a fresh confirmation is created. Agent-authored comments never
approve a topic.

### 3. Defensive Writer boundary

Facebook Writer must validate the topic child before writing:

- The child has a resolved topic gate.
- The latest gate outcome is an accepted human approval.
- The required topic, rationale, sources, language, and Page fields exist.

If any prerequisite is missing or ambiguous, Writer leaves a visible blocker
with the owner and action, does not write `facebook-post`, and does not assign
Image Agent.

This check is defense in depth; it does not replace the Task Agent gate.

### 4. Current-company reconciliation

No reconciliation runs while the current Suijin issues have active execution
runs. After a safe boundary is reached:

1. Read-only audit all five agents' persisted skill preferences.
2. Sync the package-declared company skill keys to the corresponding agents.
3. Verify the resulting skill snapshots show `desired: true` and a usable
   runtime state.
4. Leave existing issue statuses and assignments unchanged unless the board
   separately authorizes a recovery action.
5. Start a fresh controlled test issue only after the runtime gate is verified.

Existing downstream work that already bypassed the topic gate is not silently
retroactively approved. It is surfaced for board disposition.

## Verification strategy

- Add a portability regression test proving packaged agent skills become
  resolved `paperclipSkillSync.desiredSkills` after import.
- Add a focused package contract test proving the interaction-before-review,
  Task-Agent-only initial assignment, exact human approval, and feedback paths.
- Add a defensive Writer contract test proving unresolved or agent-authored
  approval cannot start writing.
- Run the relevant server tests and Suijin contract test.
- Run an isolated import smoke test and inspect persisted agent skill snapshots.
- Do not run live external providers or Facebook publication.

## Acceptance criteria

- A newly imported Suijin Task Agent has the topic-gate skill in
  `desiredSkills` and the runtime can materialize it.
- A newly researched topic child is visibly `in_review` with a pending
  confirmation before Writer assignment.
- The child is assigned to Facebook Writer only after an exact human approval
  comment.
- Feedback and non-exact comments do not advance the pipeline.
- Writer cannot proceed without a verified topic approval.
- The current running issue remains uninterrupted during implementation.
- Tests and isolated import verification demonstrate the behavior without live
  provider mutation.
