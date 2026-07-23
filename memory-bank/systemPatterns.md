# System Patterns

## Architecture

Paperclip is a TypeScript/ESM monorepo with an Express REST API, React/Vite
board UI, CLI, Drizzle/PostgreSQL persistence, adapters, plugins, and
operational scripts. The main boundaries are:

- `server/`: API, auth, orchestration, scheduler, storage, secrets, plugins,
  and execution/workspace coordination.
- `ui/`: board pages, navigation, API clients, status surfaces, and Storybook.
- `cli/`: onboarding, configuration, diagnostics, context-aware control-plane
  operations, backups, secrets, and worktree workflows.
- `packages/db/`: schemas, migrations, database clients, and exports.
- `packages/shared/`: shared types, validators, constants, and API paths.
- `packages/adapters/`: built-in local, process/HTTP, OpenClaw, and utility
  adapter packages.
- `packages/plugins/`: plugin SDK/runtime, examples, namespaces, and provider
  integration.

## Durable invariants

- Every business entity is company-scoped and ownership is checked at route and
  service boundaries.
- An issue has at most one assignee; entering `in_progress` uses atomic
  checkout semantics and reports conflicts as `409`.
- Execution locks, run ownership, watchdog recovery, and approval gates remain
  explicit and visible.
- Monthly UTC budgets can soft-alert and hard-stop new checkout/invocation.
- Mutations are auditable through activity-log entries.
- The control plane and adapter-owned execution state are kept separate.
- Secrets are redacted and stored through secret-aware references/providers;
  raw keys and sensitive environment values must not leak into logs or exports.

## Extension pattern

Adapters and external integrations load through the plugin flow. Core server
and UI code must not hardcode external adapter imports. Adapter configuration
defines the runtime boundary; the core protocol must remain vendor-neutral.

## Workspace and recovery pattern

Issues may use project workspaces, execution workspaces, worktrees, runtime
services, environment leases, and adapter session state. Use the existing
execution and recovery semantics rather than creating parallel process or
state-machine implementations.
