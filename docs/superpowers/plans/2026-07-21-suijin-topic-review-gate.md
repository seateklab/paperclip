# Suijin Topic Review Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure every Suijin research topic pauses in `in_review` for an exact human approval before Facebook Writer receives the child issue.

**Architecture:** Preserve the existing Paperclip interaction and assignment state machine. Make company-imported agent skills fail closed when their desired runtime skill references are not persisted, add a defensive approval check at the Writer boundary, and reconcile the existing Suijin instance only after active runs reach a safe boundary. No Suijin-specific Paperclip core route or provider integration is introduced.

**Tech Stack:** TypeScript, Express/Paperclip company portability services, Vitest, Node.js built-in tests, Agent Companies v1 Markdown/YAML, Paperclip agent skill-sync API.

## Global Constraints

- Do not cancel, pause, reassign, or mutate the currently active Suijin issues or runs during implementation.
- Do not call Tavily, Kie, Noto, Meta, or any Facebook publication API in tests or smoke verification.
- Preserve the existing `request_confirmation` interaction, idempotency, human-authored comment, and audit-log contracts.
- `skills:` declared in imported agent frontmatter must resolve to company-scoped runtime skill keys and persist in `adapterConfig.paperclipSkillSync.desiredSkills`.
- A child issue must remain `in_review` until a human-authored trimmed comment exactly matches `Approved`, `Agree`, `Đồng ý`, or `Duyệt`, case-insensitively.
- Agent-authored comments, ambiguous comments, missing interactions, and stale runtime skill state are blockers, not approvals.
- Use UTF-8-safe Paperclip request helpers for any Vietnamese fixture or reconciliation mutation.
- Do not commit `pnpm-lock.yaml` or unrelated worktree changes.

---

### Task 1: Lock the importer and topic-gate regressions

**Files:**
- Modify: `server/src/__tests__/company-portability.test.ts`
- Modify: `server/src/__tests__/agent-skills-routes.test.ts`
- Modify: `companies/suijin-content/tests/suijin-pipeline-contract.test.mjs`

**Interfaces:**
- Consumes: `companyPortabilityService.importBundle`, `POST /api/agents/:agentId/skills/sync`, and the existing Suijin package files.
- Produces: deterministic failures for lost `paperclipSkillSync.desiredSkills`, missing confirmation-before-review ordering, downstream initial assignment, and non-human approval.

- [ ] **Step 1: Back up each existing test file before editing**

Create unique same-directory backups and verify each backup is byte-readable before editing:

```powershell
$stamp = Get-Date -Format yyyyMMdd-HHmmss
Copy-Item server/src/__tests__/company-portability.test.ts "server/src/__tests__/company-portability.test.ts.orig.$stamp"
Copy-Item server/src/__tests__/agent-skills-routes.test.ts "server/src/__tests__/agent-skills-routes.test.ts.orig.$stamp"
Copy-Item companies/suijin-content/tests/suijin-pipeline-contract.test.mjs "companies/suijin-content/tests/suijin-pipeline-contract.test.mjs.orig.$stamp"
Get-FileHash server/src/__tests__/company-portability.test.ts
Get-FileHash "server/src/__tests__/company-portability.test.ts.orig.$stamp"
```

Use the same verification for the other two files. Stop if any backup is missing or unreadable.

- [ ] **Step 2: Add the failing importer assertion**

Extend the existing packaged-skill import test in `server/src/__tests__/company-portability.test.ts` with an opencode agent whose package frontmatter declares:

```yaml
skills:
  - create-reviewed-topic-tasks
  - write-facebook-post
```

After `importBundle`, assert that the created agent adapter config contains the resolved company keys in order:

```ts
expect(agentSvc.create).toHaveBeenCalledWith(
  "company-imported",
  expect.objectContaining({
    adapterConfig: expect.objectContaining({
      paperclipSkillSync: {
        desiredSkills: [
          "company/company-imported/create-reviewed-topic-tasks",
          "company/company-imported/write-facebook-post",
        ],
      },
    }),
  }),
);
```

