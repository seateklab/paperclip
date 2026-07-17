# [TASK005] - Memory Bank and Cognito Content Remediation

**Status:** Completed
**Added:** 2026-07-14
**Updated:** 2026-07-14
**Implementation:** complete
**Validation:** passed
**Activation/follow-up:** not_required

## Source of truth

Execution followed
[`docs/superpowers/plans/2026-07-14-memory-bank-and-package-remediation.md`](../../docs/superpowers/plans/2026-07-14-memory-bank-and-package-remediation.md),
which implements the reviewed
[`design specification`](../../docs/superpowers/specs/2026-07-14-memory-bank-remediation-design.md).

## Delivered

- Added portable `idle | paused` agent status to the shared manifest contract,
  validation, sidecar export/parser, new-agent import, and replacement import.
- Added focused coverage for paused round trips, idle compatibility,
  replacement, and unsupported state rejection.
- Corrected Cognito Content work-product contracts and encoded the Facebook
  publisher as paused.
- Rebuilt the ZIP from filtered source and verified exact inventory parity,
  sidecar state, backup exclusion, and content contracts.
- Added the memory-bank operating guide, ignored archival backups, reduced
  historical tasks to durable records, and synchronized navigation/state.

## Verification

- Company portability: 49 focused tests passed.
- Affected shared and server TypeScript projects passed direct no-emit checks.
- Cognito ZIP: all 15 entries matched filtered source; sidecar and review-state
  checks passed.
- Memory bank: all 13 live files passed sensitivity/staleness and relative-link
  checks.
- `git diff --check` passed.

The repository-wide recursive typecheck command could not run because the only
available pnpm executable was a different major version that attempted an
interactive dependency purge. Dependencies and the lockfile were left
untouched; equivalent checks were run directly for both affected workspaces.

## Safety outcome

No server or dev command was run. Existing unrelated worktree changes were not
modified, and no files were staged or committed.
