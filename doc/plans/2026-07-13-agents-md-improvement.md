# Root AGENTS.md Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the existing root `AGENTS.md` into a concise, source-backed runbook that helps coding agents set up, change, test, secure, and hand off work in Paperclip without losing fork-specific guidance or control-plane invariants.

**Architecture:** This is a documentation-only change centered on one instruction file, `D:\Paperclip\AGENTS.md`. The file will remain the single root guide, with links to canonical product, development, database, CLI, and deployment documents instead of copying their full contents. The existing HenkDz fork, external-only Hermes, artifact, file-backup, and company-scoping rules remain authoritative.

**Tech Stack:** Markdown, pnpm 9.15.4, Node.js 20+, PowerShell/Git validation, Paperclip's existing Vitest/Playwright scripts. No application dependencies or runtime code changes.

## Global Constraints

- Read and preserve the repository's required source order: `doc/GOAL.md`, `doc/PRODUCT.md`, `doc/SPEC-implementation.md`, `doc/DEVELOPING.md`, and `doc/DATABASE.md`.
- Every business entity and route must remain company-scoped; agent API keys must not cross company boundaries.
- Preserve single-assignee issues, atomic checkout, approval gates, budget hard-stop auto-pause, and mutation activity logging.
- `DATABASE_URL` is optional for local development; when unset, Paperclip uses embedded PostgreSQL.
- Use Node.js 20+ and pnpm 9+; the root package pins pnpm 9.15.4.
- Do not introduce a repository-wide lint or formatting command; the current root package does not define one.
- Do not commit `pnpm-lock.yaml` in ordinary pull requests; CI owns lockfile refreshes.
- Back up `AGENTS.md` in the same directory before editing it; stop if the backup cannot be created and verified.
- New repository plan documents belong in `doc/plans/` and use `YYYY-MM-DD-slug.md` filenames.
- User-inspectable generated artifacts must use the Paperclip attachment/work-product workflow, not only a local filesystem path.
- Do not replace strategic docs wholesale or create nested instruction files for this task.

---

## File Map

- Modify: `D:\Paperclip\AGENTS.md` — root coding-agent instructions and operational runbook.
- Create: `D:\Paperclip\doc\plans\2026-07-13-agents-md-improvement.md` — this implementation plan.
- Create at execution time: `D:\Paperclip\AGENTS.md.orig.YYYYMMDD-HHMMSS` — verified pre-edit safety backup; do not overwrite an existing backup.
- Read for validation: `package.json`, `doc/DEVELOPING.md`, `doc/DATABASE.md`, `doc/CLI.md`, `.github/workflows/pr.yml`, and the deployment references under `docs/deploy/`.
- No application source, schema, migration, test, UI, adapter, plugin, or lockfile files should change.

## Task 1: Establish a safe baseline and backup

**Files:**
- Read: `D:\Paperclip\AGENTS.md`
- Create: `D:\Paperclip\AGENTS.md.orig.YYYYMMDD-HHMMSS`

**Interfaces:**
- Consumes: the clean working tree and current root instruction file.
- Produces: a byte-for-byte backup path that can be used to restore the pre-edit file if the patch is wrong.

- [ ] **Step 1: Confirm the baseline is clean and identify the current commit**

  Run from `D:\Paperclip`:

  ```powershell
  git status --short --branch
  git log -2 --oneline --decorate
  git diff --exit-code -- AGENTS.md
  ```

  Expected: the branch is reported, the approved design commit is present, and `git diff --exit-code -- AGENTS.md` exits successfully before editing.

- [ ] **Step 2: Create a unique backup and verify it**

  Run from `D:\Paperclip`:

  ```powershell
  $source = (Resolve-Path -LiteralPath 'AGENTS.md').Path
  $backup = Join-Path (Split-Path -Parent $source) ('AGENTS.md.orig.' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
  if (Test-Path -LiteralPath $backup) { throw "Refusing to overwrite existing backup: $backup" }
  Copy-Item -LiteralPath $source -Destination $backup -ErrorAction Stop
  if ((Get-FileHash -LiteralPath $source).Hash -ne (Get-FileHash -LiteralPath $backup).Hash) {
    throw "Backup verification failed: $backup"
  }
  $backup
  ```

  Expected: one new timestamped `.orig` file is printed and its hash matches `AGENTS.md`. If any command fails, stop before applying the documentation patch.