Add a second assertion that a persistence normalizer cannot silently remove the preference: if the mocked normalizer returns an adapter config without `paperclipSkillSync`, the import must reject with an explicit skill-sync persistence error rather than creating an agent with no desired skills.

- [ ] **Step 3: Add the live sync route assertion**

In `server/src/__tests__/agent-skills-routes.test.ts`, add a route case using the existing `POST /api/agents/:agentId/skills/sync?companyId=company-1` contract. Send the short skill references and assert both:

```ts
expect(mockAgentService.update).toHaveBeenCalledWith(
  expect.any(String),
  expect.objectContaining({
    adapterConfig: expect.objectContaining({
      paperclipSkillSync: expect.objectContaining({
        desiredSkills: [
          "company/company-1/create-reviewed-topic-tasks",
          "company/company-1/write-facebook-post",
        ],
      }),
    }),
  }),
  expect.any(Object),
);
```

Also assert `mockAdapter.syncSkills` receives the same resolved keys. This proves reconciliation updates both persisted preference and runtime materialization.

- [ ] **Step 4: Add the Suijin ordering assertions**

In `companies/suijin-content/tests/suijin-pipeline-contract.test.mjs`, assert the package contract contains these markers in order:

```js
assertOrdered(topicSkill, [
  "task-agent",
  "request_confirmation",
  "in_review",
  "facebook-writer",
]);

Add assertions against `create-reviewed-topic-tasks/SKILL.md` that require:

- initial child assignment is `task-agent`;
- interaction creation precedes the `in_review` transition;
- the first gate uses `suijin-topic-review:<child-id>:initial`;
- only the exact accepted human phrases advance the child;
- non-accepted comments keep the child in `in_review`.

Add a negative assertion that the package does not state or imply an initial `facebook-writer` assignment.

- [ ] **Step 5: Run the focused tests and identify the pre-fix failure**

Run:

```powershell
pnpm exec vitest run --project @paperclipai/server server/src/__tests__/company-portability.test.ts server/src/__tests__/agent-skills-routes.test.ts
node --test companies/suijin-content/tests/suijin-pipeline-contract.test.mjs
```

Expected before implementation: the package ordering assertions may already
pass because the package text contains the intended gate, while the new
persistence-normalizer test fails until Task 2 adds the fail-closed assertion.
The live defect is the already-imported instance's stale persisted skill state;
it is not a reason to mutate the active issue. No external provider is
contacted.

- [ ] **Step 6: Commit the regression tests**

```powershell
git add server/src/__tests__/company-portability.test.ts server/src/__tests__/agent-skills-routes.test.ts companies/suijin-content/tests/suijin-pipeline-contract.test.mjs
git commit -m "test: enforce Suijin topic review handoff" -m "Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

Remove only the temporary backups created in Step 1 after the commit and test source have been verified.

---

### Task 2: Make imported skill synchronization fail closed

**Files:**
- Modify: `server/src/services/company-portability.ts`
- Test: `server/src/__tests__/company-portability.test.ts`
- Inspect: `packages/adapter-utils/src/server-utils.ts`

**Interfaces:**
- Consumes: `prepareImportedAgentAdapter`, `writePaperclipSkillSyncPreference`, and `secrets.normalizeAdapterConfigForPersistence`.
- Produces: imported agents whose desired skill refs are guaranteed to survive persistence, or an explicit import error naming the affected agent and required action.

- [ ] **Step 1: Trace the existing import path before changing it**

Verify these exact stages in `server/src/services/company-portability.ts`:

1. `manifestAgent.skills` is mapped through `desiredSkillRefMap`.
2. `prepareImportedAgentAdapter` calls `writePaperclipSkillSyncPreference`.
3. Secret normalization preserves `paperclipSkillSync`.
4. The resulting adapter config is passed to `agents.create` or `agents.update`.

