# Suijin Noto Publisher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Suijin Facebook Publisher finish the approved workflow through the installed Noto plugin using runtime connection/function discovery, schema-safe input mapping, durable publication artifacts, and fail-closed execution.

**Architecture:** Keep the change package-only. Update Suijin's Publisher skill, Publisher instructions, package contract test, and README; do not add Paperclip core routes, database state, or a Facebook-specific Noto wrapper. The Publisher discovers one connected Facebook connection, inspects its advertised function schemas, executes only one unambiguous schema-compatible function after final board approval, and records a publication artifact only when explicit post ID and permalink values are returned.

**Tech Stack:** Agent Companies v1 Markdown, Paperclip managed skills, Noto plugin tools (`list_connections`, `get_connection`, `list_connection_tools`, `execute_connection_function`), Node.js built-in test runner, Vitest portability suite, external Noto Vitest suite, Paperclip CLI/API.

## Global Constraints

- Use the installed Noto plugin contract exactly: discovery -> connection inspection -> advertised function schema inspection -> schema-valid execution.
- Never hard-code a provider Facebook function name, Noto namespace beyond the managed skill's advertised operations, endpoint, credential field, or direct Facebook/Meta API fallback.
- External Noto execution begins only after a linked `request_board_approval` has status `approved`.
- Use the issue's exact `Target Facebook Page:` value; block on missing, placeholder, ambiguous, or unrepresentable Page input.
- Use the complete durable `facebook-post` document and exactly one active attachment-backed `facebook-image` artifact.
- Pass the durable image only when the discovered `inputSchema` accepts an actually reachable representation; fail closed on local or guessed URLs, upload fields, or base64 shapes.
- Pass publication key `suijin:issueId:facebook-v1` with the actual issue ID substituted only when the discovered schema advertises a compatible publication/idempotency field; do not claim provider idempotency when absent.
- Treat `success: false` as definitive failure. Never retry `noto_execution_ambiguous`; the current plugin has no execution ID, status lookup, or idempotency mechanism.
- Require an unambiguous external post ID and permalink before creating the `provider: "noto"` artifact or marking the topic `done`.
- Preserve approved board approvals across configuration failures and never create duplicate approvals for the same publication.
- Do not write credentials, Page tokens, private provider payloads, or raw Noto responses into comments, documents, tests, or package files.
- Do not use a production Facebook Page for live verification; if no dedicated test Page or compatible media representation exists, record the blocker and stop before external mutation.
- Preserve unrelated worktree changes in `pnpm-lock.yaml` and `server/src/services/heartbeat.ts`.

## File Map

- `companies/suijin-content/tests/suijin-pipeline-contract.test.mjs` — static package contract and forbidden-pattern assertions.
- `companies/suijin-content/agents/facebook-publisher/AGENTS.md` — Publisher role, handoff, approval timing, and failure ownership.
- `companies/suijin-content/skills/publish-facebook-via-noto/SKILL.md` — executable Noto discovery, schema mapping, result validation, and retry policy.
- `companies/suijin-content/README.md` — user-facing workflow and setup instructions.
- `D:/seatek_tasks/Plugins/noto/skills/noto/SKILL.md` — existing provider-generic Noto contract; read-only reference, do not modify in this plan.
- `D:/seatek_tasks/Plugins/noto/src/contracts.ts` — Noto input/output/error types; read-only reference, do not modify in this plan.
- `D:/seatek_tasks/Plugins/noto/tests/` — existing Noto regression suite; execute after package changes, do not modify in this plan.

---

### Task 1: Extend the failing Suijin Publisher contract

**Files:**
- Modify: `companies/suijin-content/tests/suijin-pipeline-contract.test.mjs` near the existing Publisher assertions at lines 134-141.
- Test: `companies/suijin-content/tests/suijin-pipeline-contract.test.mjs`.

**Interfaces:**
- Consumes the existing `publisherSkill` and `publisherAgent` strings loaded by the test.
- Produces static assertions that Task 2 must satisfy without naming a provider-specific Facebook publish function.

- [ ] **Step 1: Back up the existing test before editing**

Create a unique sibling backup such as:

```text
companies/suijin-content/tests/suijin-pipeline-contract.test.mjs.orig.YYYYMMDD-HHMMSS
```

Verify the backup is readable and matches the current test before editing the source.

- [ ] **Step 2: Add RED assertions for the Noto discovery sequence**

Add assertions after the existing final-approval assertions. The test must require these exact managed operations in order:

```js
assertOrdered(publisherSkill, [
  "list_connections",
  "get_connection",
  "list_connection_tools",
  "execute_connection_function",
]);
```

Also require the Publisher skill to mention all of these schema/selection terms:

```js
for (const marker of [
  "platformSlug",
  "connected",
  "connectionId",
  "functionName",
  "inputSchema",
  "schema-compatible",
  "image/media",
  "success: false",
  "noto_execution_ambiguous",
  "external post ID",
  "permalink",
]) {
  assert.ok(publisherSkill.includes(marker), `missing Noto Publisher marker: ${marker}`);
}
```

Require the relevant ordering:

```js
assertOrdered(publisherSkill, [
  "inputSchema",
  "execute_connection_function",
  "external post ID",
  "Facebook publication",
]);
```

The exact strings may be embedded in prose or code blocks, but the behavior they describe must remain unambiguous.

- [ ] **Step 3: Add RED assertions for fail-closed behavior**

Require these markers and ordering:

```js
assertOrdered(publisherSkill, [
  "local URL",
  "block",
  "before execution",
]);
assertOrdered(publisherSkill, [
  "success: false",
  "definitive",
  "retry",
]);
assertOrdered(publisherSkill, [
  "ambiguous",
  "Never retry",
]);
```

Add a forbidden list for provider-specific function guesses without forbidding the approved approval payload action:

```js
assertNotPresent(allPackageContent, [
  "FACEBOOK_CREATE_POST",
  "FACEBOOK_PUBLISH_POST",
  "publishToFacebook",
  "facebook.graph.",
]);
```

Keep the existing forbidden checks for raw Page tokens, direct Graph API URLs, placeholder/SVG image fallbacks, hard-coded Noto namespaces, and secret-looking literals.

- [ ] **Step 4: Run the focused test and verify RED**

Run:

```powershell
node --test companies/suijin-content/tests/suijin-pipeline-contract.test.mjs
```

Expected: FAIL because the current Publisher skill does not yet contain the complete dynamic discovery, schema mapping, and fail-closed contract. Do not weaken the assertions to make the current implementation pass.

- [ ] **Step 5: Commit the contract test**

Commit only the test change and its required test backup handling according to repository policy. The commit message must include:

```text
Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

---

### Task 2: Implement the schema-driven Publisher package behavior

**Files:**
- Modify: `companies/suijin-content/skills/publish-facebook-via-noto/SKILL.md`.
- Modify: `companies/suijin-content/agents/facebook-publisher/AGENTS.md`.
- Modify: `companies/suijin-content/README.md` in the workflow and setup sections.

**Interfaces:**
- Consumes: the four managed Noto operations and result/error contract from `D:/seatek_tasks/Plugins/noto/skills/noto/SKILL.md` and `D:/seatek_tasks/Plugins/noto/src/contracts.ts`.
- Produces: a Publisher skill that can be followed without knowing a provider function name, and agent instructions that invoke it only after Image Agent handoff and final approval.

- [ ] **Step 1: Back up all existing package files before editing**

Create and verify unique sibling backups for each of the three existing files. Do not overwrite any existing backup. Stop before editing if any backup cannot be read back successfully.

- [ ] **Step 2: Rewrite the Publisher lifecycle and approval timing**

The beginning of `AGENTS.md` must state this exact lifecycle in substance:

```text
Publisher is invoked after Image Agent has persisted facebook-post and the durable image. It validates prerequisites and creates or reuses the final board approval when needed. External Noto execution starts only after that approval is approved.
```

The skill must require:

- `facebook-post` exists and is read in full;
- exactly one active attachment-backed artifact has `metadata.artifactKind === "facebook-image"`;
- concrete `Target Facebook Page:` is present and not the starter placeholder;
- managed `noto` is installed;
- no successful publication artifact already exists;
- linked approvals are listed before creating a new one;
- pending/revision-requested approval is reused, approved approval is used, rejected approval blocks, and only no linked approval creates one new `request_board_approval`;
- the approval is fetched and verified as `approved` before any Noto call.

- [ ] **Step 3: Add the exact runtime discovery sequence**

Replace the generic “use the advertised interface” paragraph with this operational sequence:

```text
1. Call seatek.noto:list_connections with platformSlug facebook and status connected. Do not guess an ID.
2. Select exactly one connection whose identity can be reconciled with the issue Page. Multiple unresolved candidates block.
3. Call seatek.noto:get_connection with the selected connectionId and require a connected status.
4. Call seatek.noto:list_connection_tools with the selected connectionId.
5. Inspect every function's name, description, and inputSchema.
6. Select one and only one function whose description and schema support Facebook publication, target Page, post text, and image/media.
7. Call seatek.noto:execute_connection_function only with that advertised functionName and an input object containing only schema-accepted fields.
```

Use the managed skill's actual tool names in the package instructions, but do not add any provider-specific Facebook function name, endpoint, namespace, or credential field.

- [ ] **Step 4: Implement schema-safe input mapping instructions**

Add these exact rules:

- Map the issue's Page only when the discovered property name or description clearly identifies a Page name or identifier.
- Map the complete `facebook-post` body only to a discovered text/message/content field.
- Map the image only when the discovered schema accepts an actually reachable representation of the Paperclip attachment. A local URL, guessed upload field, guessed base64 form, or inaccessible path blocks before execution.
- Pass publication key `suijin:issueId:facebook-v1` with the actual issue ID substituted only when the discovered schema advertises a compatible publication/idempotency field.
- Any unknown required field blocks with the missing field and owner/action.

- [ ] **Step 5: Implement result, artifact, and retry instructions**

The skill must state:

```text
success: false is a definitive provider failure and is not automatically retried.
A noto_execution_ambiguous result is never retried because the current plugin has no execution ID, status lookup, or idempotency mechanism.
success: true is accepted only when output contains one unambiguous external post ID and one unambiguous permalink.
```

Only after those identifiers are verified may the agent create:

```json
{
  "type": "artifact",
  "provider": "noto",
  "externalId": "notoExternalPostId",
  "title": "Facebook publication",
  "url": "notoPermalink",
  "status": "active",
  "reviewState": "approved",
  "metadata": {
    "publicationKey": "suijin:issueId:facebook-v1",
    "targetPage": "issueTargetFacebookPage"
  }
}
```

After the artifact succeeds, comment the permalink and mark the topic `done`. If a successful artifact already exists, do not call Noto again. Preserve the approved board approval across failures. Do not retry ambiguous outcomes.

- [ ] **Step 6: Update README operational guidance**

Add a concise “How Publisher uses Noto” subsection stating:

- Publisher discovers a connected Facebook connection at runtime;
- Publisher inspects the function schema before execution;
- the Page, post, and image are passed only when schema-compatible;
- missing compatible image transport blocks safely;
- final approval precedes any external mutation;
- publication requires returned external ID and permalink;
- no production Page is used for smoke tests.

Do not document an invented provider function name or endpoint.

- [ ] **Step 7: Run the package contract and remove execution backups**

Run:

```powershell
node --test companies/suijin-content/tests/suijin-pipeline-contract.test.mjs
```

Expected: PASS with one test and zero failures. Remove only the temporary backups created for this task after the source changes are verified; do not remove pre-existing user backups. Re-run the test after cleanup.

- [ ] **Step 8: Commit the package behavior**

Commit the Publisher skill, agent instructions, README, and any test correction required by the implementation. Include:

```text
Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