## Task 2: Refactor the root AGENTS.md into an actionable runbook

**Files:**
- Modify: `D:\Paperclip\AGENTS.md`

**Interfaces:**
- Consumes: the approved design in `D:\Paperclip\docs\superpowers\specs\2026-07-13-agents-md-design.md`, the existing `AGENTS.md`, and the source-backed command/documentation files listed in the file map.
- Produces: one root instruction file whose commands and rules match the current repository.

- [ ] **Step 1: Establish the document's navigation and source-of-truth contract**

  Keep the opening purpose statement, then add an explicit hierarchy:

  1. `AGENTS.md` supplies agent operating rules for this repository.
  2. `doc/SPEC-implementation.md` controls V1 behavior when product documents disagree.
  3. `doc/DEVELOPING.md`, `doc/DATABASE.md`, `doc/CLI.md`, and `docs/deploy/*` supply detailed operational procedures.
  4. Current source and package scripts are authoritative for shipped behavior and command names.
  5. A nearer nested `AGENTS.md`, when present under a working directory, must also be inspected and obeyed for that subtree.

  Preserve the required reading order and add a compact table of contents-style section map so an agent can jump directly to setup, tests, conventions, contracts, or deployment.

- [ ] **Step 2: Reorganize the project overview and monorepo map**

  Keep the Paperclip control-plane description and add the current workspace boundaries:

  - `server/`: Express REST API, auth, orchestration, scheduler, storage, secrets, plugins, portability, and runtime/workspace coordination.
  - `ui/`: React/Vite board UI and Storybook.
  - `cli/`: onboarding, doctor, configure, run, worktree, backup, secrets, and authenticated client operations.
  - `packages/db/`: Drizzle schema, migrations, generated schema build, and DB clients.
  - `packages/shared/`: shared types, validators, constants, and API path contracts.
  - `packages/adapters/*`: built-in local/session, process/HTTP, OpenClaw, and adapter utility packages.
  - `packages/plugins/*`: plugin SDK, runtime, examples, and sandbox/provider integrations.
  - `packages/skills-catalog/`: catalog source, generated manifest, builder, and validator.
  - `scripts/`, `tests/`, `doc/`, and `docs/`: operational scripts, Vitest/Playwright suites, normative guidance, and deployment/product documentation.

  Keep the shipped-capability list, but make it clear that source reality may be ahead of the original V1 milestone wording. Link to the implementation spec rather than duplicating its full data model.

- [ ] **Step 3: Add a compact setup and development command reference**

  Document only verified commands and link to `doc/DEVELOPING.md` for long procedures. Include:

  ```sh
  pnpm install
  pnpm dev
  pnpm dev:once
  pnpm dev:list
  pnpm dev:stop
  pnpm storybook
  pnpm build-storybook
  pnpm paperclipai run
  pnpm paperclipai doctor
  pnpm paperclipai configure --section storage
  pnpm paperclipai configure --section secrets
  pnpm paperclipai worktree init
  pnpm paperclipai db:backup
  ```

  Explain that the normal dev server is on `http://localhost:3100`, `pnpm dev` watches workspace packages, `pnpm dev:once` avoids watching, and the UI is served by the API in dev middleware mode. Include the Windows writable-`PAPERCLIP_HOME` and UTF-8 notes, worktree isolation warning, and the fork's NTFS Vite/server-startup notes without duplicating the full worktree manual.

