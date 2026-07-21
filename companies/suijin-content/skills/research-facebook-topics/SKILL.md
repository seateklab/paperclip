---
name: research-facebook-topics
description: Research current source-backed topics for a Suijin root issue
---

# Research Facebook Topics

Use this skill only for a Suijin root issue. Read the issue's literal
`Research request:`, `Language:`, `Target Facebook Page:`, and optional
`Result count:` fields. The request and Page must be non-empty. If the Page is
still the starter placeholder, block and return ownership to Task Agent.

## Search contract

Use the configured `TAVILY_API_KEY` secret reference with Tavily. Derive 2-6
focused queries from the request, audience, language, and currentness
requirements; never hard-code a subject or silently replace the request. Cap
provider calls at six for one root request. Deduplicate overlapping results
and prefer primary, official, reputable, and current sources. Use
`agent-browser` only when a selected source requires JavaScript rendering; do
not use it to invent evidence or bypass access controls.

Use the requested result count when present. If omitted, return exactly five
usable results. Every result must have a distinct topic title, a concise
rationale explaining relevance, and at least one real source URL. Reject
empty, malformed, duplicate, or unsupported results rather than filling gaps
with guesses. Source URLs must be read back from the provider output and must
not be invented.

## Durable output

Upsert one issue document with key `research-results` and this Markdown shape:

```markdown
# Research results

## 1. <Topic title>
Rationale: <why this topic fits the request>
Sources: [<source title>](<real source URL>)

## 2. <Topic title>
Rationale: <why this topic fits the request>
Sources: [<source title>](<real source URL>)
```

The example URL above is structural notation only; never use it as a source.
The saved document must contain the final count, titles, rationales, and real
Markdown source links. Read the saved revision back as UTF-8 before handing it
to Task Agent. Comment the summary and next action, then reassign the issue.
Provider failure or insufficient usable evidence is a visible blocker owned by
Task Agent; do not fabricate output or fall back to another provider.
