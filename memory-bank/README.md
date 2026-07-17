# Memory Bank Operating Guide

The memory bank is a durable project journal. It summarizes decisions, task
state, and verified outcomes; it is not a raw execution log or credential
store.

## Source hierarchy

When records disagree, use this order:

1. Current user instructions and repository `AGENTS.md` guidance.
2. The active executable implementation plan.
3. The active task record under `tasks/`.
4. `activeContext.md` for the immediate checkpoint and next action.
5. `progress.md` for the cross-task summary.
6. Historical task records for durable background only.

Repository implementation specifications and current source remain
authoritative for product behavior.

## Ownership and refresh triggers

The builder executing the active task owns memory-bank maintenance. Refresh the
bank when any of these events occurs:

- a task is created;
- an implementation plan is approved or execution starts;
- a material implementation checkpoint is reached;
- a validation command passes or fails;
- a blocker or durable decision changes the next action; or
- the task is handed off or completed.

Update only the files affected by the event. Keep `_index.md` navigational,
`activeContext.md` immediate, and `progress.md` concise.

## State dimensions

Each active task records four independent dimensions:

- **Task status:** pending, in progress, completed, blocked, or abandoned.
- **Implementation:** not_started, in_progress, complete, or not_applicable.
- **Validation:** not_run, passed, failed, blocked, or not_applicable.
- **Activation/follow-up:** not_required, pending_user, scheduled, complete, or
  not_applicable.

Do not use task completion to imply validation or activation.

## Archival backups

Same-directory `.orig` and `.orig.*` files are immutable local safety backups.
They are excluded from task navigation, live-memory searches, distributable
artifacts, and Git through `.gitignore`. Never edit an archival backup.

## Sensitivity policy

Record durable conclusions and relative repository references. Never retain:

- raw secrets, secret identifiers, fingerprints, keys, or auth headers;
- runtime UUIDs, database rows, or environment-specific state snapshots;
- commit hashes used only as transient evidence; or
- machine-specific absolute paths.

When evidence is sensitive or transient, record the verified conclusion and
the check category instead of the raw value.