- [ ] **Step 4: Add a verification matrix that matches package scripts and CI**

  State that targeted checks are preferred for ordinary work and use this exact matrix:

  ```sh
  pnpm test
  pnpm test:watch
  pnpm test:run:general -- --group general-server
  pnpm test:run:serialized -- --shard-index 0 --shard-count 4
  pnpm -r typecheck
  pnpm build
  pnpm test:e2e
  pnpm test:e2e:multiuser-authenticated
  pnpm test:release-smoke
  ```

  Explain that `pnpm test` is the stable Vitest suite, browser tests are opt-in, the grouped/serialized runners mirror CI, and the release gate uses typecheck, tests, build, and browser checks as appropriate. Explicitly say there is no root `lint` script; do not tell agents to run a nonexistent formatter/linter.

- [ ] **Step 5: Add code and repository conventions**

  Add concise, actionable rules without inventing style tooling:

  - Use TypeScript/ES modules and follow the nearest package's existing scripts and patterns.
  - Keep shared API types, validators, constants, and path contracts synchronized across `packages/shared`, server routes/services, UI clients/pages, and CLI commands.
  - For React/UI work, use existing design-system/component patterns, company-selection context, visible error states, and the repository's Storybook conventions.
  - For server/API work, keep route handlers thin, enforce actor/company access at the route/service boundary, use consistent `400/401/403/404/409/422/500` errors, and log mutations.
  - For schema work, edit source schema and exports before generating migrations; never hand-edit generated `dist` output.
  - Add or update the narrowest relevant tests, using the stable runner's project/group/serialized modes when applicable.
  - Treat generated manifests and migration files as source-backed outputs; regenerate them with their package scripts when source changes.
  - Do not commit `pnpm-lock.yaml` in ordinary PRs.

- [ ] **Step 6: Consolidate cross-layer invariants, API/auth, and security guidance**

  Preserve and make easy to scan the current rules for:

  - hard `company_id` scoping for all business entities and linked-resource ownership checks;
  - single assignees, atomic issue checkout, execution locks, visible recovery, and approval gates;
  - monthly UTC budgets, soft alerts, hard-limit auto-pause, and no new checkout/invocation after a hard stop;
  - `local_trusted` versus authenticated private/public deployment modes;
  - board session access versus hashed agent bearer API keys;
  - secret references, redaction in configs/logs/activity, strict mode, encrypted local key backup, and no secret values in exports;
  - activity logging for mutations and no silent UI failures;
  - adapter/plugin boundaries, dynamic external adapter loading, and no hardcoded external adapter imports;
  - portable company import/export rules and generated artifact attachment/work-product handling.

  Keep the `/api` base path and representative endpoint/error semantics, but link to the implementation spec and CLI reference instead of attempting to list every current route.

- [ ] **Step 7: Clarify database, deployment, and troubleshooting workflows**

  Keep the exact database-change sequence:

  ```sh
  pnpm db:generate
  pnpm -r typecheck
  pnpm db:migrate
  ```

  Explain embedded PostgreSQL when `DATABASE_URL` is unset, external Postgres plus `DATABASE_MIGRATION_URL` for pooled production URLs, local disk versus S3 storage, persistent `PAPERCLIP_HOME`, and backup requirements for DB, attachments, workspaces, and the local secrets master key. Link to `doc/DATABASE.md`, `doc/DEVELOPING.md`, `docs/deploy/overview.md`, `docs/deploy/database.md`, `docs/deploy/storage.md`, and `docs/deploy/secrets.md`.

  Add a short troubleshooting section covering health checks (`/api/health`), stale dev runners, isolated worktrees, missing local adapter CLIs, embedded-Postgres permissions, UTF-8 terminal output, and the fork's NTFS/Vite startup behavior. Keep destructive reset commands clearly labeled as local-development-only.

- [ ] **Step 8: Preserve contribution, artifact, fork, and completion rules**

  Retain the current requirements for:

  - full `.github/PULL_REQUEST_TEMPLATE.md` sections, including Thinking Path, What Changed, Verification, Risks, Model Used, and Checklist;
  - screenshots/manual verification for visible changes and all required checks before a PR-ready handoff;
  - backing up files before edits and stopping if backup creation fails;
  - uploading inspectable generated artifacts through `skills/paperclip/scripts/paperclip-upload-artifact.sh` and linking the work product;
  - preserving the HenkDz fork's `feat/externalize-hermes-adapter` external-only Hermes model, plugin registration, generic UI parser, NTFS notes, and QoL patches;
  - the definition of done and the distinction between core behavior, plugins, and deferred roadmap work.

  Move these into clearly named sections if needed, but do not remove or weaken them.

