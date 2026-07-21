---
name: write-facebook-post
description: Write a source-grounded Facebook post for an approved Suijin topic
---

# Write Facebook Post

Use this skill only after Task Agent has released a topic child through the
human topic gate.

## Topic gate preflight

Before writing, fetch the topic child's interactions and comments. Require a
request_confirmation interaction and identify the actual latest comment in
chronological order. That latest comment itself must be human-authored, and
its trimmed body is exactly Approved, Agree, Đồng ý, or Duyệt, case-insensitively. If the actual latest comment is agent-authored, even when
an earlier human comment says Approved, block with the owner and next action.
If the interaction is missing, pending, rejected, ambiguous, or superseded
without a fresh approval, block with the owner and next action. Do not write,
reassign, or continue while blocked. Do not create or overwrite facebook-post and do not assign Image Agent.

Missing or ambiguous topic-child fields, unresolved or non-accepted feedback,
and any missing, pending, rejected, ambiguous, or superseded gate must visibly
block and leave the child in_review. A Task Agent handoff comment alone is not
approval.
Only after this preflight passes, read the child's `Topic:`, `Rationale:`,
`Sources:`, `Language:`, and `Target Facebook Page:` fields. Missing topic,
sources, or Page remains a visible validation blocker; do not fill gaps
through fresh research or invented claims.

Inherit the issue's `Language:` exactly. If the field is omitted, default to
Vietnamese. Keep the post in that language unless the issue explicitly
requests another one. Stay grounded in the approved sources: do not invent
links, testimonials, statistics, quotes, events, or claims that the sources do
not support.

## Facebook document contract

Write one concise Markdown document keyed `facebook-post` with:

1. One clear hook that earns attention without clickbait.
2. Short body paragraphs with a useful explanation of the approved topic.
3. Optional bullets only when they improve scanning on Facebook.
4. One closing takeaway or call to action.
5. An optional `Sources` block when factual claims need transparent
   attribution, using only the real URLs from the approved topic.

Do not impose Cognito's article-length, deck, section, or Reviewer semantics.
The output is a direct Facebook post, not a long-form article and not a
publication approval.

Save the document through Paperclip, then read the saved revision back using
UTF-8. Check the hook, body, closing, Unicode characters, and source links
against the intended text. If readback differs, rewrite through the safe
Paperclip request path and verify again. Only after readback succeeds should
Facebook Writer comment the handoff and assign Image Agent. Leave the next
action durable and visible.
