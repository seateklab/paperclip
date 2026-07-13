# AGENTS.md

Guidance for human and AI contributors working in this repository.

## 1. Purpose

Paperclip is a control plane for AI-agent companies.
The current implementation target is V1 and is defined in `doc/SPEC-implementation.md`.

## 2. Read This First

Before making changes, read in this order:

1. `doc/GOAL.md`
2. `doc/PRODUCT.md`
3. `doc/SPEC-implementation.md`
4. `doc/DEVELOPING.md`
5. `doc/DATABASE.md`

`doc/SPEC.md` is long-horizon product context.
`doc/SPEC-implementation.md` is the concrete V1 build contract.
`CLAUDE.md` is the Claude-specific companion for this repo. It must stay aligned with this file and may not weaken any rule here.

## 3. Repo Map

- `server/`: Express REST API and orchestration services
- `ui/`: React + Vite board UI
- `packages/db/`: Drizzle schema, migrations, DB clients
- `packages/shared/`: shared types, constants, validators, API path constants
- `packages/adapters/`: agent adapter implementations (Claude, Codex, Cursor, etc.)
- `packages/adapter-utils/`: shared adapter utilities
- `packages/plugins/`: plugin system packages
- `doc/`: operational and product docs

## 3.1 Current Architecture Snapshot (Shipped Source Reality)

Paperclip in this repo is already more than the minimal CRUD baseline. The source currently implements a company-scoped control plane with these major runtime layers:

- `server/`: API, auth, orchestration, scheduler, plugin host, storage, secrets, portability/import-export, and runtime/workspace coordination
- `ui/`: board UI for dashboard, companies, issues, agents, org views, approvals, routines, costs, settings, plugins, and deployment/admin flows
- `cli/`: onboarding, doctor, configure, run, worktree, backup, secrets, issue/project/dashboard operations, and authenticated bootstrap flows
- `packages/adapters/*`: built-in local/session adapters, process/http adapters, OpenClaw gateway, and external adapter loading support
- `packages/plugins/*`: plugin SDK, plugin runtime pieces, and sandbox/provider integrations
- `packages/skills-catalog/`: shipped skill catalog manifest consumed by the app/CLI

## 3.2 Features Present In Source

When updating docs, planning work, or reviewing architecture, assume these capabilities already exist unless the task is explicitly about removing or replacing them:

- Multi-company control plane with hard company scoping
- Two deployment/auth modes: `local_trusted` and `authenticated` (`private` or `public` exposure)
- Board users, memberships, invites/join flows, instance roles, and Better Auth session-based human auth
- Agents with org-chart reporting, budgets, permissions, adapter config, runtime config, and API keys
- Built-in adapter families: process, HTTP, local CLI/session adapters (Claude, Codex, Gemini, OpenCode, Pi, Cursor family, etc.), OpenClaw gateway, plus external adapter plugins
- Issues/tasks with parent-child structure, comments, documents/revisions, attachments, work products, labels, blockers, approvals, inbox/read state, and activity logging
- Atomic checkout / execution lock semantics and explicit wakeup/heartbeat orchestration
- Cost tracking and budget enforcement with hard-stop auto-pause behavior
- Routines with schedule/API/webhook triggers and routine revisions/runs
- Execution workspaces, project workspaces, runtime services, and worktree-aware execution policies
- Secrets management with encrypted local storage, provider vault model, secret references, and strict mode
- Local disk and S3-compatible attachment/object storage
- Plugin runtime with plugin config/state/jobs/logs/webhooks and plugin DB namespaces/migrations
- Company import/export portability package support
- CLI and API support for backups, onboarding, health checks, and operational configuration

Important: `doc/SPEC-implementation.md` is still the V1 contract, but the codebase already contains several post-baseline systems that are real and should not be documented as "future" without checking the source first.

## 4. Dev Setup (Auto DB)

Use embedded PostgreSQL in dev by leaving `DATABASE_URL` unset.

```sh
pnpm install
pnpm dev
```

This starts:

- API: `http://localhost:3100`
- UI: `http://localhost:3100` (served by API server in dev middleware mode)

Quick checks:

```sh
curl http://localhost:3100/api/health
curl http://localhost:3100/api/companies
```

Reset local dev DB:

```sh
rm -rf ~/.paperclip/instances/default/db
pnpm dev
```

## 4.1 Production Deployment Baseline

Use the source-backed deployment model below when turning this repo into a production system:

1. Pick the correct runtime mode.
   - `authenticated/private`: private LAN/VPN/Tailscale deployments
   - `authenticated/public`: internet-facing deployments
   - `local_trusted` is for single-operator local use, not public production

