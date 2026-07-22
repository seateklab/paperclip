# Suijin Per-Topic Inbox Approvals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development) to implement this plan task-by-task.

**Goal:** Change the reusable Suijin workflow so every generated topic child creates its own Inbox-visible board approval and remains blocked until that specific approval is granted.

**Architecture:** Use Paperclip's existing first-class `request_board_approval` contract from the external Suijin skills package. Create one approval linked to one child issue, let Task Agent handle the approval wake, and have Facebook Writer verify the linked approval before writing. Remove the topic-level `request_confirmation` gate so the workflow has one canonical approval mechanism per topic.

**Tech Stack:** Markdown Agent Companies package, Node.js `node:test` contract test, existing Paperclip skill/MCP tools (`paperclipCreateApproval`, `paperclipListIssueApprovals`, `paperclipGetApproval`).

## Global Constraints

- Do not modify Paperclip server, UI, database, adapters, plugins, or runtime code.
- Do not mutate, resume, approve, repost, or otherwise operate on the discarded current SUI run.
- Create exactly one independent approval per topic child; never create one aggregate approval for multiple topics.
- Keep each child `in_review` until its own approval status is exactly `approved`.
- Preserve the existing final Facebook Publisher approval and Noto safeguards.
- Do not add credentials, direct Facebook APIs, raw HTTP/PowerShell calls, or new dependencies.

---

### Task 1: Replace the topic gate with one first-class approval per child

**Files:**
- Modify: `companies/suijin-content/skills/create-reviewed-topic-tasks/SKILL.md`
- Modify: `companies/suijin-content/agents/task-agent/AGENTS.md`
- Test: `companies/suijin-content/tests/suijin-pipeline-contract.test.mjs`

**Interfaces:**
- Consumes: each created/reused topic child ID, the current Task Agent ID, company ID, and the existing `paperclipCreateApproval`/`paperclipGetApproval` tools.
- Produces: exactly one `request_board_approval` linked to each child; an approval wake that releases only the approved child to `facebook-writer`.

- [ ] **Step 1: Update the contract test first**

Replace assertions that require `request_confirmation`, exact approval comments, and child interactions with assertions requiring:

```js
assert.match(taskSkill, /request_board_approval/);
assert.match(taskSkill, /paperclipCreateApproval/);
assert.match(taskSkill, /issueIds.*child/i);
assert.match(taskSkill, /exactly one.*approval/i);
assert.match(taskSkill, /PAPERCLIP_APPROVAL_ID/);
assert.match(taskSkill, /status.*approved/i);
assert.match(taskSkill, /facebook-writer/);
assert.doesNotMatch(taskSkill, /request_confirmation/);
assert.doesNotMatch(writerSkill, /request_confirmation/);
```

Also require package documentation to state that every child has an independent Inbox item and that approving one child does not release its siblings.

- [ ] **Step 2: Run the contract test and verify the expected failure**

Run:

```powershell
node --test companies/suijin-content/tests/suijin-pipeline-contract.test.mjs
```

Expected: FAIL because the current package still requires `request_confirmation` and does not describe per-child first-class approvals.

- [ ] **Step 3: Rewrite the topic-gate skill**

Change the per-result algorithm to:

```text
1. Reuse or create exactly one child for the research result marker.
2. Ensure the child has the required topic fields and is assigned to Task Agent.
3. List approvals linked to that child. Reuse the existing topic approval when present.
4. If none exists, create exactly one request_board_approval with:
   requestedByAgentId = the current Task Agent,
   issueIds = [childId],
   payload = { title, summary, recommendedAction, topic, targetPage, language, sources }.
5. Keep the child in_review while the approval is pending or revision_requested.
6. Do not create request_confirmation interactions or use comment text as approval.
```

Add an approval-wake section requiring the Task Agent to fetch the approval named by `PAPERCLIP_APPROVAL_ID`, verify it is linked to exactly one expected child and has status exactly `approved`, then patch only that child to `todo` and assign `facebook-writer`. Rejected, pending, missing, mismatched, or revision-requested approvals must leave that child in `in_review` with a visible owner/action; sibling children must not change.

- [ ] **Step 4: Update Task Agent instructions**

State that topic review is driven by one linked first-class approval per child, that approval wakes are handled using `PAPERCLIP_APPROVAL_ID` and `PAPERCLIP_APPROVAL_STATUS`, and that only the matching approved child may be released.

