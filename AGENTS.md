# AGENTS.md

Guidance for human and AI contributors working in this repository.

## 1. Mission and instruction hierarchy

Paperclip is the control plane for autonomous AI companies. It organizes
companies, goals, agents, issues, approvals, costs, execution, and human
governance while adapters run agents in external execution environments.

This file is the root operating guide for coding agents. Read the nearest
nested AGENTS.md too when working below a directory that contains one. The
repository's source-of-truth hierarchy is:

Direct user instructions and higher-priority environment or policy instructions
take precedence over this file.

1. This file defines agent operating rules and repository safety expectations.
2. doc/SPEC-implementation.md is the concrete V1 behavior contract.
3. doc/DEVELOPING.md, doc/DATABASE.md, doc/CLI.md, and docs/deploy/* contain
   detailed operational procedures.
4. Current source code, package scripts, and CI workflows define shipped
   behavior and valid command names.
5. doc/SPEC.md is long-horizon product context; it does not override the V1
   implementation contract.

CLAUDE.md is the Claude-specific companion for this repository. It must remain
aligned with this file and may not weaken any rule here.

Before making changes, read these documents in order:

1. doc/GOAL.md
2. doc/PRODUCT.md
3. doc/SPEC-implementation.md
4. doc/DEVELOPING.md
5. doc/DATABASE.md

Use the section map below to jump to the relevant operational guidance:

- Setup and development: section 4
- Tests and verification: section 5
- Code and repository conventions: section 6
- Architecture and cross-layer contracts: section 7
- Database changes: section 8
- API, auth, and security: section 9
- UI, adapters, and plugins: section 10
- Deployment and operations: section 11
- Troubleshooting: section 12
- Artifacts, plans, and pull requests: sections 13-15
- Fork-specific Hermes and QoL rules: section 16

## 2. Fast path for agents

Before editing:

1. Confirm the working directory and inspect git status.
2. Read the required documents above and any nearer nested AGENTS.md.
3. Identify every impacted contract: database, shared types, server, UI, CLI,
   adapters, plugins, docs, and tests.
4. Keep the change company-scoped and preserve the invariants in section 7.
5. Back up any existing file in the same directory before editing it. Use a
   unique .orig or .orig.YYYYMMDD-HHMMSS suffix. If backup creation or
   verification fails, stop and do not edit the source file.

During implementation:

- Prefer the smallest change that fully solves the requested problem.
- Follow existing package patterns and scripts; do not invent a formatter or
  lint command when the repository does not provide one.
- Update all affected contract layers together.
- Keep failures visible. Do not silently swallow API, background-run, or UI
  errors.
- Do not make unrelated refactors, dependency upgrades, lockfile changes, or
  product-scope decisions.

Before handoff:

- Run the narrowest relevant checks first.
- Run the full handoff checks for broad or PR-ready changes.
- Review the complete diff and run git diff --check.
- Report checks that could not run and why.
- Attach inspectable generated artifacts through the Paperclip work-product
  flow when the task produces one.

## 3. Project overview and monorepo map

Paperclip is a company-scoped control plane with a React board UI, an
Express REST API, a CLI, Drizzle/PostgreSQL persistence, local and external
agent adapters, a plugin runtime, and operational tooling.

Current workspace boundaries:

- server/: Express REST API, Better Auth integration, orchestration,
  scheduler, storage, secrets, portability, plugins, and runtime/workspace
  coordination.
- ui/: React/Vite board UI, dashboard, companies, issues, agents, org views,
  approvals, routines, costs, settings, plugins, deployment/admin flows, and
  Storybook.
- cli/: onboarding, doctor, configure, run, worktree, backup, secrets,
  issue/project/dashboard operations, and authenticated client operations.
- packages/db/: Drizzle schema, migrations, schema exports, DB clients, and
  database scripts.
- packages/shared/: shared types, constants, validators, and API path
  contracts.
- packages/adapters/*: built-in local/session, process/HTTP, OpenClaw, and
  adapter utility packages.
- packages/plugins/*: plugin SDK, runtime pieces, examples, database
  namespaces, and sandbox/provider integrations.
- packages/skills-catalog/: shipped catalog source, generated manifest,
  builder, validator, and package tests.
- scripts/: development runners, migration/backfill helpers, smoke tests,
  release checks, artifact helpers, and operational scripts.
- tests/: Playwright end-to-end and release-smoke suites.
- doc/: product, implementation, development, database, CLI, deployment,
  security, execution, artifact, and planning documentation.
- docs/: public-facing guides, company portability specifications, adapter
  references, and deployment references.

Source reality is ahead of the original minimal V1 milestone wording. Check
the current code before describing a shipped system as future work. The source
currently includes multi-company control, authenticated deployment, human
memberships, agent budgets and permissions, issue documents and work products,
execution workspaces, routines, secrets, storage providers, plugins,
portability, backups, and CLI/API operational flows.

## 4. Setup and development

### Prerequisites and install

- Node.js 20 or newer.
- pnpm 9 or newer; the root package pins pnpm 9.15.4.
- Leave DATABASE_URL unset for the zero-configuration embedded-PostgreSQL
  development path.

From the repository root:

~~~sh
pnpm install
pnpm dev
~~~

The API and dev-middleware UI normally use http://localhost:3100. The
development runner watches the server and workspace packages. Use the
non-watching command when needed:

~~~sh
pnpm dev:once
pnpm dev:list
pnpm dev:stop
~~~

The matching Paperclip runner is idempotent. Do not start duplicate servers
against the same instance or embedded database.

Useful first-run and UI commands:

~~~sh
pnpm paperclipai run
pnpm paperclipai doctor
pnpm storybook
pnpm build-storybook
~~~

The Storybook server uses port 6006 and writes static output to
ui/storybook-static/.

### Local database and storage

With DATABASE_URL unset, Paperclip starts embedded PostgreSQL under
~/.paperclip/instances/default/db and applies local migrations as supported.
The default local attachment provider is local_disk at
~/.paperclip/instances/default/data/storage.

Health checks after starting the server:

~~~sh
curl http://localhost:3100/api/health
curl http://localhost:3100/api/companies
~~~

The second endpoint requires the appropriate board context in authenticated
mode. Expected local-trusted health output is {"status":"ok"}.

For local database operations:

~~~sh
pnpm db:migrate
pnpm db:backup
pnpm paperclipai db:backup
pnpm paperclipai configure --section database
pnpm paperclipai configure --section storage
pnpm paperclipai configure --section secrets
~~~

Database backups do not include local-disk uploads, workspace files, or the
local encrypted secrets master key. Back up those paths separately when
disaster recovery matters.

### CLI and worktrees

The CLI entry point is:

~~~sh
pnpm paperclipai <command>
~~~

Set a CLI context once when using client operations:

~~~sh
pnpm paperclipai context set --api-base http://localhost:3100 --company-id <company-id>
pnpm paperclipai issue list
pnpm paperclipai dashboard get
~~~

Use the documented worktree commands when more than one Paperclip server is
running. Never point two servers at the same embedded PostgreSQL directory:

~~~sh
pnpm paperclipai worktree init
pnpm paperclipai worktree repair
pnpm paperclipai worktree reseed
pnpm paperclipai worktree env
pnpm paperclipai worktree:make paperclip-feature
~~~

Worktree instances isolate the server port, embedded PostgreSQL port, config,
database, workspaces, and copied runtime state. Seeded worktrees quarantine
copied live work by default; use preserve-live-work only when intentionally
resuming it.

### Authenticated/private development

Use the authenticated bind presets when validating private-network auth:

~~~sh
pnpm dev --bind lan
pnpm dev --bind tailnet
pnpm paperclipai auth bootstrap-ceo
pnpm paperclipai allowed-hostname <hostname>
~~~

On a fresh authenticated/private instance, sign in or create an account and
claim the first instance admin through the browser setup flow. The CLI
bootstrap command is the fallback. Legacy aliases --tailscale-auth and
--authenticated-private map to the older broad private-network behavior.

### Secrets and smoke workflows

Sensitive environment values should use secret references. Authenticated
deployments should enable strict mode:

~~~powershell
$env:PAPERCLIP_SECRETS_STRICT_MODE = 'true'
pnpm paperclipai configure --section secrets
pnpm secrets:migrate-inline-env
pnpm secrets:migrate-inline-env --apply
~~~

Run the OpenClaw join harness when changing invites, gateway onboarding,
agent-only joins, or wakeup callbacks:

~~~sh
pnpm smoke:openclaw-join
pnpm smoke:openclaw-docker-ui
~~~

Authenticated smoke runs may use PAPERCLIP_AUTH_HEADER or PAPERCLIP_COOKIE.
The Docker UI smoke defaults to an isolated OpenClaw state directory and
prints a host-browser URL.

### Windows and fork-specific local development

If the default Paperclip home is not writable on Windows, point it at a
writable directory before starting:

~~~powershell
$env:PAPERCLIP_HOME = 'D:\Workspace\paperclip\.paperclip'
pnpm dev
~~~

If Vietnamese or other non-ASCII text appears as ? or replacement characters,
use a UTF-8 terminal:

~~~powershell
chcp 65001
$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
~~~

The HenkDz fork uses port 3101 or the next available port when an upstream
Paperclip instance already owns 3100. On NTFS, use
node node_modules/vite/bin/vite.js build instead of npx vite build when the
Vite command hangs. Server startup from NTFS can take 30-60 seconds.

## 5. Testing and verification

Prefer the smallest check that proves the change. The root package does not
define a repository-wide lint or format script, so do not document or invoke
one as if it existed.

### Default and targeted Vitest checks

~~~sh
pnpm test
pnpm test:watch
pnpm test:run -- --dry-run
~~~

pnpm test runs the stable Vitest runner. The dry-run prints the selected
serialized suites without executing them. For a focused server test, use the
existing Vitest project configuration:

~~~sh
pnpm exec vitest run --project @paperclipai/server server/src/__tests__/health.test.ts
~~~

The CI-aligned grouped and serialized modes are:

~~~sh
pnpm test:run:general -- --group general-server
pnpm test:run:general -- --group general-workspaces-a
pnpm test:run:general -- --group general-workspaces-b
pnpm test:run:serialized -- --shard-index 0 --shard-count 4
~~~

### Typecheck and build

For a PR-ready or broad change:

~~~sh
pnpm -r typecheck
pnpm test:run
pnpm build
~~~

The build runs workspace builds after ensuring workspace package links. Do not
hand-edit package dist/ output.

### Browser and release suites

Browser suites are opt-in:

~~~sh
pnpm test:e2e
pnpm test:e2e:headed
pnpm test:e2e:multiuser-authenticated
pnpm test:release-smoke
pnpm test:release-smoke:headed
~~~

Run them when touching browser behavior, authenticated deployment, release
flows, or when explicitly validating CI/release behavior.

For every change, inspect the diff and run:

~~~sh
git diff --check
git status --short --branch
~~~

## 6. Code and repository conventions

### Cross-package contracts

- Use TypeScript and ES modules, following the nearest package's existing
  scripts, tsconfig, imports, and naming patterns.
- If an API or schema contract changes, update every impacted layer:
  packages/db, packages/shared, server, UI, CLI, adapters, plugins, tests,
  and documentation as applicable.
- Keep API path constants, validators, shared types, and serialized payloads
  synchronized. Do not duplicate contract definitions unnecessarily.
- Use package filters for focused work, for example:

~~~sh
pnpm --filter @paperclipai/skills-catalog validate
pnpm --filter @paperclipai/skills-catalog build:manifest
pnpm --filter @paperclipai/skills-catalog test
~~~

The skills catalog source lives under
packages/skills-catalog/catalog/{bundled,optional}/. Its checked-in generated
manifest is consumed by the server and CLI; they do not crawl repository paths
at request time. Regenerate the manifest after changing a catalog SKILL.md,
frontmatter, file inventory, category, or slug, and commit the generated
manifest with the source change.

### Server and API

- Keep route behavior aligned with the service layer and existing error
  semantics.
- Enforce actor permissions and company ownership at route/service boundaries.
- Every mutation must produce an activity-log entry unless an existing,
  documented exception applies.
- Do not return or log raw secret values, auth headers, API keys, or sensitive
  adapter environment values.
- Use the existing execution, checkout, wakeup, and recovery semantics rather
  than adding a second state machine.

### UI

- Use the existing Paperclip design system, component patterns, status and
  priority conventions, and Storybook setup.
- Use company selection context for company-scoped pages.
- Surface API and background-run failures clearly; never silently ignore them.
- Keep routes, navigation, API clients, and server endpoints aligned.
- For UI work, follow the repository design-guide/frontend conventions when
  those skills are available.

### Tests and generated outputs

- Add or update the narrowest relevant test for behavior changes.
- Route and authz suites may need serialized execution; use the stable runner
  modes instead of bypassing the repository's test isolation.
- Generate Drizzle migrations from schema source and export new tables from
  packages/db/src/schema/index.ts before running typecheck.
- Regenerate packages/skills-catalog/generated/catalog.json after catalog
  source, frontmatter, inventory, category, or slug changes.
- Treat build output, generated manifests, and migration journals as outputs
  of their source scripts.
- Do not commit pnpm-lock.yaml in an ordinary pull request. CI owns lockfile
  refreshes and validates dependency resolution.

## 7. Architecture and cross-layer contracts

### Company scoping

Every business entity belongs to exactly one company. Routes and services must
check the path company, resource ownership, linked-resource ownership, and
actor authorization before reading or mutating data. Agent API keys must never
access another company.

### Control-plane invariants

Preserve these invariants:

- An issue has at most one assignee.
- Transitioning an issue to in_progress uses atomic checkout semantics and
  returns a 409 conflict when another agent owns the claim.
- Execution locks, run ownership, and watchdog recovery remain explicit and
  visible.
- Approval gates remain authoritative for governed actions.
- Monthly UTC budgets provide soft alerts and hard-limit auto-pause behavior.
- A hard budget stop prevents new checkout or invocation until the board
  changes the budget or explicitly resumes the agent.
- Mutating actions are auditable in activity logs.
- Work remains company-visible to the board and in-company agents by default;
  deployment exposure flags are not project or issue privacy controls.

### Execution and workspaces

Paperclip orchestrates agents; adapters run them. Preserve the boundaries
between control-plane state and adapter-owned execution. Issues may use project
workspaces, execution workspaces, worktrees, runtime services, environment
leases, and adapter session state. Follow doc/execution-semantics.md and the
workspace policies in source rather than creating ad hoc process management.

### Adapters, plugins, and portability

- Built-in adapters include process, HTTP, local CLI/session families, and the
  OpenClaw gateway. External adapters load through the adapter/plugin flow.
- The plugin loader must remain dynamically loaded; core server and UI code
  must not hardcode external adapter imports.
- Adapter configuration defines the agent runtime boundary. Do not impose
  adapter-specific files such as SOUL.md, HEARTBEAT.md, or CLAUDE.md on the
  core protocol.
- Company import/export is markdown-first, vendor-neutral, and sidecar-aware.
  Export must not include secrets or environment-specific local paths.
- Generated artifacts that users need to inspect belong on the issue as an
  attachment and artifact work product.

## 8. Database changes

Paperclip uses PostgreSQL through Drizzle ORM. The default local mode uses
embedded PostgreSQL when DATABASE_URL is unset; external PostgreSQL is used
when it is set.

When changing the data model:

1. Edit the relevant schema in packages/db/src/schema/.
2. Export new tables from packages/db/src/schema/index.ts.
3. Generate the migration:

~~~sh
pnpm db:generate
~~~

4. Typecheck all workspaces:

~~~sh
pnpm -r typecheck
~~~

5. Apply pending migrations when the workflow requires it:

~~~sh
pnpm db:migrate
~~~

Migrations are the schema source of truth. Do not use destructive in-place
migrations for the V1 upgrade path. Keep all new tables and linked records
company-scoped and add ownership checks to routes/services.

For pooled production URLs, set DATABASE_MIGRATION_URL to a direct PostgreSQL
connection for startup schema checks and plugin namespace migrations while the
runtime continues to use DATABASE_URL.

Secret values are not inline application config. Local encrypted secrets
require both the database metadata and the secrets master key for restore.
Use secret references, strict mode, and the documented migration helper for
legacy inline environment values.

## 9. API, auth, and security

- API base path: /api.
- local_trusted is a single-operator trusted mode; it is not a public
  production security boundary.
- authenticated mode supports private or public exposure and uses Better Auth
  sessions for human board access.
- In local_trusted mode, board access is the full-control operator context.
  Authenticated deployments apply the current board membership and instance
  role checks.
- Agents use bearer API keys stored only as hashes. Plaintext keys are shown
  only at creation/claim time.
- Enforce company access on every entity fetch and mutation.
- Use consistent errors: 400 validation, 401 unauthenticated, 403
  unauthorized, 404 not found, 409 state conflict, 422 semantic rule
  violation, and 500 server error.
- Board sessions, agent keys, CLI auth challenges, invites, and plugin
  webhooks each have their own actor and ownership rules. Do not use a board
  shortcut for agent API access.
- Redact adapter_config secrets, auth headers, environment values, approval
  payload secrets, logs, activity details, and exported packages.
- Authenticated deployments should use strict secrets mode, a strong
  BETTER_AUTH_SECRET, and the canonical PAPERCLIP_PUBLIC_URL.
- PAPERCLIP_SECRETS_STRICT_MODE=true rejects new inline sensitive environment
  values such as *_API_KEY, *_TOKEN, and *_SECRET when they are not secret
  references.
- Apply CSRF protection and rate limits through the existing auth/key-management
  mechanisms; do not add a parallel auth implementation.

## 10. UI, adapters, and plugin-specific workflows

### UI expectations

Keep UI routes and navigation aligned with the API. Company-scoped pages should
use the company selection context. The board should expose pause/resume,
assignment, approval, budget, activity, and failed-run state clearly.

### Adapter development

Follow the adapter package's existing interface and tests. A server adapter
must provide all optional fields expected by the loader, especially detectModel
when the adapter contract requires it. Keep process cancellation, HTTP
timeouts, session state, environment merging, and callback behavior aligned
with the existing adapter utilities.

Local CLI/session adapters require their corresponding CLI or session setup on
the machine running Paperclip. If a CLI is missing, report the adapter error;
do not silently fall back to another runtime.

### Plugin development

Keep plugin configuration, state, jobs, logs, webhooks, database namespaces,
migrations, and company settings within the plugin runtime boundaries. Run
plugin SDK and example tests through their package scripts. External adapter
plugins must be installable without hardcoded imports in server/ or ui/.

## 11. Deployment and operations

Use the source-backed deployment references:

- Docker/Compose: Dockerfile, docker/docker-compose.yml, and doc/DOCKER.md.
- Podman: docker/quadlet/.
- AWS ECS reference: docs/deploy/aws-ecs.md.
- General deployment: docs/deploy/overview.md and docs/deploy/production.md.
- Environment variables: docs/deploy/environment-variables.md.
- Database: docs/deploy/database.md.
- Storage: docs/deploy/storage.md.
- Secrets: docs/deploy/secrets.md.

For authenticated/private or authenticated/public production:

1. Set PAPERCLIP_PUBLIC_URL and BETTER_AUTH_SECRET.
2. Use external PostgreSQL with DATABASE_URL. If the runtime URL is pooled,
   also set DATABASE_MIGRATION_URL to a direct connection.
3. Choose local_disk only for a single machine with persistent storage; use
   S3-compatible storage for cloud or multi-node topologies.
4. Persist PAPERCLIP_HOME for config, storage, logs, workspaces, backups, and
   local secret material.
5. Enable strict secrets mode and back up the database, attachment storage,
   and local encrypted master key as applicable.
6. Validate /api/health, database connectivity, auth/bootstrap, plugin
   loading, and attachment storage before handing the instance to users.

The canonical deployment modes are local_trusted and authenticated with
private/public exposure policy. Do not describe local_trusted as suitable for
an internet-facing deployment.

Company deletion is a development/debug capability and can be disabled with
PAPERCLIP_ENABLE_COMPANY_DELETION=false. Authenticated deployments disable it
by default; do not treat it as a production cleanup workflow.

## 12. Troubleshooting

### Dependency or workspace-link failures

Run pnpm install from the repository root. If a workspace package's built
dependency is missing, use the package's existing build/typecheck workflow
before inventing a symlink or local dependency override.

### Dev server and port state

~~~sh
pnpm dev:list
pnpm dev:stop
pnpm dev:once
~~~

Do not point two instances at one embedded database. In a linked git worktree,
run pnpm paperclipai worktree init first; pnpm dev intentionally fails fast
when required worktree metadata is missing.

### Local database reset

This is destructive and local-development-only. Confirm the target is the
intended default instance before running it:

~~~powershell
Remove-Item -Recurse -Force "$HOME\.paperclip\instances\default\db"
pnpm dev
~~~

For a permission failure, set PAPERCLIP_HOME to a writable path as described
in section 4. For full recovery, also restore local storage and the secrets
master key; a database dump alone is not a complete instance backup.

### Windows, encoding, and NTFS

Use a UTF-8 terminal when pasting non-ASCII issue/comment text. On the HenkDz
fork, Vite builds may hang through npx on NTFS; use
node node_modules/vite/bin/vite.js build. Give server startup 30-60 seconds
before declaring an NTFS launch failure.

### Missing adapter runtime

Check that the adapter's CLI/session is installed and on PATH on the machine
running Paperclip. A missing codex, claude, or other local runtime should
produce a clear adapter error and must not terminate the API server's unrelated
health or quota surfaces.

## 13. Artifacts, plans, and documentation

When a task produces a file for a board user or reviewer, attach it before
marking the task complete. Prefer the repository helper:

~~~sh
skills/paperclip/scripts/paperclip-upload-artifact.sh dist/demo.mp4 \
  --title "Demo video render" \
  --summary "MP4 render for board review"
~~~

The helper creates an issue attachment and artifact work product and prints
markdown links for the final issue comment. Follow doc/AGENT-ARTIFACTS.md for
video and other artifact-specific completion details. A local filesystem path
alone is not an inspectable handoff.

New repository plan documents belong in doc/plans/ and use
YYYY-MM-DD-slug.md names. Keep strategic docs additive and synchronized with
the implementation contract. If behavior or commands change, update the
impacted docs as part of the same change.

## 14. Git, file safety, and pull requests

Before editing an existing file:

1. Create a unique .orig or .orig.YYYYMMDD-HHMMSS backup in the same directory.
2. Verify the backup before editing.
3. Do not overwrite an existing backup.
4. Stop if backup creation or verification fails.

Pull requests must use .github/PULL_REQUEST_TEMPLATE.md in full. Fill every
section:

- Thinking Path
- What Changed
- Verification
- Risks
- Model Used, including provider, exact model ID/version, context window, and
  capabilities, or None - human-authored
- Checklist

Before a PR-ready handoff, run the smallest relevant checks and, for broad
changes, the full typecheck/test/build sequence from section 5. Include
screenshots or a short recording for visible UI/behavior changes when useful.
Address all CI and automated review findings. Do not commit pnpm-lock.yaml in
ordinary pull requests; lockfile refreshes are owned by CI.

The repository CI also checks that adapter/runtime code does not add git push
behavior. Do not add commands that push repositories from agent execution
code.

## 15. Definition of done

A repository change is done only when:

1. Behavior matches doc/SPEC-implementation.md.
2. Relevant typecheck, tests, and build checks pass, or any unavailable check
   is explicitly reported.
3. Contracts are synchronized across db/shared/server/ui/cli/adapters/plugins
   where the change touches them.
4. Docs and commands are updated when behavior changes.
5. Generated artifacts are attached through Paperclip when they are the
   deliverable.
6. Any pull request uses the complete PR template, including Model Used.
7. The final diff contains no unrelated files or whitespace errors.

## 16. Fork-specific guidance: HenkDz/paperclip

This is a fork of paperclipai/paperclip with QoL patches and an external-only
Hermes adapter story on branch feat/externalize-hermes-adapter:
https://github.com/HenkDz/paperclip/tree/feat/externalize-hermes-adapter

### Branch strategy

- feat/externalize-hermes-adapter: core has no hermes-paperclip-adapter
  dependency and no built-in hermes_local registration. Install Hermes via
  the Adapter Plugin manager using @henkey/hermes-paperclip-adapter or a
  file: path.
- Older fork branches may still document built-in Hermes. This section is
  authoritative for the externalize branch.

### Hermes is plugin-only

- Register Hermes through Board -> Adapter manager, the same flow as Droid.
  The adapter type remains hermes_local after the package loads.
- The UI uses the package's generic config-schema and ui-parser.js. There
  must be no Hermes imports in server/ or ui/ source.
- For local adapter development, a file: entry may be placed in
  ~/.paperclip/adapter-plugins.json.

### Local fork development

- The fork runs on port 3101 or the next available port when 3100 is taken.
- npx vite build may hang on NTFS. Use
  node node_modules/vite/bin/vite.js build instead.
- Server startup from NTFS may take 30-60 seconds.
- Before starting a local instance, stop matching Paperclip and tsx runners
  when they are yours and it is safe to do so. Do not kill unrelated user
  processes.
- If Vite cache survives a dist cleanup, remove both ui/dist and
  ui/node_modules/.vite before retrying.

### Fork QoL patches

If UI source is re-copied or reconciled with upstream, re-apply these fork
changes:

1. stderr_group: amber accordion for MCP init noise in RunTranscriptView.tsx.
2. tool_group: accordion for consecutive non-terminal tools such as write,
   read, search, and browser.
3. Dashboard excerpt: LatestRunCard strips markdown and shows the first three
   lines or 280 characters.

### Plugin system

- Adapters can be loaded as external plugins through
  ~/.paperclip/adapter-plugins.json.
- The plugin loader must have zero hardcoded adapter imports; use dynamic
  loading.
- createServerAdapter() must include every optional field expected by the
  server contract, especially detectModel.
- Built-in UI adapters can shadow external plugin parsers. Remove a built-in
  parser only when the adapter has been fully externalized.
- Reference external adapters are Hermes
  (@henkey/hermes-paperclip-adapter or a file: path) and Droid.
