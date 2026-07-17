# Memory Bank and Cognito Package Remediation Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make portable agent pause state round-trip safely, repair Cognito Content work-product contracts and its ZIP artifact, and standardize the repository memory bank without retaining sensitive runtime evidence.

**Architecture:** Extend the existing Paperclip sidecar contract with one deliberately narrow agent state field: `idle | paused`. Keep all other runtime states non-portable, validate unsupported values during package parsing, and apply the state on both create and replacement imports. Treat `companies/cognito-content/` as the editable source and regenerate `companies/cognito-content.zip` from that source only after contract checks pass. Treat the memory bank as a durable, human-readable journal whose navigation and state dimensions are explicit and whose archival backups are ignored.

**Tech Stack:** TypeScript, Zod, Vitest, PowerShell/.NET ZIP APIs, Markdown.

**Execution constraints:** Work in the current checkout because the task and package sources are currently untracked and must not be lost across a worktree boundary. Before editing any existing file, create and verify a unique same-directory `.orig.YYYYMMDD-HHMMSS` backup. Do not stage, commit, start the application server, or run dev scripts. Run only focused test/check/typecheck commands and artifact-generation/inspection commands required by this plan.

---

### Task 1: Record the executable plan in the memory bank

**Files:**
- Modify: `memory-bank/tasks/TASK005-memory-bank-and-package-remediation.md`
- Modify: `memory-bank/tasks/_index.md`
- Modify: `memory-bank/activeContext.md`

**Step 1: Back up and verify each existing file**

Create unique same-directory backups and compare their SHA-256 hashes with the source files. Stop if any comparison differs.

**Step 2: Replace the former plan-readiness blocker**

Point TASK005 at this implementation plan, set its task status to `In progress`, implementation to `in_progress`, validation to `not_run`, and activation/follow-up to `not_required`. Record the four implementation workstreams: portable status, Cognito source/ZIP, memory-bank standardization, and verification.

**Step 3: Synchronize navigation and current context**

Keep TASK005 in the index's in-progress section and state that execution has begun under this plan. Do not claim validation yet.

### Task 2: Add failing portability tests for portable agent status

**Files:**
- Modify: `server/src/__tests__/company-portability.test.ts`

**Step 1: Back up and verify the test file**

Create a unique same-directory backup and verify its hash.

**Step 2: Write focused tests**

Add tests proving all three boundaries:

```ts
it("round-trips paused agent status through the Paperclip sidecar", async () => {
  // Export one paused agent, assert manifest/.paperclip.yaml status,
  // import into a new company, and assert create receives status: "paused".
});

it("applies portable paused status when replacing an existing agent", async () => {
  // Import an inline package with status: paused using replace and assert
  // agents.update receives status: "paused".
});

it("rejects unsupported portable agent status", async () => {
  // Preview an inline package with status: running and assert a validation error.
});
```

The round-trip test must also prove an exported idle agent parses as `idle`, so omission of the default remains backwards compatible.

**Step 3: Run the focused test and confirm RED**

Run:

```sh
pnpm exec vitest run --project @paperclipai/server server/src/__tests__/company-portability.test.ts
```

Expected: the new tests fail because status is absent from the manifest contract, create is hardcoded to idle, replacement does not apply status, and unsupported values are not rejected. Existing tests should remain green.

### Task 3: Implement the portable `idle | paused` contract

**Files:**
- Modify: `packages/shared/src/types/company-portability.ts`
- Modify: `packages/shared/src/validators/company-portability.ts`
- Modify: `server/src/services/company-portability.ts`

**Step 1: Back up and verify all three existing files**

Create unique same-directory backups and verify their hashes.

**Step 2: Extend the shared type and validator**

Add the portable type and required manifest field:

```ts
export type CompanyPortabilityAgentStatus = "idle" | "paused";

export interface CompanyPortabilityAgentManifestEntry {
  // existing fields...
  status: CompanyPortabilityAgentStatus;
}
```

Add a backward-compatible validator default:

```ts
status: z.enum(["idle", "paused"]).default("idle"),
```

**Step 3: Parse and validate sidecar status**

Add a small service helper that defaults a missing sidecar value to `idle`, accepts only `idle` and `paused`, and throws the existing unprocessable import error for any other value. Use it when building each agent manifest entry from `.paperclip.yaml`.

**Step 4: Export only the non-default state**

Add this field to the agent extension:

```ts
status: agent.status === "paused" ? "paused" : undefined,
```

This preserves compact and backwards-compatible sidecars while making paused state explicit.

**Step 5: Apply status on create and replace**

Include `status: manifestAgent.status` in the shared agent patch used by replacement imports. Replace the create-only `createdStatus = "idle"` constant with `manifestAgent.status`, including the fallback used by `agentStatusById`.

**Step 6: Run the focused test and confirm GREEN**

Run:

```sh
pnpm exec vitest run --project @paperclipai/server server/src/__tests__/company-portability.test.ts
```

Expected: all company portability tests pass.

### Task 4: Repair Cognito Content work-product contracts

**Files:**
- Modify: `companies/cognito-content/.paperclip.yaml`
- Modify: `companies/cognito-content/agents/writer/AGENTS.md`
- Modify: `companies/cognito-content/agents/reviewer/AGENTS.md`
- Modify: `companies/cognito-content/agents/fb-publisher/AGENTS.md`
- Modify: `companies/cognito-content/skills/review-article/SKILL.md`
- Modify: `companies/cognito-content/skills/publish-to-facebook/SKILL.md`

**Step 1: Back up and verify every existing source file**

Create unique same-directory backups and verify their hashes.

**Step 2: Correct the contracts**

Use only the supported review states `none`, `pending_review`, `approved`, and `rejected`:

- Replace draft review-state instructions with `status: draft` plus `reviewState: none`.
- Replace `reviewState: reviewed` with `reviewState: approved`.
- Replace published review-state instructions with an active published work product: `status: active` and `reviewState: approved`.

Add `status: paused` to the `fb-publisher` entry in `.paperclip.yaml`. Do not encode running, error, or terminated runtime states.

**Step 3: Run the source contract check**

Run a repository text check excluding backups that fails if Cognito source contains `reviewState: draft`, `reviewState: reviewed`, or `reviewState: published`.

Expected: no matches.

### Task 5: Regenerate and inspect the Cognito ZIP

**Files:**
- Replace: `companies/cognito-content.zip`

**Step 1: Back up and verify the existing archive**

Create a unique same-directory backup and verify its hash.

**Step 2: Regenerate from source without archival files**

Use .NET `ZipArchive` to traverse `companies/cognito-content/`, skip every `.orig`/`.orig.*` file, normalize entry names to `/`, and create a fresh `companies/cognito-content.zip`. Do not update the old archive incrementally.

**Step 3: Inspect entries and contents in memory**

Open the archive with `ZipArchiveMode.Read` and assert:

- the ZIP entry set exactly matches the non-backup source file set;
- `.paperclip.yaml` is present and contains `fb-publisher` with `status: paused`;
- no entry name contains `.orig`;
- no archive Markdown contains `reviewState: draft`, `reviewState: reviewed`, or `reviewState: published`.

Expected: all assertions pass and the inspection prints a concise success summary.

### Task 6: Standardize and sanitize the live memory bank

**Files:**
- Create: `memory-bank/README.md`
- Modify: `.gitignore`
- Modify: `memory-bank/tasks/TASK001-initialize-memory-bank.md`
- Modify: `memory-bank/tasks/TASK002-install-launch-paperclip.md`
- Modify: `memory-bank/tasks/TASK003-cognito-content-company-package.md`
- Modify: `memory-bank/tasks/TASK004-correction-pass.md`
- Modify: `memory-bank/tasks/TASK005-memory-bank-and-package-remediation.md`
- Modify: `memory-bank/tasks/_index.md`
- Modify: `memory-bank/activeContext.md`
- Modify: `memory-bank/progress.md`
- Inspect: `memory-bank/projectbrief.md`
- Inspect: `memory-bank/productContext.md`
- Inspect: `memory-bank/systemPatterns.md`
- Inspect: `memory-bank/techContext.md`

**Step 1: Back up and verify each existing file before its first edit in this task**

Use fresh unique backups even when an earlier task already backed up a file.

**Step 2: Create the operating guide**

Document:

- source hierarchy: user/AGENTS instructions, executable implementation plan, task journal, active context, progress summary;
- owner: the builder executing the active task maintains the memory bank;
- triggers: task creation, plan approval/start, material implementation checkpoint, validation result, blocker/decision, and handoff/completion;
- task dimensions: task status, implementation status, validation status, activation/follow-up;
- archival policy: `.orig.*` files are immutable local safety backups, excluded from navigation/searches and ignored by Git;
- sensitivity policy: record conclusions and durable references, never raw secrets, secret IDs/fingerprints, auth headers, runtime UUIDs, database rows, commit hashes used only as transient evidence, or machine-specific absolute paths.

**Step 3: Ignore memory-bank backups**

Add:

```gitignore
memory-bank/**/*.orig
memory-bank/**/*.orig.*
```

**Step 4: Reduce TASK001 through TASK004 to durable records**

Preserve their purpose, outcomes, decisions, and validation conclusions. Remove machine-specific paths, transient live-runner and runtime/database snapshots, UUIDs, secret-derived identifiers or fingerprints, stale invalid review-state examples, and duplicated implementation logs.

**Step 5: Synchronize live status files**

Keep `_index.md` navigational, `activeContext.md` limited to current execution state/next action, and `progress.md` a concise cross-task summary. Keep all links relative and all task dimensions explicit.

**Step 6: Run live-memory checks**

Run checks excluding `.orig*` files for:

- Windows absolute paths;
- UUID-shaped values;
- SHA-like hashes presented as transient evidence;
- `secretId`, secret fingerprint, auth header, and database row/value language;
- invalid work-product review states;
- broken relative Markdown links.

Expected: no sensitive/stale matches and all links resolve.

### Task 7: Final verification and handoff state

**Files:**
- Modify: `memory-bank/tasks/TASK005-memory-bank-and-package-remediation.md`
- Modify: `memory-bank/tasks/_index.md`
- Modify: `memory-bank/activeContext.md`
- Modify: `memory-bank/progress.md`

**Step 1: Run focused and broad checks**

Run, without starting a server:

```sh
pnpm exec vitest run --project @paperclipai/server server/src/__tests__/company-portability.test.ts
pnpm -r typecheck
git diff --check
git status --short --branch
```

Also rerun the Cognito source/ZIP parity inspection and live memory-bank sensitivity/link checks.

Expected: tests and typechecks pass; diff check reports no whitespace errors; artifact and memory checks pass. Existing unrelated worktree changes may remain visible in status and must not be modified.

**Step 2: Update completion records**

Before editing, create and verify fresh backups. If every required gate passes, set TASK005 task status to `Completed`, implementation to `complete`, validation to `passed`, and activation/follow-up to `not_required`; move it to the completed index section and update active context/progress with concise verified results. If any gate fails, keep TASK005 in progress, set validation to `failed` or `blocked`, and record the exact remaining issue without claiming completion.

**Step 3: Review the complete diff**

Confirm the final diff contains only the portability contract/tests, Cognito package source/archive, implementation/design plans, and memory-bank remediation plus required safety backups. Do not stage or commit.
