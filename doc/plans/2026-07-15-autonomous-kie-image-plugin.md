# KieAPI Image Plugin: Secret Resolution MVP

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` (or `superpowers:subagent-driven-development`) to implement this plan task by task. Keep the checkbox list current and stop at the stated MVP boundary.

**Goal:** Make the existing `@paperclipai/plugin-kie-image` able to read a KieAPI credential safely during a company-scoped `generate_image` invocation. The plugin package and its image-generation behavior are treated as already built; the blocker is the host refusing to resolve the company-bound secret reference.

**Architecture:** Keep one generic Paperclip plugin configuration system. Preserve the existing global `plugin_config` row for non-secret instance defaults, add company scope to that same table for company configuration, bind secret-reference paths through `company_secret_bindings`, and pass the already-existing invocation company scope through the worker RPC. Resolve plaintext only inside the one tool invocation that needs it. Do not add a second settings table and do not redesign the scheduler, webhook system, or plugin database.

**Tech stack:** TypeScript/ESM, Drizzle/PostgreSQL, Paperclip plugin SDK, Express routes, React/Vite UI, Vitest, pnpm 9.15.4.

## Global constraints

- This document is the source of truth for the Kie token-read fix. Do not implement the older broad “generic host prerequisite” plan that added a separate company-config table or rewired jobs and webhooks.
- The change must stay generic at the host boundary. Kie-specific code may declare its fields and call the SDK; it may not bypass the secret service or read an environment variable directly.
- Before editing an existing file, create and verify a unique same-directory `.orig` backup. Do not edit `pnpm-lock.yaml`.
- Secret values must never be persisted, returned by a config endpoint, placed in worker initialization data, logged, included in activity details, or interpolated into errors. A resolved value may exist only in the request stack for the outbound Kie call.
- All company reads and writes must check the route company, plugin id, selected secret ownership, and actor authorization. A company-A invocation must not read company-B configuration or bindings.
- Keep the current Windows worker-loader `file://` fix. This plan does not change process launching except for regression coverage.
- Use the smallest relevant checks after each task. At handoff run the checks in the final task and report any unavailable script instead of inventing one.

## Evidence and current state

The current Paperclip plugin specification says that plugins request `secrets.read-ref`, store secret references rather than plaintext, and resolve a value only at execution time. The current Paperclip company-scope design note says that plugin configuration must carry an explicit company id before a secret binding can be used. These are the constraints this MVP follows:

- [Paperclip plugin specification](https://github.com/paperclipai/paperclip/blob/master/doc/plugins/PLUGIN_SPEC.md)
- [Plugin secret references and company scope plan](https://github.com/paperclipai/paperclip/blob/master/doc/plans/2026-04-26-plugin-secret-ref-company-scope.md)

The checkout already contains:

- `packages/plugins/plugin-kie-image/` with the Kie client, manifest, worker, skill, UI, migrations, and package tests;
- `packages/db/src/schema/company_secret_bindings.ts`, which is the existing company-owned binding table;
- `PluginInvocationScope { companyId }` and worker-RPC scope propagation for tool `runContext`;
- a plugin secret handler that intentionally fails closed with “secret references are disabled until company-scoped plugin config lands”;
- a Kie client that already calls `ctx.secrets.resolve(ref, { configPath })`, although the restored SDK source currently exposes only the one-argument signature;
- stale ignored `dist/` output from an earlier experiment. Source and a clean build, not stale `dist/`, are authoritative.

Therefore the first release target is one secure agent-tool path, not a whole-app redesign.

## Explicit non-goals for this plan

The following remain follow-up work and must not be pulled into this fix:

- a new `plugin_company_config`/settings table;
- scheduler fan-out or generic company-aware job persistence;
- company-scoped webhook routing and callback delivery changes;
- durable Kie history, attachment persistence, or a new history page;
- provider retries, cost/credit guardrails, model expansion, or live Kie calls;
- replacing Paperclip’s existing secret picker with a raw-token field;
- changes to adapters, core agent protocols, or unrelated dependency upgrades.

The existing package code for jobs, webhooks, history, and attachments can remain in the repository, but those surfaces are not part of the acceptance criteria. They must fail closed rather than resolving a secret outside an explicit company invocation.

## Locked MVP behavior

1. The instance plugin config stores only non-secret defaults such as Kie base URL and polling values.
2. A company config stores `apiKeyRef` and optional `webhookHmacKeyRef` as UUID secret references, validated by the manifest’s `companyConfigSchema`.
3. The board saves that company config through a company-scoped route. Saving verifies that every referenced secret belongs to the selected company and replaces stale bindings atomically.
4. An agent calls the existing `generate_image` tool with a company-scoped `runContext`.
5. `ctx.config.get()` returns global defaults merged with that company’s config only for that invocation.
6. `ctx.secrets.resolve(ref, { configPath: "apiKeyRef" })` verifies the invocation company, capability, exact binding, plugin id, and config path before returning the plaintext value.
7. The Kie client sends one mocked/real request with an in-memory bearer value and immediately discards it. No confirmation step is introduced.
8. The same worker cannot resolve the reference from another company and cannot resolve any reference without scope.

## Implementation plan

### Task 1 - Lock the failing behavior with focused tests

**Files:**

- `server/src/__tests__/plugin-secrets-handler.test.ts`
- `server/src/__tests__/plugin-registry.test.ts` (create for the registry methods)
- `packages/plugins/sdk/tests/host-client-factory-company-scope.test.ts`
- `packages/plugins/plugin-kie-image/tests/kie-client.spec.ts`

**Steps:**

- [x] Add a server test proving the current handler rejects a secret reference without company scope; keep this test red only until the new contract is implemented.
- [x] Add a company-isolation test fixture with two companies, two secret ids, and two bindings. The expected result is that company A resolves only its own secret.
- [x] Add a config-RPC test that expects global defaults plus the selected company config for a scoped tool call and global defaults only outside scope.
- [x] Add a Kie client test that supplies a fake resolver, captures the fetch request, and asserts the bearer header is created from the resolver result without exposing that value in the returned DTO or error text.
- [x] Run the focused suites once and record the expected failures before implementation.

**Check:**

```powershell
pnpm exec vitest run --project @paperclipai/server server/src/__tests__/plugin-secrets-handler.test.ts server/src/__tests__/plugin-registry.test.ts
pnpm --filter @paperclipai/plugin-kie-image test -- tests/kie-client.spec.ts
```

Expected before implementation: the new tests fail for the missing company config/secret contract; unrelated existing tests remain green.

### Task 2 - Add company scope to the existing plugin-config contract

**Files:**

- `packages/db/src/schema/plugin_config.ts`
- `packages/db/src/schema/index.ts` (only if the schema export changes)
- `packages/shared/src/types/plugin.ts`
- `packages/shared/src/validators/plugin.ts`
- `packages/shared/src/types/index.ts` (only if required by the package exports)
- `packages/db/drizzle.config.ts` or the repository’s normal migration input (only if required by `db:generate`)
- generated migration and snapshot files produced by `pnpm db:generate`

**Contract:**

- Add nullable `company_id`/`companyId` to `plugin_config`.
- Keep the existing global row as `company_id IS NULL`.
- Replace the current single unique `plugin_id` constraint with two partial unique indexes: one on `plugin_id` where `company_id IS NULL`, and one on `(plugin_id, company_id)` where `company_id IS NOT NULL`.
- Add `companyId: string | null` to the shared `PluginConfig` type.
- Add optional `companyConfigSchema?: JsonSchema` to `PaperclipPluginManifestV1` and validate it with the same JSON-schema rules as `instanceConfigSchema`.
- Keep `instanceConfigSchema` and global rows non-secret. A manifest may declare secret-ref fields only in `companyConfigSchema`; the validator rejects a `format: "secret-ref"` field in the instance schema.
- Do not create a second config table and do not assign historical global rows to an arbitrary company.

**Steps:**

- [x] Write the migration/schema test for one global row and two company rows with the same plugin id; assert the partial uniqueness rules and nullable foreign-key behavior. The test is present; its embedded-Postgres run is blocked by the Windows database startup hang.
- [x] Update Drizzle schema/types/validators.
- [x] Generate the migration with the repository script; inspect it for accidental table drops or lockfile edits. The generated migration contains only the nullable company column, foreign key, and two partial indexes; lockfile review remains open because installation changed it afterward.
- [x] Run the DB/shared typecheck and the focused schema tests. Direct DB/shared typechecks and shared validator tests pass; the registry integration test remains unavailable locally.

**Check:**

```powershell
pnpm db:generate
pnpm --filter @paperclipai/db typecheck
pnpm --filter @paperclipai/shared typecheck
pnpm exec vitest run --project @paperclipai/server server/src/__tests__/plugin-registry.test.ts
```

Expected result: source and generated migration agree, existing global configs still load, and the new company rows are isolated by `(pluginId, companyId)`.

### Task 3 - Implement company config registry, routes, and binding synchronization

**Files:**

- `server/src/services/plugin-registry.ts`
- the existing plugin config route module under `server/src/routes/` (locate the module that serves `/api/plugins/:pluginId/config`)
- `server/src/services/plugin-secrets-handler.ts` (only its binding-facing helper contract, not runtime resolution yet)
- `server/src/__tests__/plugin-registry.test.ts`
- the route test file that covers plugin config endpoints

**API:**

- Preserve `GET/POST /api/plugins/:pluginId/config` for global, non-secret instance defaults.
- Add `GET/POST/DELETE /api/plugins/:pluginId/companies/:companyId/config` for the selected company.
- The company POST validates `companyConfigSchema`, rejects raw token-shaped values and non-UUID secret refs when those fields are present, asserts each referenced secret belongs to `companyId`, and atomically replaces `company_secret_bindings` for `(targetType="plugin", targetId=pluginId, companyId)`. Optional secret-ref fields may be omitted; required-field validation remains schema-driven.
- The company GET returns only the stored references and non-secret values for that company; it never resolves a value.
- DELETE removes the company config and its bindings in one transaction.
- All routes enforce the existing board/company authorization and plugin installation checks. A path company and body/query company mismatch is a 400/403, never a silent reassignment.

**Steps:**

- [x] Add registry methods `getCompanyConfig`, `upsertCompanyConfig`, and `deleteCompanyConfig`; keep the existing global methods unchanged except for the new nullable field.
- [x] Add schema-driven secret-ref extraction that records exact paths such as `apiKeyRef` and `webhookHmacKeyRef`.
- [x] Implement binding replacement in the same DB transaction as config replacement. Delete stale paths before inserting the new set.
- [x] Add route tests for company A/B isolation, foreign-secret rejection, raw-token rejection, stale-binding removal, omitted optional secret refs, and global-config secret rejection. Route coverage is green; database-level transaction assertions remain tied to the unavailable embedded-Postgres test.
- [x] Add an audit/activity event using existing redaction conventions; never include the ref value beyond its UUID or any plaintext.

**Check:**

```powershell
pnpm exec vitest run --project @paperclipai/server server/src/__tests__/plugin-registry.test.ts server/src/__tests__/plugin-routes-authz.test.ts
pnpm --filter @paperclipai/server typecheck
```

Expected result: the UI can save a UUID reference for one company, and database inspection shows no binding for another company or for a removed field.

### Task 4 - Extend SDK and host runtime secret resolution

**Files:**

- `packages/plugins/sdk/src/types.ts`
- `packages/plugins/sdk/src/protocol.ts`
- `packages/plugins/sdk/src/worker-rpc-host.ts`
- `packages/plugins/sdk/src/host-client-factory.ts`
- `server/src/services/plugin-host-services.ts`
- `server/src/services/plugin-secrets-handler.ts`
- `server/src/services/plugin-worker-manager.ts` (only the existing tool-scope path and regression tests)
- SDK/server tests covering worker RPC and secret handling

**Contract:**

```ts
type SecretResolveOptions = { configPath?: string };
resolve(secretRef: string, options?: SecretResolveOptions): Promise<string>;
```

The worker protocol uses `{ secretRef, configPath }`. The host handler receives the existing `WorkerHostCallContext`, obtains `companyId` from its invocation scope, and fails closed unless all of these are true:

- the manifest grants `secrets.read-ref`;
- the invocation has a company id;
- `secretRef` is a valid UUID;
- `configPath` is present and is an allowed secret-ref path in the active company config;
- `company_secret_bindings` contains the exact company/plugin/path/reference binding.

Resolve with the existing `secretService(db).resolveSecretValue(companyId, secretRef, "latest", { consumerType: "plugin", consumerId: pluginId, pluginId, configPath })`. Do not add a second secret store or a process-wide cache.

**Steps:**

- [x] Update the SDK types, protocol tuple, worker RPC client, and host-client wrapper while preserving capability-gate behavior.
- [x] Make the `config.get` host handler accept invocation context. For a scoped call, load the global row and company row and shallow-merge the two JSON objects; for an unscoped call, return only the global row. Never put a resolved secret into the merge.
- [x] Make the secret handler use the company binding and existing secret service. Redact all thrown errors to ids/paths and generic reason codes; malformed references and provider failures are now generic and regression-tested during the audit pass.
- [x] Confirm `plugin-worker-manager` passes the company scope for `executeTool` and that an RPC cannot request a different company. Add a regression for the Windows `file://` worker import path.
- [x] Clean/rebuild SDK outputs before package tests so stale ignored `dist/` signatures cannot mask source errors.

**Check:**

```powershell
pnpm --filter @paperclipai/plugin-sdk typecheck
pnpm exec vitest run --project @paperclipai/server server/src/__tests__/plugin-secrets-handler.test.ts server/src/__tests__/plugin-worker-manager.test.ts
pnpm exec vitest run --config packages/plugins/sdk/vitest.config.ts packages/plugins/sdk/tests/worker-rpc-host.test.ts
```

Expected result: the two-company fixture passes; no-scope, wrong-path, wrong-company, missing-capability, and missing-binding calls fail before any secret lookup result is returned.

### Task 5 - Connect the existing Kie client to the corrected host contract

**Files:**

- `packages/plugins/plugin-kie-image/src/manifest.ts`
- `packages/plugins/plugin-kie-image/src/kie-client.ts`
- `packages/plugins/plugin-kie-image/src/orchestrator.ts`
- `packages/plugins/plugin-kie-image/src/worker.ts`
- `packages/plugins/plugin-kie-image/tests/kie-client.spec.ts`
- `packages/plugins/plugin-kie-image/tests/worker.spec.ts`

**Steps:**

- [x] Keep `companyConfigSchema.apiKeyRef` and `companyConfigSchema.webhookHmacKeyRef` as `format: "secret-ref"`; keep non-secret defaults in `instanceConfigSchema`.
- [x] Keep the existing two-argument resolver calls and make the package compile against the updated SDK source. Use exact paths `apiKeyRef` and `webhookHmacKeyRef`.
- [x] Ensure `readConfig(ctx)` is called only from a company-scoped tool invocation in this MVP. Health/settings initialization must not resolve a key; it should report that company configuration is required when no scope is available.
- [x] In the test harness, configure a company-scoped invocation with a fake resolver, invoke `generate_image` with `runContext.companyId`, and mock `ctx.http.fetch`. The request and bearer-path assertions pass; the real secret-provider/database path remains an integration check.
- [x] Add negative tests for missing company config, wrong-company invocation, and a pasted raw token. Missing config and raw-token cases are covered in the Kie worker; wrong-company scope is covered by server authorization tests.
- [x] Do not add or enable new provider behavior, scheduler logic, webhook routing, attachment persistence, history UI, or confirmation prompts in this task.

**Check:**

```powershell
pnpm --filter @paperclipai/plugin-kie-image typecheck
pnpm --filter @paperclipai/plugin-kie-image test
pnpm --filter @paperclipai/plugin-kie-image build
```

Expected result: the existing package can authenticate through a Paperclip secret reference in a scoped tool call, while unscoped calls fail with an actionable setup error.

### Task 6 - Add the minimum UI path and operator documentation

**Files:**

- `ui/src/api/plugins.ts`
- `ui/src/lib/queryKeys.ts`
- `ui/src/pages/PluginSettings.tsx`
- `ui/src/components/JsonSchemaForm.tsx`
- the nearest UI test/Storybook file for plugin settings
- `packages/plugins/plugin-kie-image/README.md`

**Steps:**

- [x] Add typed client methods and query keys for the company config endpoints.
- [x] Add an explicit `allowRawSecretValues: boolean` prop to the shared JSON-schema form if it is not already present, and pass `false` from the company config form. Render the company config schema for the selected company when a manifest provides `companyConfigSchema`; secret-ref fields must use the existing Paperclip secret picker.
- [x] Keep the global form for non-secret defaults. Never show a resolved secret value and never write a token-shaped value to the API.
- [x] Surface save errors for missing/foreign secrets and a clear “select a Paperclip secret reference” message; do not implement an auto-save loop.
- [x] Document the exact operator flow: create/import the Kie secret in Paperclip, select its UUID reference in the company plugin settings, enable the skill, and run the scoped tool. State that a pasted Kie token is intentionally rejected.

**Check:**

```powershell
pnpm --filter @paperclipai/ui typecheck
```

The UI package currently has no test script. If a focused component test is added, run it with the repository’s existing Vitest configuration and record the exact command.

### Task 7 - Verify, review, and hand off

**Steps:**

- [x] Run the focused server, SDK, UI, and Kie tests from Tasks 2-6 using direct Vitest equivalents; all runnable focused suites are green.
- [x] Run direct workspace typechecks and the Kie TypeScript/UI build without invoking the broken non-TTY pnpm wrapper. Review of the modified lockfile remains open.
- [x] Inspect the complete diff and search for accidental secret logging, raw-token fallbacks, `Authorization` values in test output, new unscoped secret calls, and stale SDK `dist/` assumptions. The invalid-reference raw echo was fixed; test literals are synthetic only.
- [x] Verify the existing Windows worker launcher still passes a `file://` URL for absolute `D:` paths.
- [x] Update the memory bank with the validation result and any remaining follow-up work.

**Final check commands:**

```powershell
pnpm -r typecheck
pnpm test:run -- --dry-run
pnpm exec vitest run --config packages/plugins/sdk/vitest.config.ts
pnpm --filter @paperclipai/plugin-kie-image test
pnpm --filter @paperclipai/plugin-kie-image build
git diff --check
git status --short --branch
```

The root package does not define a universal lint script. Run a package lint script only when it exists and explicitly report “not defined” otherwise.

The workspace lockfile currently contains the Kie package importer required by
this checkout plus unrelated pnpm metadata churn from dependency installation.
It was reviewed but not edited during this correction pass; do not include
unrelated lockfile churn in a code handoff. The embedded-Postgres registry test
is an environment-blocked integration check on this Windows host, not a claim
of live provider authentication.

## Acceptance criteria

- [ ] A board user can save a Kie `apiKeyRef` for company A through the company-scoped plugin settings route/UI; the raw token path is rejected.
- [ ] Company A’s `generate_image` invocation resolves exactly the bound secret and sends one Kie request with its bearer header.
- [ ] Company B, an unscoped invocation, a wrong `configPath`, a missing binding, and a plugin without `secrets.read-ref` cannot obtain the value.
- [ ] Global instance defaults remain readable without scope and contain no secret-ref fields.
- [ ] Config replacement removes stale company bindings atomically; foreign-company secret ids are rejected.
- [ ] No response, log, activity entry, worker initialization payload, test failure, or generated artifact contains the plaintext Kie token.
- [ ] The Kie package, SDK, server, and UI typechecks/tests/builds pass, or unavailable checks are explicitly reported.
- [ ] The Windows repo-local plugin worker still starts without `ERR_UNSUPPORTED_ESM_URL_SCHEME`.

## Follow-up plan (not part of this fix)

After this MVP is verified, schedule a separate design/implementation task for company-aware Kie jobs, signed callbacks, polling reconciliation, durable output attachments, history UI, guardrails, and broader plugin secret-scope coverage. Those features require their own migrations and end-to-end tests; they are deliberately not prerequisites for proving that the agent can read its KieAPI secret.
