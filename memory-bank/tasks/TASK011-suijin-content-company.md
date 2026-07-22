# [TASK011] - Create and activate the Suijin Content company package

## Status

**Task status:** completed
**Implementation:** complete
**Validation:** passed
**Activation/follow-up:** pending_user
**Created:** 2026-07-20
**Owner:** Paperclip session work

## User goal

Create a standalone Agent Companies package for a company named **Suijin
Content**, with a project named **Suijin**, that turns open-ended research into
human-reviewed Facebook posts and publishes them through an external Noto
plugin only after final board approval.

The approved workflow is:

```text
Research request
  -> Research Agent writes research-results
  -> Task Agent creates one child per result
  -> one independent request_board_approval per topic child
  -> Facebook Writer writes facebook-post
  -> Image Agent creates durable Kie image attachment/artifact
  -> final board approval
  -> Facebook Publisher uses external managed Noto skill
  -> publication artifact and permalink
```

## Decisions locked during this session

- Suijin is a new standalone company; it does not replace or nest inside
  Cognito Content.
- The human board operator is the CEO. No sixth CEO agent is created.
- Exactly five agents exist. Task Agent is the root coordinator:
  - `task-agent` - Task Agent, `reportsTo: null`
  - `research-agent` - Research Agent, reports to Task Agent
  - `facebook-writer` - Facebook Writer, reports to Task Agent
  - `image-agent` - Image Agent, reports to Task Agent
  - `facebook-publisher` - Facebook Publisher, reports to Task Agent
- Orchestration is package-only. No Suijin-specific Paperclip core workflow
  automation was added.
- Topic approval is a first-class board approval. Each topic child has exactly
  one linked `request_board_approval`, appears as its own Inbox item, and stays
  in `in_review` until that approval's status is exactly `approved`.
- Final publication always requires a linked, approved
  `request_board_approval`.
- Noto remains external. Suijin uses managed-skill discovery and does not
  hard-code Noto tool names, endpoints, namespaces, credentials, or direct
  social-network API fallbacks.
- Language inherits from the issue. If `Language:` is omitted, Vietnamese is
  the default.
- The root issue requires literal `Research request:`, `Language:`, and
  `Target Facebook Page:` labels. Request and Page are mandatory.
- The Publisher is active/idle-by-default, not package-paused. The final board
  approval is the publication safety gate.
- Kie image generation uses request key `facebook-image-v1`, model
  `gpt-image-2-text-to-image`, aspect ratio `1:1`, resolution `1K`, and PNG.
- Image output must be downloaded immediately, stored as exactly one durable
  Paperclip attachment, and represented by one `paperclip-attachment` artifact
  before Publisher assignment. Temporary provider URLs, SVGs, and placeholder
  outputs are forbidden.
- Live verification must use only a dedicated Facebook test Page. Production
  publication is never a smoke test.

## Approved design and implementation plan

The brainstorming/design phase produced and received approval for:

- Design artifact: `local://suijin-company-design.md`
- Canonical implementation plan: `local://suijin-company-plan.md`

The plan required a failing static contract test first, followed by metadata,
research/task coordination, Facebook writing, the image stage, Noto approval
publication, and portability/import verification.

## Repository package created

The package lives at:

```text
companies/suijin-content/
```

Created files:

- `COMPANY.md`
- `.paperclip.yaml`
- `README.md`
- `LICENSE`
- `tests/suijin-pipeline-contract.test.mjs`
- `agents/task-agent/AGENTS.md`
- `agents/research-agent/AGENTS.md`
- `agents/facebook-writer/AGENTS.md`
- `agents/image-agent/AGENTS.md`
- `agents/facebook-publisher/AGENTS.md`
- `projects/suijin/PROJECT.md`
- `projects/suijin/tasks/sample-research-request/TASK.md`
- `skills/research-facebook-topics/SKILL.md`
- `skills/create-reviewed-topic-tasks/SKILL.md`
- `skills/write-facebook-post/SKILL.md`
- `skills/verifying-published-text/SKILL.md`
- `skills/publish-facebook-via-noto/SKILL.md`

The Unicode verification skill was copied from the verified Cognito Content
skill without changing its content during the initial implementation.

## Package behavior

### Research Agent

- Validates the root request and Page before searching.
- Uses `TAVILY_API_KEY` and derives 2-6 queries from the issue.
- Caps Tavily calls at six per request.
- Defaults to exactly five usable results.
- Prefers current, primary, official, or reputable sources.
- Saves numbered Markdown under document key `research-results`.
- Every result contains a title, rationale, and real source URL.
- Reads the saved revision back as UTF-8 before handoff.
- Returns malformed, empty, or unusable research visibly to Task Agent without
  fabricating results or URLs.

### Task Agent

- Lists direct children and matches the exact description marker
  `Research result: N`.
- Reuses an existing result child and never duplicates a result number.
- Creates unmatched children with parent/project/goal linkage, `todo` status,
  resolved `assigneeAgentId`, and fields for result number, topic, rationale,
  language, Page, and sources.
- Creates or reuses exactly one linked `request_board_approval` per child
  before leaving the topic in `in_review`.
- On an approval wake, fetches the named approval and releases only its matching
  child when the type, linkage, and status are exact; sibling children stay in
  review.
- Never infers approval from a comment, parent approval, or sibling approval.

### Facebook Writer

- Requires the exact linked topic approval to be freshly fetched as `approved`,
  plus sources and Page.
- Writes direct Facebook Markdown under `facebook-post`.
- Inherits issue language, defaulting to Vietnamese.
- Performs UTF-8 inspection and saved-document readback.
- Assigns Image Agent only after durable persistence and readback succeed.
- Does not research, generate images, approve, or publish.