---

### Task 3: Run regression, portability, and conditional live verification

**Files:**
- No product files by default.
- Modify only Suijin package files if a verification failure identifies a concrete package defect.

**Interfaces:**
- Consumes the completed package from Tasks 1-2 and the installed `seatek.noto` plugin.
- Produces test evidence and, only when safely configured, one dedicated-test-Page publication.

- [ ] **Step 1: Run all focused package and plugin tests**

Run:

```powershell
node --test companies/suijin-content/tests/suijin-pipeline-contract.test.mjs
pnpm exec vitest run --project @paperclipai/server server/src/__tests__/company-portability.test.ts
pnpm test
```

From `D:/seatek_tasks/Plugins/noto`, run:

```powershell
pnpm test
```

Expected: Suijin contract passes, portability suite passes, and the Noto package regression suite remains green. If the repository-wide `pnpm test` is unavailable because of the known environment/toolchain issue, record the exact failure and retain the focused evidence; do not bypass or alter the suite.

- [ ] **Step 2: Run package import preview against a managed Paperclip instance**

With a healthy server, run:

```powershell
pnpm paperclipai company import ./companies/suijin-content --target new --include company,agents,projects,issues,skills --dry-run --json --api-base http://127.0.0.1:3100
```

Expected: no import errors, five agents, one project, one starter issue, five package skill plans, and warnings only for external runtime skills. Confirm the Publisher remains package-idle/default and no adapter is pinned.

- [ ] **Step 3: Verify installed Noto readiness without provider mutation**

Confirm the Paperclip plugin list reports `seatek.noto` as `ready` with no `lastError`. Use the installed managed `noto` skill to perform only discovery, connection inspection, and function-schema inspection in a controlled Publisher runtime context. Record only sanitized connection/function metadata. Do not execute a provider mutation during this step.

If the available runtime cannot provide a valid current agent run context for tool execution, record that as an environment blocker; do not create a synthetic run or use raw credentials to bypass the agent boundary.

- [ ] **Step 4: Run the controlled end-to-end smoke only with a dedicated test Page**

Before this step, require all of the following:

- TAVILY secret bound to Research Agent;
- Kie company-scoped secret configured;
- Noto company configuration ready;
- connected Facebook Noto account;
- dedicated test Page selected in the issue;
- Noto function schema explicitly supports Page, post text, and image/media representation;
- Paperclip attachment URL/media representation is actually reachable by Noto.

Run exactly one topic through both human gates, verify `research-results`, a reviewed child, `facebook-post`, one durable image artifact, approved final board approval, one dynamic Noto execution, one external post ID, one permalink, and one `provider: "noto"` artifact. Do not rerun after an ambiguous provider outcome.

If any prerequisite is unavailable, leave the issue blocked with the named owner/action and record live publication as an activation prerequisite rather than a failed package implementation.

- [ ] **Step 5: Perform final repository hygiene checks**

Run:

```powershell
git diff --check
git status --short --branch
```

Confirm unrelated worktree changes remain untouched and no backup/scaffold artifacts are included in the Suijin package.

- [ ] **Step 6: Commit verification-only package fixes, if any**

If Step 3 or Step 4 exposes a package defect, fix only that package source, rerun its covering tests, and commit with:

```text
Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

Do not add a Noto wrapper or core Paperclip automation as an emergency fallback.
