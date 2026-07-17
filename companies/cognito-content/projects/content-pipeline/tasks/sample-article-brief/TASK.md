---
name: Write an article on local-first software
assignee: content-director
project: content-pipeline
---

Write a 1000-word article on **why local-first software is winning developer
mindshare in 2026**.

- **Audience:** technical product managers who are evaluating architecture
  choices for their next application.
- **Angle:** evidence-based. Cite real sources showing adoption trends,
  developer survey data, and concrete examples of local-first tools and
  frameworks.
- **Constraints:**
  - 800-1500 words.
  - Every factual claim must link to a real source.
  - Use the Tavily Search API to find current sources (the Researcher handles
    this).
  - The Reviewer will verify every claim against its source before approving.
  - Before handing off, the Writer must generate exactly one `hero-v1` image
    with the Kie Image Generation plugin, download it from the temporary Kie
    URL, upload it as a durable Paperclip issue attachment, and create a
    `hero-image` artifact work product.
  - The Writer must insert
    `![Article hero image](/api/attachments/<attachment-id>/content)` directly
    below the deck in `article-draft`. The Reviewer must not receive the issue
    until the attachment, artifact, and inline image are saved.
  - If Kie reports a guardrail or quota limit, the Writer must record the
    limit and next action without retrying around it, then reassign to the
    Content Director/admin. Do not hand off an incomplete draft.

This is a starter task to smoke-test the full pipeline (Content Director ->
Researcher -> Writer -> Reviewer). Assign it to the Content Director and watch
the pipeline flow through issue reassignment, document upserts, and
work-product state changes.