### Image Agent

- Reads `facebook-post` and derives a truthful visual prompt.
- Calls the managed Kie skill with the locked model/settings.
- Avoids readable text, logos, watermarks, fabricated screenshots, and
  unsupported real-person/event claims.
- Downloads the successful result immediately.
- Uploads exactly one issue attachment.
- Creates the `facebook-image` artifact with attachment paths, MIME type, and
  integer byte size.
- Assigns Facebook Publisher only after both attachment and artifact creation.
- Reuses the request key/artifact on retries and fails closed on ambiguous
  outcomes.

### Facebook Publisher

- Verifies `facebook-post`, one active attachment-backed image artifact,
  concrete target Page, installed `noto` skill, and absence of successful
  publication.
- Lists linked approvals before creating a new one.
- Reuses pending or revision-requested approvals.
- Blocks rejected approvals until a valid board resubmission.
- Creates one `request_board_approval` only when no linked approval exists.
- Uses payload fields `action`, `targetPage`, `documentKey`,
  `imageWorkProduct`, and `publicationKey`.
- Loads only the installed managed Noto skill after approval status is exactly
  `approved`.
- Creates a `provider: "noto"` publication artifact with external post ID,
  permalink, publication key, and target Page.
- Comments the permalink and marks the topic done.
- Does not blindly retry an ambiguous Noto timeout.
- Uses the bundled UTF-8-safe `paperclip-plugin-tool.mjs` transport and reads
  the published Facebook body back before creating the publication artifact or
  marking the topic done.

## Static contract test

The test file is:

```text
companies/suijin-content/tests/suijin-pipeline-contract.test.mjs
```

It verifies metadata, reporting, exact skill lists, project/task linkage,
research output, per-topic approval semantics, UTF-8 behavior, Kie settings,
durable artifact ordering, Noto approval payload, published-body readback,
prohibited credential/API patterns, and sidecar env declarations.

## Validation completed during this session

From `D:/Paperclip`:

```text
node --test companies/suijin-content/tests/suijin-pipeline-contract.test.mjs
```

Result: passed, 1 test, 0 failures.

```text
pnpm exec vitest run --project @paperclipai/server server/src/__tests__/company-portability.test.ts
```

Result: passed, 49 tests, 0 failures.

An isolated Paperclip smoke instance was also started on port 3110 with an
isolated `PAPERCLIP_HOME`. Import preview and apply both succeeded. The
isolated instance created five agents, one project, one starter issue, and the
five package skills. Imported agents were correctly linked, Publisher was
idle/not paused, and no secret values were returned. The isolated server was
stopped afterward.

## Current running-dev-server activation

The current dev server was healthy at:

```text
http://127.0.0.1:3100
```

Health returned status `ok` with local-trusted deployment mode.

The company was imported into that running instance:

- Company: `Suijin Content`
- Company ID: `57b0a2e8-a5bc-4102-a9c3-d0a92f8192f6`
- Project: `Suijin`
- Project ID: `58a56748-41ca-49c9-a466-abca4242b128`
- Task Agent ID: `308a8ed8-99c7-4b4b-a625-f8721a9cf298`
- Research Agent ID: `e6f9ff95-ab38-40b1-aefd-24e3d2ddc19c`
- Facebook Writer ID: `feb025c3-5e2f-41a5-9a3a-a37174ba897c`
- Image Agent ID: `fd026727-44cc-42ec-81ca-f606bb0693fa`
- Facebook Publisher ID: `86b83201-2d44-4bba-b366-6a45a941baf0`

The import emitted expected warnings that referenced runtime skills are not
vendored in the package: `paperclip`, `noto`, `agent-browser`, and
`kie-image-generation`.

## Issue created in the current instance

A new issue was created exactly from the user's supplied Vietnamese title and
description:

- Identifier: `SUI-2`
- Issue ID: `8fb90368-d0cc-4b92-8bb3-934098a9207f`
- Company ID: `57b0a2e8-a5bc-4102-a9c3-d0a92f8192f6`
- Project: `Suijin`
- Assignee: Research Agent
- Status: `backlog`
- Parent: none
- Started: no
- `startedAt`: `null`
- `checkoutRunId`: `null`
- `executionRunId`: `null`

The issue was deliberately created in `backlog`, so it has not started or
entered an agent checkout. Its title and description were preserved in UTF-8.
The title includes the user's `<tên trang>` Page placeholder; it must be
replaced with a dedicated Noto-recognized test Page before activation.

## Activation prerequisites and next action

Before moving `SUI-2` to `todo`:

1. Bind `TAVILY_API_KEY` to Research Agent.
2. Configure the managed Kie Image Generation plugin with a company-scoped
   secret reference.
3. Install the external Noto plugin.
4. Assign the installed managed `noto` skill to Facebook Publisher.
5. Configure Noto credentials and a dedicated test Page outside this package.
6. Replace the Page placeholder in `SUI-2`.
7. Move `SUI-2` to `todo` only when the agent runtime is configured.

Do not use a production Facebook Page for testing. No live Facebook/Noto
publication was attempted during this session.

## Repository state and safety notes

- Existing user changes in `pnpm-lock.yaml` and
  `server/src/services/heartbeat.ts` were preserved and not edited.
- The package was kept on the current branch/worktree; no push or merge was
  performed.
- `git diff --check` passed. Git reported only normal LF-to-CRLF warnings on
  Windows.
- No secret values, raw API keys, Facebook tokens, or private provider
  response data were written to this task.
- The response language preference in the related execution exchange was
  English only.
