# Technical Context

## Stack

- Node.js 20 or newer
- pnpm 9 or newer (the root pins pnpm 9.15.4)
- TypeScript and ES modules
- Express server and React/Vite UI
- Drizzle ORM over PostgreSQL
- Embedded PostgreSQL when `DATABASE_URL` is unset

## Local development

From the repository root:

```sh
pnpm install
pnpm dev
```

The normal local API/UI address is `http://localhost:3100`. Use `pnpm dev:once`
for a non-watching run and `pnpm dev:list` / `pnpm dev:stop` for the managed
runner. Local embedded database, storage, logs, workspaces, backups, and the
encrypted secrets key live under the configured Paperclip instance home.

On Windows, set `PAPERCLIP_HOME` to a writable path if the default home is not
writable, and use a UTF-8 terminal for non-ASCII issue/comment text.

## Verification

Use the narrowest relevant checks first. Common checks are:

```sh
pnpm test
pnpm -r typecheck
pnpm test:run
pnpm build
git diff --check
git status --short --branch
```

The repository does not define a single lint/format script. Browser and release
tests are opt-in (`pnpm test:e2e`, `pnpm test:release-smoke`). Do not hand-edit
generated build output, migrations, or the skills catalog manifest.

## Database and secrets

Schema changes belong in `packages/db/src/schema/`, with exports and generated
Drizzle migrations kept synchronized. Local secret material uses the encrypted
provider and must be backed up together with its database metadata. Strict mode
requires sensitive environment values to use secret references.

## Fork notes

This workspace is governed by the HenkDz fork guidance in `AGENTS.md`. The
Hermes adapter is an external plugin concern on the documented externalize
branch; do not introduce built-in Hermes imports into core server or UI code.