Verify `packages/adapter-utils/src/server-utils.ts` retains the preference in `writePaperclipSkillSyncPreference` and canonicalizes short refs only against the runtime entry list.

- [ ] **Step 2: Add a fail-closed persistence assertion**

After normalization in `prepareImportedAgentAdapter`, compare the resolved `desiredSkills` with `readPaperclipSkillSyncPreference(normalizedAdapterConfig).desiredSkills`. If any resolved company skill key is missing, throw an unprocessable error with:

```text
Imported agent <slug> lost declared runtime skills during adapter-config persistence; re-run the import after fixing skill synchronization.
```

Do not silently restore a different skill, substitute a built-in skill, or continue with an empty preference.

- [ ] **Step 3: Preserve existing adapter and secret behavior**

Keep these existing invariants unchanged:

- absolute paths and instruction bundle paths are removed from portable config;
- secret values remain references and are never logged;
- `opencode_local` model validation still runs;
- required Paperclip skills remain included by adapter resolution;
- imported heartbeat timers remain disabled by `disableImportedTimerHeartbeat`.

- [ ] **Step 4: Run the importer regression green**

Run:

```powershell
pnpm exec vitest run --project @paperclipai/server server/src/__tests__/company-portability.test.ts
```

Expected: the full selected file passes, including the desired-skill persistence and fail-closed normalizer cases.

- [ ] **Step 5: Commit the importer fix**

```powershell
git add server/src/services/company-portability.ts server/src/__tests__/company-portability.test.ts
git commit -m "fix: fail closed when imported skills are lost" -m "Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

### Task 3: Add a defensive Writer approval boundary

**Files:**
- Modify: `companies/suijin-content/skills/write-facebook-post/SKILL.md`
- Modify: `companies/suijin-content/agents/facebook-writer/AGENTS.md`
- Test: `companies/suijin-content/tests/suijin-pipeline-contract.test.mjs`


**Interfaces:**
- Consumes: Paperclip issue comments/interactions, topic-child fields, and the existing Writer handoff.
- Produces: a Writer that refuses to write or reassign when the human topic gate is missing, pending, rejected, or agent-authored.

- [ ] **Step 1: Add the failing Writer guard assertions**

Extend the package contract test to require that `write-facebook-post/SKILL.md` instructs Writer to fetch and validate the topic child before writing, including:

- a `request_confirmation` interaction exists;
- the latest gate is resolved by a human-authored exact accepted phrase;
- an agent-authored comment cannot approve the topic;
- unresolved, missing, or ambiguous gate state blocks before `facebook-post` creation;
- Image Agent is not assigned on a blocked gate.

- [ ] **Step 2: Write the explicit Writer preflight**

Add this ordered preflight to `write-facebook-post/SKILL.md` before reading/writing post content:

```text
Before writing, fetch the topic child's interactions and comments. Require a
request_confirmation interaction and a latest human-authored comment whose
trimmed body is exactly Approved, Agree, Đồng ý, or Duyệt, case-insensitively.
If the interaction is missing, pending, rejected, superseded without a fresh
approval, or the approving comment is agent-authored, block with the owner and
next action. Do not create or overwrite facebook-post and do not assign Image
Agent.
```

Keep the existing source, language, Page, UTF-8, and document-readback rules.

- [ ] **Step 3: Mirror the hard stop in Facebook Writer instructions**

Update `agents/facebook-writer/AGENTS.md` so the agent cannot treat a Task
Agent handoff comment alone as approval. It must perform the preflight and
leave the issue visibly blocked when the gate is not verified.

- [ ] **Step 4: Run the package contract test**

```powershell
node --test companies/suijin-content/tests/suijin-pipeline-contract.test.mjs
```

Expected: 1 test passes with zero failures and no live provider calls.

- [ ] **Step 5: Commit the defensive gate**

```powershell
git add companies/suijin-content/skills/write-facebook-post/SKILL.md companies/suijin-content/agents/facebook-writer/AGENTS.md companies/suijin-content/tests/suijin-pipeline-contract.test.mjs
git commit -m "fix: block Suijin Writer before topic approval" -m "Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

