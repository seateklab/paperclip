# Memory Bank and Cognito Content Remediation Design

## Goal

Restore the Cognito Content package's documented contracts and make the shared
repository memory bank safe, navigable, and honest about validation status.

## Context

The audit found two coupled problems:

- The package documentation still contains `reviewState` values that are not
  accepted by Paperclip's shared validator. The parked Facebook publisher is
  also not declared paused in its import sidecar, and the current portability
  importer does not yet carry agent status from that sidecar, so adding the
  field only to the package would be misleading.
- The memory bank is unowned and difficult to navigate, contains historical
  backup copies beside live records, duplicates status across several files,
  and records machine-specific and credential-derived runtime metadata.

The repository's source-of-truth hierarchy remains authoritative: `AGENTS.md`,
the implementation specification and operational docs, current source/scripts,
and CI. The memory bank is a derivative, shared journal; it must not override
those sources or become a second runtime state store.

## Approaches considered

1. **Documentation-only cleanup.** Correct the current files and add a README,
   but leave package contracts and import configuration unchanged. This is
   insufficient because imported agents would still receive invalid values.
2. **Full contract and journal remediation (selected).** Correct every
   confirmed package contract, make `idle | paused` agent status portable
   through the shared manifest and import/export service, add the paused-agent
   sidecar state, remove sensitive/host-specific evidence from every live memory
   bank document, establish ownership and backup retention rules, convert the
   task index to links, reconcile statuses, regenerate the ZIP, and record the
   work in a new task. This fixes the current failure modes without leaving a
   sidecar field that the importer silently ignores.
3. **Move all history into Paperclip immediately.** Replace the memory bank
   with issue documents and work products. This better centralizes status but
   expands the work into runtime coordination and artifact migration that is
   not required to fix the current package.

## Selected design

### Package contract corrections

- Use only the shared review-state enum: `none`, `needs_board_review`,
  `approved`, or `changes_requested`.
- Represent a draft work product with `status: draft` and `reviewState: none`.
- Represent an approved article or published-link work product with
  `reviewState: approved`; publication is represented by the work-product
  content/type and active status, not a nonexistent `published` review state.
- Add `status: paused` for `fb-publisher` in `.paperclip.yaml` while the
  Facebook skill remains dormant. Portable agent status is deliberately limited
  to `idle` and `paused`: the exporter emits `paused` only for paused agents,
  omits transient statuses, and the importer starts all other imported agents
  idle with timer heartbeats disabled.
- Extend the portability contract end to end in
  `packages/shared/src/types/company-portability.ts` and
  `packages/shared/src/validators/company-portability.ts`: add the status field
  to `CompanyPortabilityAgentManifestEntry` and its Zod schema, parse and
  validate `agents.<slug>.status`, emit the portable status from
  `server/src/services/company-portability.ts`, and apply it on both create and
  replace/update imports. Unsupported status values fail import preview with a
  validation error instead of silently becoming `idle`. Cover the round trip
  in `server/src/__tests__/company-portability.test.ts`.
- Keep `FACEBOOK_PAGE_ID` as a required plain input and retain the existing
  explicit secret-binding workflow.

The portability implementation touches only
`packages/shared/src/types/company-portability.ts`,
`packages/shared/src/validators/company-portability.ts`,
`server/src/services/company-portability.ts`, and
`server/src/__tests__/company-portability.test.ts`. It does not change database
tables, routes, or the runtime agent-state model.

### Memory-bank contract

Add `memory-bank/README.md` defining:

- purpose and scope;
- authoritative repository sources;
- ownership and refresh triggers;
- active-vs-archival file rules;
- sensitivity rules forbidding secrets, credential fingerprints, UUID-heavy
  runtime snapshots, and user-specific absolute paths;
- the required new-task/update workflow.

The repository maintainer owns the live memory bank. The contributor who
completes a task updates its task record, `activeContext.md`, and `progress.md`
before handoff. Refresh is required when a task is created, its implementation
or validation state changes, a generated artifact is replaced, user feedback
changes the acceptance criteria, or work is handed to another contributor.

The sensitivity rule applies to every live Markdown file under `memory-bank/`.
Variable names such as `TAVILY_API_KEY` and generic secret-reference concepts
are allowed; raw values, hashes/fingerprints, UUIDs from runtime records,
absolute machine paths, auth headers, and local instance identifiers are not.

Ignore future `memory-bank/**/*.orig.*` backups in the repository while keeping
the live curated documents shareable. Existing backups remain available as
local archival evidence and are not treated as active context or scanned by the
validation checks. Do not delete or rewrite those backups.

Make the task index use relative Markdown links and separate implementation
completion from validation and future activation state. Audit every live file,
including `activeContext.md`, `progress.md`, `TASK003`, and `TASK004`, and
replace credential-derived or machine-specific evidence with durable
conclusions. Update the active context and progress summary to point to the new
remediation task and to report validation honestly. The index must link each
task with a relative path and record these states independently:

- implementation: pending, in_progress, completed, or abandoned;
- validation: not_run, pending, passed, or failed;
- activation/follow-up: not_applicable, pending_user, or complete.

### New task record

Create `TASK005-memory-bank-and-package-remediation.md` with the audit,
implementation checklist, affected files, validation commands, and remaining
follow-up. Its affected-file list must include the shared portability manifest
types/schema, `server/src/services/company-portability.ts`, the focused
portability test, the package source tree, the ZIP, and every live memory-bank
file changed by the audit. The record is the durable handoff for this change;
it must not copy secret values, secret hashes, runtime UUIDs, or absolute
machine paths.

### Validation

Run focused checks for invalid review-state values in both the package directory
and the ZIP, manifest/parser/import/export round-tripping of `paused`, rejected
unsupported agent statuses, sensitive metadata removal from every live memory
bank file (excluding `.orig.*`), task-index link targets, and independent task
status consistency. Then run:

```text
pnpm exec vitest run --project @paperclipai/server server/src/__tests__/company-portability.test.ts
pnpm -r typecheck
git diff --check
```

The ZIP check must inspect the archive itself, not only the source directory,
and must confirm that it contains exactly the portable company package files.
No database schema, route, UI, CLI, or generated skills-catalog manifest is
changed by this design; the portability service and shared manifest contract
are explicitly in scope.

## Error handling and safety

- Do not delete existing `.orig.*` files; treat them as archival files.
- Back up every existing file before editing it, verify the backup, and refuse
  to overwrite an existing backup.
- Do not record raw secrets, secret fingerprints, auth headers, or local
  instance identifiers in the live memory bank.
- Back up the existing `companies/cognito-content.zip` before replacing it,
  regenerate it from the corrected package directory, and inspect the archive
  contents and review-state/status scans before treating it as the deliverable.

## Out of scope

- Facebook activation or live publishing.
- Moving the entire memory bank into Paperclip issues.
- Database tables, REST routes, UI, CLI, adapter runtime behavior, and
  skills-catalog manifest changes.
- Dependency upgrades, lockfile changes, or unrelated refactoring.