2. Use external PostgreSQL for real production.
   - `authenticated/public` must not rely on embedded PostgreSQL
   - set `DATABASE_URL`
   - if runtime uses a pooled URL, also set `DATABASE_MIGRATION_URL` to a direct Postgres connection for startup migration/schema checks

3. Set the canonical public/auth URL and auth secret.
   - set `PAPERCLIP_PUBLIC_URL` for authenticated deployments
   - set `BETTER_AUTH_SECRET`
   - if you are behind a reverse proxy/load balancer, prefer loopback binding behind the proxy for public deployments

4. Choose storage based on topology.
   - `local_disk` is acceptable for single-machine deployments with persistent disk
   - for cloud or multi-node deployments, use `s3` storage (`PAPERCLIP_STORAGE_PROVIDER=s3` and related bucket/region settings)

5. Treat secrets and backups as part of the deployment, not an afterthought.
   - authenticated deployments should run with secrets strict mode enabled
   - if using `local_encrypted`, back up both the database and the secrets master key
   - if using local disk storage, back up attachment storage as well
   - enable and monitor DB backups

6. Persist the Paperclip instance root.
   - persist `PAPERCLIP_HOME` (or the equivalent mounted instance path) for config, storage, logs, workspaces, backups, and local secrets material

7. Prefer the documented deployment paths already present in the repo.
   - Docker / Compose: `Dockerfile`, `docker/docker-compose.yml`, `doc/DOCKER.md`
   - Podman Quadlet: `docker/quadlet/*`
   - AWS ECS Fargate reference: `docs/deploy/aws-ecs.md`
   - deployment references: `docs/deploy/overview.md`, `docs/deploy/environment-variables.md`, `docs/deploy/database.md`, `docs/deploy/storage.md`, `docs/deploy/secrets.md`

8. Validate the deployment with real health and startup checks.
   - `GET /api/health`
   - verify plugin loader startup, DB connectivity, auth flow, and attachment storage
   - verify first-admin/bootstrap flow for authenticated installs before handing the instance to users

## 5. Core Engineering Rules

1. Keep changes company-scoped.
Every domain entity should be scoped to a company and company boundaries must be enforced in routes/services.

2. Keep contracts synchronized.
If you change schema/API behavior, update all impacted layers:
- `packages/db` schema and exports
- `packages/shared` types/constants/validators
- `server` routes/services
- `ui` API clients and pages

3. Preserve control-plane invariants.
- Single-assignee task model
- Atomic issue checkout semantics
- Approval gates for governed actions
- Budget hard-stop auto-pause behavior
- Activity logging for mutating actions

4. Do not replace strategic docs wholesale unless asked.
Prefer additive updates. Keep `doc/SPEC.md` and `doc/SPEC-implementation.md` aligned.

5. Keep repo plan docs dated and centralized.
When you are creating a plan file in the repository itself, new plan documents belong in `doc/plans/` and should use `YYYY-MM-DD-slug.md` filenames. This does not replace Paperclip issue planning: if a Paperclip issue asks for a plan, update the issue `plan` document per the `paperclip` skill instead of creating a repo markdown file.

6. Attach inspectable generated artifacts.
When your task produces a user-inspectable file, follow the Paperclip skill's "Generated Artifacts and Work Products" workflow before final disposition. In this repo, prefer the self-contained skill helper at `skills/paperclip/scripts/paperclip-upload-artifact.sh` so the file is available through the Paperclip API, create/update an artifact work product when the file is the deliverable, link the uploaded artifact in the final issue comment, and then set status. Do not rely on local filesystem paths as the only access path. See `doc/AGENT-ARTIFACTS.md` for `.mp4` and `.webm` examples.

## 6. Database Change Workflow

When changing data model:

1. Edit `packages/db/src/schema/*.ts`
2. Ensure new tables are exported from `packages/db/src/schema/index.ts`
3. Generate migration:

```sh
pnpm db:generate
```

4. Validate compile:

```sh
pnpm -r typecheck
```

Notes:
- `packages/db/drizzle.config.ts` reads compiled schema from `dist/schema/*.js`
- `pnpm db:generate` compiles `packages/db` first

## 7. Verification Before Hand-off

Default local/agent test path:

```sh
pnpm test
```

This is the cheap default and only runs the Vitest suite. Browser suites stay opt-in:

```sh
pnpm test:e2e
pnpm test:release-smoke
```

Run the browser suites only when your change touches them or when you are explicitly verifying CI/release flows.

For normal issue work, run the smallest relevant verification first. Do not default to repo-wide typecheck/build/test on every heartbeat when a narrower check is enough to prove the change.

