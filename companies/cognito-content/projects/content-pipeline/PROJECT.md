---
name: Content Pipeline
description: Article production pipeline - from topic brief to reviewed, publication-ready article
owner: content-director
---

# Content Pipeline

This project is the home for all article briefs that flow through the Cognito
Content pipeline. Each brief enters as a task assigned to the Content Director,
who delegates it through the Researcher, Writer, and Reviewer.

## How it works

1. A brief task is created in this project and assigned to the Content
   Director.
2. The Content Director creates a child issue for the Researcher with the
   topic, audience, and angle.
3. The Researcher produces a cited outline using the Tavily Search API.
4. The Writer turns the outline into a long-form cited article and upserts the
   `article-draft` document.
5. Before handoff, the Writer runs the Kie hero gate described below. The
   Reviewer receives the issue only after the hero is durable and referenced
   inline in `article-draft`.
6. The Reviewer checks accuracy, structure, voice, citations, length, and the
   hero image - either requesting revisions or approving the final article.
7. The Content Director closes the brief when the article is final.

## Hero gate

The Writer owns the article's visual. For each issue, it reuses request key
`hero-v1` for revisions and calls `paperclip.kie-image:generate_image` with
model `gpt-image-2-text-to-image`, aspect ratio `16:9`, resolution `1K`, and
PNG output. The prompt is derived from the headline, deck, topic, audience,
and angle, and must exclude readable text, logos, watermarks, fabricated
screenshots, and unsupported real-person or event claims.

After the generation reaches a terminal success state, the Writer downloads
the temporary Kie URL immediately, uploads the bytes to the issue as a
Paperclip attachment, and creates one `hero-image` artifact work product. It
then inserts `![Article hero image](/api/attachments/<attachment-id>/content)`
below the deck in `article-draft`. The Reviewer handoff occurs only after all
of these writes succeed. Temporary Kie URLs are never the deliverable.

Transient generation, download, upload, or document failures keep the issue
with the Writer for recovery. A Kie guardrail or quota limit is reported with
the limit and next action, then escalated to the Content Director/admin; the
Writer does not retry around a limit and does not send the Reviewer an
incomplete draft.

## Starter tasks

- `sample-article-brief` - a smoke-test brief on local-first software to
  verify the full pipeline, including durable Kie hero storage and the
  Reviewer handoff gate, works end to end.