- [ ] **Step 5: Run the contract test and verify it passes**

Run the same `node --test` command and expect PASS.

### Task 2: Make Facebook Writer consume the per-topic approval

**Files:**
- Modify: `companies/suijin-content/agents/facebook-writer/AGENTS.md`
- Modify: `companies/suijin-content/skills/write-facebook-post/SKILL.md`
- Test: `companies/suijin-content/tests/suijin-pipeline-contract.test.mjs`

**Interfaces:**
- Consumes: one child issue and its linked approvals through `paperclipListIssueApprovals` and `paperclipGetApproval`.
- Produces: writing only after the child’s individual board approval is freshly verified as `approved`.

- [ ] **Step 1: Add failing Writer contract assertions**

Require the Writer files to mention `paperclipListIssueApprovals`, `paperclipGetApproval`, linked `request_board_approval`, exactly `approved`, and separate per-topic approval. Require them not to mention `request_confirmation` or exact approval-comment phrases.

- [ ] **Step 2: Run the focused contract test and verify failure**

Run:

```powershell
node --test companies/suijin-content/tests/suijin-pipeline-contract.test.mjs
```

Expected: FAIL on the old Writer gate assertions.

- [ ] **Step 3: Update Writer preflight**

Replace interaction/comment inspection with this contract:

```text
List approvals linked to the child. Require exactly one topic approval of type
request_board_approval for the current topic. Fetch that approval immediately
before writing and require status exactly approved. Pending, rejected,
revision_requested, missing, duplicate, or mismatched approvals visibly block
and leave the child in_review. Do not infer approval from comments or a parent
issue. Only after the child approval passes may the Writer create facebook-post
and assign Image Agent.
```

Keep all existing UTF-8 readback and source/Page validation requirements.

- [ ] **Step 4: Update the Writer agent instructions**

Use the same linked-approval preflight and explicitly state that approval of another topic never authorizes this child.

- [ ] **Step 5: Run the focused contract test and verify it passes**

Run the same `node --test` command and expect PASS.

### Task 3: Synchronize package documentation and workflow diagram

**Files:**
- Modify: `companies/suijin-content/COMPANY.md`
- Modify: `companies/suijin-content/projects/suijin/PROJECT.md`
- Modify: `companies/suijin-content/README.md`
- Test: `companies/suijin-content/tests/suijin-pipeline-contract.test.mjs`

**Interfaces:**
- Consumes: the Task Agent and Writer contracts from Tasks 1–2.
- Produces: package documentation that describes the Inbox-visible, independent approval behavior without implying a Paperclip app change.

- [ ] **Step 1: Update documentation assertions first**

Add assertions for `request_board_approval`, `paperclipCreateApproval`, separate/independent approvals, Inbox visibility, and “approve one topic” behavior. Remove assertions for `request_confirmation` and exact approval comments.

- [ ] **Step 2: Run the contract test and verify failure**

Run the focused test and expect FAIL because the docs still describe the old interaction/comment gate.

- [ ] **Step 3: Update the company, project, and README workflow text**

Describe the flow as:

```text
Research results
  -> one child per topic
  -> one request_board_approval per child
  -> separate Inbox items
  -> approve one child
  -> Facebook Writer for that child only
```

State that all other children remain in review until individually approved, and keep the final Publisher approval as a separate later gate.

- [ ] **Step 4: Run the package contract test**

Run:

```powershell
node --test companies/suijin-content/tests/suijin-pipeline-contract.test.mjs
```

Expected: PASS.

### Task 4: Final validation and handoff

**Files:**
- Verify: all files changed by Tasks 1–3

- [ ] **Step 1: Review the diff for scope**

Run:

```powershell
git diff -- companies/suijin-content docs/superpowers/plans/2026-07-22-suijin-per-topic-inbox-approvals.md
```

Confirm no `server/`, `ui/`, `packages/`, database, plugin runtime, live API, or current-issue mutation is present.

- [ ] **Step 2: Run whitespace and package checks**

Run:

```powershell
git diff --check
node --test companies/suijin-content/tests/suijin-pipeline-contract.test.mjs
```

Expected: both commands succeed.

- [ ] **Step 3: Report the fresh-run procedure**

Before testing, import or sync the updated Suijin company package as appropriate, discard the old SUI run, create a new root issue, and verify the Inbox contains one approval item per generated child before approving any of them. Do not approve or resume the discarded run during validation.
