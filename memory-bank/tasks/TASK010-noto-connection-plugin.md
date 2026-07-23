# TASK010 — Noto Connection external plugin

- **Date:** 2026-07-20
- **Status:** in_progress
- **Owner:** Paperclip session work
- **Scope:** External worker-only plugin at `D:/seatek_tasks/Plugins/noto` for the Suijin Content company workflow.

## Goal

Provide a company-scoped Paperclip connector for Noto that can discover
connections, inspect one connection, list the functions advertised for a
connection, and execute a schema-valid provider function without exposing
credentials or provider-private response data.

## Implementation completed

- Scaffolded `@seatek/noto` as an external connector plugin using the local
  Paperclip plugin SDK.
- Resolved a Windows CLI scaffold issue where the Paperclip init command
  reported `spawnSync pnpm ENOENT`; the package was created through a local
  Node-based scaffold path instead.
- Replaced the obsolete discovery route with the deployed connector routes:
  - `GET /v1/connectors/connections`
  - `GET /v1/connectors/connections/{connectionId}`
  - `GET /v1/connectors/tools`
  - `POST /v1/connectors/connections/{connectionId}/execute`
- Updated response normalization for the deployed envelopes:
  - connection list from `data.connections`
  - connection detail from `data`
  - tools from `data.tools`
  - execution from root `success`, `output`, and `duration`
- Execution requests send `functionName` and optional `input` in the body;
  `connectionId` remains in the URL path.
- Requests send `x-api-key`, `x-client-id`, `x-workspace-id`, and configured
  `x-app-id`; secrets are resolved at invocation time through the host secret
  reference.
- Added recursive secret redaction for execution output and error messages.
- Added safe pre-call and completion activity entries. Execution does not
  start if the pre-call audit cannot be written.
- Classified transport, non-2xx, invalid JSON, and invalid execution-schema
  failures as ambiguous and intentionally does not retry because the current
  Noto contract exposes no execution ID, status lookup, or idempotency key.
- Kept the plugin worker-only: no UI bundle, server API routes, database,
  jobs, or webhooks were added.
- Added/updated package tests covering endpoint construction, headers, query
  filters, response envelopes, redaction, validation, audit ordering,
  definitive provider failures, and ambiguous execution failures.
- Updated the managed `noto` skill to require discovery, detail inspection,
  tool-schema inspection, and only schema-valid provider calls.

## Source and test artifacts

- `D:/seatek_tasks/Plugins/noto/src/noto-client.ts`
- `D:/seatek_tasks/Plugins/noto/src/contracts.ts`
- `D:/seatek_tasks/Plugins/noto/src/connection-module.ts`
- `D:/seatek_tasks/Plugins/noto/src/manifest.ts`
- `D:/seatek_tasks/Plugins/noto/src/worker.ts`
- `D:/seatek_tasks/Plugins/noto/skills/noto/SKILL.md`
- `D:/seatek_tasks/Plugins/noto/tests/noto-client.spec.ts`
- `D:/seatek_tasks/Plugins/noto/tests/noto-client-edge.spec.ts`
- `D:/seatek_tasks/Plugins/noto/tests/noto-client-security.spec.ts`
- `D:/seatek_tasks/Plugins/noto/tests/worker.spec.ts`
- `D:/seatek_tasks/Plugins/noto/tests/manifest.spec.ts`

## Validation completed

Fresh package verification passed after the final build:

```text
pnpm typecheck
pnpm test
pnpm build
```

Result: 6 test files passed, 27 tests passed, and the worker/manifest build
succeeded. The package has no lint script.

The running Paperclip instance was healthy on port 3100. The installed plugin
was first upgraded, then explicitly reinstalled without `--force` so existing
configuration was preserved:

```text
pnpm paperclipai plugin uninstall seatek.noto --json
pnpm paperclipai plugin install --local D:/seatek_tasks/Plugins/noto --json
```

The final installed state was `ready` with no `lastError`. Health diagnostics
returned HTTP 200 with all checks passing. Four namespaced tools were visible:

- `seatek.noto:list_connections`
- `seatek.noto:get_connection`
- `seatek.noto:list_connection_tools`
- `seatek.noto:execute_connection_function`

The Suijin Content company configuration contains `apiKeyRef`, `clientId`,
`workspaceId`, and `appId`. No secret values were written to memory.

## Live provider verification

Using the configured credentials in memory only, with no secret or Facebook
identity data displayed:

- Connection discovery returned HTTP 200 with one connected Facebook
  connection.
- Connection detail returned HTTP 200.
- Tool discovery returned HTTP 200 with one group and 43 functions.
- Safe read-only `FACEBOOK_GET_CURRENT_USER` execution returned HTTP 201 with
  root `success: true`, nested `successful: true`, output keys `data`,
  `successful`, `error`, and `log_id`, and duration 800 ms.

## Review findings and remaining work

The review confirmed that the nested `output.successful` field is provider
payload data; the Noto execution contract makes root `success` authoritative.
No nested-result change is required.

One configuration-contract gap remains: the available Noto OpenAPI documents
mark `x-app-id` as required, but the plugin's company schema and `readConfig`
currently treat `appId` as optional. The next code change should require
`appId` and always send `x-app-id`:

- `src/manifest.ts`
- `src/connection-module.ts`
- `src/noto-client.ts`
- corresponding manifest/worker tests

The Paperclip tool-dispatch endpoint could not complete an installed-plugin
operation because its run-scope guard rejected the historical run context with:

```text
403: "runContext.runId" does not belong to "runContext.companyId"
```

Paperclip's own heartbeat-run and agent APIs returned the same company and
agent ownership for that run, so this is an unresolved Paperclip run-context
validation problem. No new heartbeat was started merely to manufacture a test
run, and no provider mutation was attempted.

## Next action

Make `appId` required in the plugin configuration, add the regression coverage,
rebuild/reinstall, then retry the four installed-plugin operations with a
currently valid Paperclip agent run context. Preserve the no-secret/no-PII
logging rule and use only read-only Noto functions for live smoke tests.