Run this full check before claiming repo work done in a PR-ready hand-off, or when the change scope is broad enough that targeted checks are not sufficient:

```sh
pnpm -r typecheck
pnpm test:run
pnpm build
```

If anything cannot be run, explicitly report what was not run and why.

## 8. API and Auth Expectations

- Base path: `/api`
- Board access is treated as full-control operator context
- Agent access uses bearer API keys (`agent_api_keys`), hashed at rest
- Agent keys must not access other companies

When adding endpoints:

- apply company access checks
- enforce actor permissions (board vs agent)
- write activity log entries for mutations
- return consistent HTTP errors (`400/401/403/404/409/422/500`)

## 9. UI Expectations

- Keep routes and nav aligned with available API surface
- Use company selection context for company-scoped pages
- Surface failures clearly; do not silently ignore API errors

## 10. Pull Request Requirements

When creating a pull request (via `gh pr create` or any other method), you **must** read and fill in every section of [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md). Do not craft ad-hoc PR bodies — use the template as the structure for your PR description. Required sections:

- **Thinking Path** — trace reasoning from project context to this change (see `CONTRIBUTING.md` for examples)
- **What Changed** — bullet list of concrete changes
- **Verification** — how a reviewer can confirm it works
- **Risks** — what could go wrong
- **Model Used** — the AI model that produced or assisted with the change (provider, exact model ID, context window, capabilities). Write "None — human-authored" if no AI was used.
- **Checklist** — all items checked

## 11. Vibecoding File Safety

- Back up any existing file in the same directory before editing it.
- If backup creation fails, stop and do not edit.
- Use `.orig` or a timestamped `.orig.YYYYMMDD-HHMMSS` suffix; never overwrite an existing backup.

## 12. Definition of Done

A change is done when all are true:

1. Behavior matches `doc/SPEC-implementation.md`
2. Typecheck, tests, and build pass
3. Contracts are synced across db/shared/server/ui
4. Docs updated when behavior or commands change
5. PR description follows the [PR template](.github/PULL_REQUEST_TEMPLATE.md) with all sections filled in (including Model Used)

## 13. Fork-Specific: HenkDz/paperclip

This is a fork of `paperclipai/paperclip` with QoL patches and an **external-only** Hermes adapter story on branch `feat/externalize-hermes-adapter` ([tree](https://github.com/HenkDz/paperclip/tree/feat/externalize-hermes-adapter)).

### Branch Strategy

- `feat/externalize-hermes-adapter` → core has **no** `hermes-paperclip-adapter` dependency and **no** built-in `hermes_local` registration. Install Hermes via the Adapter Plugin manager (`@henkey/hermes-paperclip-adapter` or a `file:` path).
- Older fork branches may still document built-in Hermes; treat this file as authoritative for the externalize branch.

### Hermes (plugin only)

- Register through **Board → Adapter manager** (same as Droid). Type remains `hermes_local` once the package is loaded.
- UI uses generic **config-schema** + **ui-parser.js** from the package — no Hermes imports in `server/` or `ui/` source.
- Optional: `file:` entry in `~/.paperclip/adapter-plugins.json` for local dev of the adapter repo.

### Local Dev

- Fork runs on port 3101+ (auto-detects if 3100 is taken by upstream instance)
- `npx vite build` hangs on NTFS — use `node node_modules/vite/bin/vite.js build` instead
- Server startup from NTFS takes 30-60s — don't assume failure immediately
- Kill ALL paperclip processes before starting: `pkill -f "paperclip"; pkill -f "tsx.*index.ts"`
- Vite cache survives `rm -rf dist` — delete both: `rm -rf ui/dist ui/node_modules/.vite`

### Fork QoL Patches (not in upstream)

These are local modifications in the fork's UI. If re-copying source, these must be re-applied:

1. **stderr_group** — amber accordion for MCP init noise in `RunTranscriptView.tsx`
2. **tool_group** — accordion for consecutive non-terminal tools (write, read, search, browser)
3. **Dashboard excerpt** — `LatestRunCard` strips markdown, shows first 3 lines/280 chars

### Plugin System

PR #2218 (`feat/external-adapter-phase1`) adds external adapter support. See root `AGENTS.md` for full details.

- Adapters can be loaded as external plugins via `~/.paperclip/adapter-plugins.json`
- The plugin-loader should have ZERO hardcoded adapter imports — pure dynamic loading
- `createServerAdapter()` must include ALL optional fields (especially `detectModel`)
- Built-in UI adapters can shadow external plugin parsers — remove built-in when fully externalizing
- Reference external adapters: Hermes (`@henkey/hermes-paperclip-adapter` or `file:`) and Droid (npm)
