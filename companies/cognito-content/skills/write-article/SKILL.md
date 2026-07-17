---
name: write-article
description: >
  Turn a cited outline into a long-form markdown article with a headline,
  deck, 3-6 sections, and inline source links. Use when an outline issue
  document is assigned to you.
recommendedForRoles:
  - general
tags:
  - writing
  - article
  - content
---

# Write Article

Turn a cited outline into a long-form markdown article. Every factual claim
links to its source. The tone is confident and plain-voiced.

## When to use

- An issue with an `outline` document has been assigned to you.
- You need to produce a draft article for the Reviewer.

## When not to use

- No `outline` document exists. Reassign back to the Researcher.
- The brief is for short-form social content, not a long-form article.

## Inputs

Before writing, read:
- The issue description (topic, audience, angle, word-count target).
- The `outline` issue document (keyed `outline`).
- The cited sources linked in the outline.

## Process

1. **Read the outline.** Understand the premise, section structure, and cited
   sources.

2. **Write the headline.** 12 words or fewer. Specific and compelling, not
   generic. Example: "Why Local-First Software Is Winning Developer Mindshare
   in 2026" not "Thoughts on Local-First Software."

3. **Write the deck.** One sentence below the headline that frames the article
   for the reader.

4. **Write 3-6 sections.** Follow the outline's section headings. Each section
   is 2-5 paragraphs. Total article length: 800-1500 words.

5. **Link every factual claim.** When you assert a fact, link it inline as
   `[text](url)` using the source URLs from the outline. Never assert a
   factual claim without a link.

6. **Write a conclusion.** Close with a short paragraph that ties the sections
   together. Do not introduce new claims in the conclusion.

7. **Save the draft.** Upsert issue document key `article-draft` with the
   article markdown before requesting the image. Keep the latest document body
   and revision id available for the later inline-image update.

8. **Run the hero-image gate.** Follow the Kie workflow below. Do not hand off
   an article that does not have a durable attachment, `hero-image` artifact,
   and inline Markdown image.

9. **Create the article work product.** Create or update the article work
   product with `status: draft` and `reviewState: none` only after the hero gate
   succeeds.

10. **Hand off.** Comment on the issue with a brief summary and reassign to the
   Reviewer only after every hero and article write has succeeded.

## Kie hero-image gate

The Kie plugin is autonomous. Do not ask for board confirmation after the tool's
preflight comment.

### 1. Build a stable request

Generate exactly one article hero on the first draft. Use the current issue id
and this default request unless the brief gives an approved visual direction:

```json
{
  "issueId": "<current-issue-id>",
  "requestKey": "hero-v1",
  "purpose": "Article hero image",
  "model": "gpt-image-2-text-to-image",
  "aspectRatio": "16:9",
  "resolution": "1K",
  "outputFormat": "png"
}
```

Call `paperclip.kie-image:generate_image` with that request and a prompt built
from the article headline, deck, topic, audience, and angle. Ask for a clean
editorial composition with useful negative space. Explicitly exclude readable
text, logos, watermarks, fabricated screenshots, and claims that the image
depicts a real person or event.

Reuse `hero-v1` when retrying the same visual request. The plugin's preflight
report is not a confirmation step; continue autonomously.

### 2. Wait for the provider result

Use `paperclip.kie-image:get_generation` with `refresh: true` until the
generation reaches `success`, `fail`, or `timeout`. A callback or issue wake may
arrive first; reread the generation and never submit a duplicate request for
the same request key. A successful generation must contain at least one result
URL. Select the first successful result URL as the single article hero; if no
URL exists, block Writer. Do not create multiple hero attachments for one
request.

### 3. Make the result durable

Kie result URLs are temporary. Download the selected result immediately to a
temporary local file, then upload its bytes to the current issue:

```text
POST ${PAPERCLIP_API_URL}/api/companies/${PAPERCLIP_COMPANY_ID}/issues/<issue-id>/attachments
multipart field: file
headers: Authorization: Bearer ${PAPERCLIP_API_KEY}
         X-Paperclip-Run-Id: ${PAPERCLIP_RUN_ID}
```

Do not print the authorization header, token, or temporary Kie URL. Capture the
returned attachment UUID and create the artifact work product:

```json
{
  "type": "artifact",
  "provider": "paperclip",
  "externalId": "<kie-generation-id>",
  "title": "Article hero image",
  "status": "ready_for_review",
  "reviewState": "none",
  "summary": "Durable Kie hero for the article draft.",
  "metadata": { "attachmentId": "<attachment-id>" }
}
```

POST it to
`/api/issues/<issue-id>/work-products` with the same authorization and run
headers. Paperclip canonicalizes the attachment metadata into the content,
open, and download paths; use those returned paths rather than inventing a
provider URL.

### 4. Insert the inline image and hand off

Update `article-draft` with the latest revision id and put this line immediately
below the deck, preserving the rest of the article and its source links:

```markdown
![Article hero image](/api/attachments/<attachment-id>/content)
```

Only after the attachment upload, `hero-image` artifact, and document update
return successfully may you create/update the article work product, comment,
and reassign to the Reviewer. The handoff comment should link the durable
attachment or work product, never the expiring Kie URL.

### Failure and limit handling

- Provider, download, upload, or document-update failures are transient unless
  the response clearly identifies a guardrail/quota limit. Keep the issue
  assigned to Writer, set it to `blocked`, comment the concrete retry action,
  and do not send it to the Reviewer.
- On a Kie guardrail/quota limit, do not retry around the limit. Comment the
  limit, current request, and next action, then reassign the issue to the
  Content Director/admin. The Reviewer must not receive the issue.
- Never include a Kie token, Paperclip bearer value, resolved secret, or raw
  provider error containing one in any issue comment, document, work product,
  or log.

## Revision loop

If the Reviewer requests revisions:
1. Read each comment carefully.
2. Address each comment specifically. Do not rewrite the whole article unless
   the comments require it.
3. Update the `article-draft` document.
4. Reuse the existing `hero-v1` attachment and inline path unless the board or
   issue explicitly requests a new visual direction. For a new direction, call
   Kie with `hero-v2` and run the same durability gate before replacing the
   inline image and updating the `hero-image` work product.
5. Reassign back to the Reviewer with a comment listing what you changed.

## Output

- Issue document key `article-draft` containing the full article markdown.
- A work product with `reviewState: none` on the issue.
- One durable `hero-image` artifact work product and one inline hero image below
  the deck.
- The article has: headline (<=12 words), deck (1 sentence), 3-6 sections,
  inline source links, conclusion. Total 800-1500 words.

## Anti-patterns

- Do not assert factual claims without a source link.
- Do not write generic filler ("in today's fast-paced world...").
- Do not hedge ("might possibly could be"). Write confidently.
- Do not plagiarize. Paraphrase and cite.
- Do not skip the work product creation.
- Do not reassign without commenting first.