## Task 3: Validate the documentation change

**Files:**
- Read: `D:\Paperclip\AGENTS.md`
- Read: `D:\Paperclip\package.json`
- Read: `D:\Paperclip\.github\workflows\pr.yml`
- Read: `D:\Paperclip\docs\superpowers\specs\2026-07-13-agents-md-design.md`

**Interfaces:**
- Consumes: the refactored `AGENTS.md` and the verified backup from Task 1.
- Produces: a reviewable diff with no whitespace errors, placeholders, or dropped fork-specific rules.

- [ ] **Step 1: Run structural and placeholder checks**

  Run:

  ```powershell
  Select-String -Path 'AGENTS.md' -Pattern 'TBD|TODO|FIXME'
  rg -n 'Project|Setup|Development|Testing|Code|Database|Security|Deployment|Troubleshooting|Pull Request|Hermes|Artifacts' AGENTS.md
  git diff --check -- AGENTS.md
  ```

  Expected: no placeholder matches, all required topic families are present, and `git diff --check` exits successfully.

- [ ] **Step 2: Verify commands and source links against the repository**

  Run:

  ```powershell
  rg -n 'pnpm (install|dev|dev:once|test|test:watch|test:run:general|test:run:serialized|typecheck|build|test:e2e|test:release-smoke|db:generate|db:migrate|paperclipai)' AGENTS.md
  rg -n '"(dev|test|test:watch|build|typecheck|test:e2e|test:release-smoke|db:generate|db:migrate|paperclipai)"' package.json
  Test-Path -LiteralPath 'doc/GOAL.md'
  Test-Path -LiteralPath 'doc/PRODUCT.md'
  Test-Path -LiteralPath 'doc/SPEC-implementation.md'
  Test-Path -LiteralPath 'doc/DEVELOPING.md'
  Test-Path -LiteralPath 'doc/DATABASE.md'
  ```

  Expected: every documented command is backed by a root script or linked operational guide, and every required source document exists.

- [ ] **Step 3: Review the complete diff and run the cheap repository test**

  Run:

  ```powershell
  git diff --stat
  git diff -- AGENTS.md
  pnpm test
  git status --short --branch
  ```

  Expected: the diff changes only the root guidance plus the plan/verified backup artifacts, the Vitest suite passes, and no source, schema, UI, adapter, plugin, or lockfile files changed.

## Task 4: Final handoff

**Files:**
- Review: `D:\Paperclip\AGENTS.md`
- Review: `D:\Paperclip\doc\plans\2026-07-13-agents-md-improvement.md`

**Interfaces:**
- Consumes: the validated documentation diff.
- Produces: a concise handoff naming the changed file, safety backup, validation commands, and any checks not run.

- [ ] **Step 1: Confirm the final working tree and backup**

  Run:

  ```powershell
  git status --short --branch
  Get-ChildItem -LiteralPath . -Filter 'AGENTS.md.orig.*' | Sort-Object Name | Select-Object -Last 3 Name,Length
  ```

  Expected: `AGENTS.md` and the dated plan are the intended changes, the backup exists, and unrelated user changes are untouched.

- [ ] **Step 2: Commit the documentation update if repository handoff uses commits**

  Stage only the plan and root instruction file; never stage the backup unless the repository already tracks safety backups:

  ```powershell
  git add -- AGENTS.md doc/plans/2026-07-13-agents-md-improvement.md
  git commit -m "docs: improve root agent guidance"
  ```

  Expected: one focused documentation commit containing no application code or lockfile changes. If the user wants an uncommitted handoff, leave the validated diff unstaged and report that choice explicitly.