### Task 4: Reconcile the existing instance after active work reaches a safe boundary

**Files:**
- No repository file changes required for the reconciliation itself.
- Operational evidence: attach the import/sync output to the relevant board issue if the board requests an inspectable artifact.

**Interfaces:**
- Consumes: the current Suijin company `57b0a2e8-a5bc-4102-a9c3-d0a92f8192f6`, agent skill-sync route, and the five package-declared skill assignments.
- Produces: verified desired skills for the current agents and a controlled test issue that pauses for human topic review.

- [ ] **Step 1: Wait for a safe boundary without touching active issues**

Do not call PATCH, checkout, release, cancel, or skill-sync mutation while any
current Suijin issue has an active run. Continue read-only observation only.
The board separately decides how to handle topics that already bypassed the
gate; do not retroactively mark them approved.

- [ ] **Step 2: Audit current agent preferences read-only**

For each imported agent, call:

```text
GET /api/agents/<agent-id>/skills?companyId=57b0a2e8-a5bc-4102-a9c3-d0a92f8192f6
```

Record that Task Agent desires `create-reviewed-topic-tasks`, Facebook Writer
desires `write-facebook-post`, Image Agent desires `kie-image-generation`,
Research Agent desires `research-facebook-topics`, and Facebook Publisher
desires `publish-facebook-via-noto` plus the managed `noto` skill where
available.

- [ ] **Step 3: Reconcile desired skills through the supported route**

After the safe boundary, call the existing sync route for each agent with the
short skill slugs; the server resolves them to company-scoped keys:

```text
POST /api/agents/<agent-id>/skills/sync?companyId=57b0a2e8-a5bc-4102-a9c3-d0a92f8192f6
Content-Type: application/json

{"desiredSkills":["create-reviewed-topic-tasks"]}
```

Use the corresponding declared skills for the other four agents. Preserve
Paperclip’s run-audit header when the call is made from an agent heartbeat; use
the documented authenticated CLI/API helper when performed by the board
operator.

- [ ] **Step 4: Verify materialization before creating a test issue**

Repeat the read-only skill snapshot calls and require `desired: true` plus a
usable runtime state for every required skill. If a skill remains only
`available`, stop and report the exact agent, skill, and runtime path; do not
start the test issue.

- [ ] **Step 5: Run a controlled test issue**

Create a new non-production topic request using a dedicated test Page. Verify:

1. Research results are durable.
2. Topic children are assigned to Task Agent and become `in_review`.
3. Each child has one pending `request_confirmation` interaction.
4. No Facebook Writer run starts before a human comment.
5. A non-accepted or agent-authored comment leaves the child in review.
6. An exact human approval changes the child to `todo` and assigns Writer.
7. No Tavily/Kie/Noto mutation is used for this gate-only smoke.

- [ ] **Step 6: Record unresolved existing work explicitly**

For any already-running downstream topic, record that its publication path was
not human-approved under the corrected gate and route it to board disposition.
Do not manufacture an approval interaction after the fact.

- [ ] **Step 7: Run final verification and hygiene checks**

```powershell
pnpm exec vitest run --project @paperclipai/server server/src/__tests__/company-portability.test.ts server/src/__tests__/agent-skills-routes.test.ts
node --test companies/suijin-content/tests/suijin-pipeline-contract.test.mjs
git diff --check
git status --short --branch
```

Expected: selected server tests and the Suijin contract test pass; `git diff
--check` has no whitespace errors; unrelated user changes remain untouched.

- [ ] **Step 8: Commit only final source/test changes**

```powershell
git status --short
# Stage only the files listed in Tasks 1–3.
git commit -m "fix: enforce Suijin topic review before writing" -m "Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

Do not commit runtime databases, generated `dist` output, credentials, or
unrelated memory/worktree files.
