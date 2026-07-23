---
name: Cognito Content
description: A content-marketing company that turns a topic brief into a reviewed, publication-ready article
slug: cognito-content
schema: agentcompanies/v1
version: 0.1.0
license: MIT
goals:
  - Turn topic briefs into cited, reviewed, publication-ready articles
requirements:
  secrets:
    - TAVILY_API_KEY
    - KIE_API_KEY
---

# Cognito Content

Cognito Content is a content-marketing company that takes a topic brief and
produces a cited, reviewed, publication-ready long-form article through a
linear agent pipeline.

## Workflow

The company runs as a **pipeline**. Work enters at the Content Director and
flows through research, writing, and review by issue reassignment. Each
reassignment auto-wakes the next agent. Drafts flow as keyed issue documents
and work products with a review state of `none` -> `approved` -> (future)
`published`.

```
Board brief
    |
    v
Content Director  ----creates child article issue--->  Researcher
                                                            |
                                                            |  (Tavily research + cited outline)
                                                            v
                                                         Writer
                                                            |
                                                            |  (article draft + durable Kie hero image)
                                                            v
                                                         Reviewer
                                                           / \
                                    revision <-----+------+-----> approve
                        (reassign back to Writer)              |
                                                            v
                                                    Content Director
                                                            |
                                                            |  (closes brief; article is final)
                                                            v
                                                         Done

Future: FB Publisher (parked) -- board approval gate -> Facebook Graph API
```

## Org chart

| Agent | Title | Role | Reports to | Skills | Status |
|---|---|---|---|---|---|
| content-director | Content Director | cmo | - | paperclip, task-planning | active |
| researcher | Research Analyst | researcher | content-director | paperclip, tavily-research, agent-browser | active |
| writer | Article Writer | general | content-director | paperclip, write-article, kie-image-generation | active |
| reviewer | Editorial Reviewer | qa | content-director | paperclip, review-article | active |
| fb-publisher | Facebook Publisher | general | content-director | paperclip, publish-to-facebook | parked |

## Projects

- **Content Pipeline** (`content-pipeline`) - owned by the Content Director.
  The home for all article briefs. Each brief enters as a task in this project
  and flows through the Researcher, Writer, and Reviewer. Includes a
  `sample-article-brief` starter task for smoke-testing the pipeline.

## Handoff contract

1. The board assigns a brief issue to the Content Director.
2. The Content Director creates a child `article` issue assigned to the
   Researcher with the topic, audience, and angle.
3. The Researcher runs the `tavily-research` skill, upserts an issue document
   keyed `outline`, and reassigns to the Writer.
4. The Writer writes the long-form article and upserts a document keyed
   `article-draft`. Before any review handoff, the Writer runs the Kie hero
   gate: it generates one `hero-v1`, downloads the temporary result, stores a
   durable Paperclip issue attachment, creates a `hero-image` artifact work
   product, and inserts the attachment Markdown below the deck. Only after
   those writes succeed does the Writer create/update the article work product
   with `reviewState: none` and reassign to the Reviewer.
5. The Reviewer either requests revision (comments and reassigns back to the
    Writer) or approves (upserts `article-final`, updates the work product to
    `reviewState: approved`, reassigns to the Content Director).
6. The Content Director closes the parent brief. The article is final.
7. The FB Publisher is parked. When activated, it sits after the Reviewer and
   is gated by a `request_board_approval` before calling the Facebook Graph
   API.

## Secrets

- `TAVILY_API_KEY` - required by the Researcher for the Tavily Search API.
  Store as a company secret and bind it to the researcher agent's env.
- `KIE_API_KEY` - required by the Writer's Kie Image Generation plugin.
  Create this company secret and select its Paperclip secret reference in
  Instance Settings -> Plugins -> Kie Image Generation. Never paste the raw
  token into an issue, document, work product, or agent instructions.
- `FACEBOOK_PAGE_ACCESS_TOKEN` - optional, only needed when the FB Publisher is
  activated. Store as a company secret.

## Adapter note

No adapter is pinned in `.paperclip.yaml`; Paperclip uses its default. The
chosen adapter's runtime must provide an HTTP or web-call capability so the
Researcher can reach the Tavily Search API. Compatible runtimes include
`opencode_local` (webfetch + bash), `claude_local` (WebFetch), and
`codex_local` (native web tool).

## References

- Agent Companies specification: https://agentcompanies.io/specification
- Paperclip: https://github.com/paperclipai/paperclip
