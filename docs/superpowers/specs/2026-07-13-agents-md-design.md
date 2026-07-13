# Design: Improve the Root AGENTS.md

Date: 2026-07-13  
Status: Approved for implementation

## Context

The repository already has a substantial root `AGENTS.md`. It correctly captures
Paperclip's company-scoped control-plane invariants, deployment guidance, fork-
specific Hermes behavior, artifact handling, and contribution requirements. The
file is useful but mixes stable engineering rules, command reference material,
and fork notes in one long sequence. It also does not explicitly organize the
project around the generic AGENTS.md prompt's core needs: setup, development,
testing, code conventions, build/deployment, security, monorepo navigation, and
troubleshooting.

## Goals

- Make the root file a fast, actionable runbook for coding agents.
- Keep every command and rule grounded in the repository's current scripts,
  documentation, and CI workflows.
- Preserve all existing Paperclip control-plane invariants and the HenkDz fork's
  external-only Hermes guidance.
- Make package boundaries, validation levels, database changes, security rules,
  and PR expectations easy to find.
- Keep volatile details linked to their source-of-truth documents where possible
  so future updates are less likely to drift.

## Non-goals

- No application, API, schema, UI, adapter, or plugin behavior changes.
- No replacement of `doc/SPEC.md`, `doc/SPEC-implementation.md`, or other
  strategic documentation.
- No new nested `AGENTS.md` files.
- No invented repository-wide lint or formatting command; the root package does
  not currently define one.
- No removal of the existing artifact workflow, file-backup rule, or fork notes.

## Proposed document structure

1. Purpose, precedence, and required reading.
2. Project overview, architecture, monorepo map, and source-of-truth links.
3. Safe agent operating rules and file-editing expectations.
4. Setup and day-to-day development commands, including local database,
   worktree, CLI, Storybook, storage, and secrets workflows.
5. Verification matrix for targeted checks, full handoff checks, browser suites,
   release smoke, and `git diff --check`.
6. Code conventions for TypeScript, React/UI, server/API, Drizzle schema,
   tests, generated files, and package-scoped commands.
7. Cross-layer contracts: company scoping, auth, activity logging, issue
   checkout, budgets, adapters, plugins, and portability.
8. Database, API, security, deployment, and troubleshooting guidance.
9. Pull-request, artifact, branch, and completion requirements.
10. Existing HenkDz fork, Hermes, local-development, and plugin-system notes.

The implementation will reorganize and tighten the current file rather than
replace it with generic template text. Stable rules will remain in the file;
long command references will point to `doc/DEVELOPING.md`, `doc/CLI.md`,
`doc/DATABASE.md`, and the deployment docs.

## Implementation and validation

Before editing the existing root file, create a unique timestamped `.orig`
backup in the same directory. Apply the documentation changes with a focused
patch, then review the complete diff for accidental rule loss or stale commands.
Validate the result with repository-backed searches and `git diff --check`.
Because this is documentation-only, code tests are not required unless the
documentation change exposes a command or contract that needs a targeted
verification run.

## Risks and mitigations

- **Documentation drift:** link volatile procedures to their canonical docs and
  verify commands against `package.json` and CI.
- **Accidental loss of fork policy:** retain the current fork-specific section
  and compare it directly in the diff.
- **Overly long instructions:** keep the root file navigable, prefer concise
  rules and command tables, and avoid copying full product specifications.
