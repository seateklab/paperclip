# Kie Hero Image Integration for Cognito Content

## Goal

Extend the existing Cognito Content article pipeline so the Writer autonomously
creates one KieAPI hero image, stores it as a durable Paperclip attachment, and
shows it inline in the article Markdown before the Reviewer receives the issue.

## Approved scope

The integration is company-package-only. It changes Writer instructions,
company documentation, the Content Pipeline sample brief, and a small static
contract test. It does not change Paperclip core, the Kie plugin runtime, the
agent adapter, or the pipeline's existing Researcher -> Writer -> Reviewer
handoff model.

The Writer remains responsible for the image because it already owns the
article draft. No Visual Producer agent or Kie-specific core workflow hook is
introduced.

## Workflow

1. The Writer reads the issue brief and cited `outline` document.
2. The Writer writes and upserts the `article-draft` Markdown document.
3. The Writer calls `paperclip.kie-image:generate_image` using the current
   company/run context and the stable request key `hero-v1`.
4. The Writer monitors the generation until it reaches a terminal status.
5. On success, the Writer downloads the temporary Kie result URL immediately,
   uploads the bytes as a Paperclip issue attachment, and creates a durable
   `hero-image` artifact work product containing the attachment paths and Kie
   generation id.
6. The Writer updates `article-draft` by placing an inline Markdown image
   immediately below the deck:

   ```markdown
   ![Article hero image](/api/attachments/<attachment-id>/content)
   ```

7. Only after the attachment, work product, and document update succeed does
   the Writer comment and reassign the issue to the Reviewer.
8. The Reviewer reviews the article and image together. On approval, its
   existing `article-final` copy retains the same Markdown image and artifact.

## Image contract

The Writer uses these defaults unless the brief explicitly supplies a
different approved visual direction:

- request key: `hero-v1`;
- model: `gpt-image-2-text-to-image`;
- aspect ratio: `16:9`;
- resolution: `1K`;
- output format: `png`;
- prompt inputs: headline, deck, topic, audience, and angle;
- exclusions: readable text, logos, watermarks, fabricated screenshots, and
  claims that the image depicts a real person or event.

Revision loops reuse the existing `hero-v1` generation and attachment. A new
image is created only when the board or the issue explicitly requests a new
visual direction, using a new request key such as `hero-v2`.

## Failure and escalation policy

- A transient provider or download/upload failure blocks the Writer handoff.
  The Writer comments the concrete failure and remains assigned so the work can
  be retried without sending an incomplete article to review.
- A Kie guardrail or quota failure blocks the handoff, comments the limit,
  current request, and next action, then reassigns the issue to the Content
  Director/admin. The Writer must not retry around a limit and the Reviewer
  must not receive the issue.
- No failure comment, document, work product, or log may contain a Kie token,
  Paperclip bearer value, or resolved secret.

## Files in the implementation

- `companies/cognito-content/agents/writer/AGENTS.md` — add the Kie hero step,
  success gate, retry behavior, and admin escalation rules.
- `companies/cognito-content/skills/write-article/SKILL.md` — define the exact
  Kie invocation, prompt recipe, attachment/work-product calls, inline Markdown
  update, idempotent revision behavior, and failure handling.
- `companies/cognito-content/COMPANY.md` — document the Writer -> Kie ->
  Reviewer handoff and the company secret prerequisite.
- `companies/cognito-content/README.md` — update setup and smoke-test guidance
  for the hero-image output.
- `companies/cognito-content/projects/content-pipeline/PROJECT.md` — describe
  the hero-image gate in the project flow.
- `companies/cognito-content/projects/content-pipeline/tasks/sample-article-brief/TASK.md` —
  require one hero image so the smoke test exercises the integration.
- `companies/cognito-content/tests/kie-hero-pipeline-contract.test.mjs` —
  assert that the imported company instructions contain the Kie tool,
  `hero-v1`, inline image output, success gate, and admin escalation contract.

## Verification

The implementation must pass the static contract test and the repository's
available type/test checks. A live smoke run with the configured company Kie
secret must demonstrate:

- the Writer creates `article-draft` and a successful Kie generation;
- the issue has one durable image attachment and `hero-image` work product;
- `article-draft` visibly renders the hero image inline;
- the Reviewer handoff occurs only after the image is durable;
- a forced limit response reassigns to the Content Director/admin and leaves
  the Reviewer untouched.

The live smoke run must not record the Kie token or resolved secret.

## Out of scope

- changing Kie provider models or guardrails;
- adding a new agent or scheduler stage;
- automatic social/Facebook image publishing;
- embedding image bytes as base64 in Markdown;
- redesigning Paperclip documents, attachments, or work products;
- changing the existing article review criteria.
