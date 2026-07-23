---
name: tavily-research
description: >
  Research a topic using the Tavily Search API and produce a cited outline
  grounded in current web sources. Use when you receive a content brief and
  need evidence before drafting.
recommendedForRoles:
  - researcher
tags:
  - research
  - tavily
  - web-search
  - citations
  - outline
---

# Tavily Research

Research a topic using the Tavily Search API and produce a cited outline that
the Writer can turn into a long-form article. Every section in the outline must
reference real sources retrieved from Tavily - never fabricated.

## When to use

- You received a content brief (topic + audience + angle) and need to gather
  evidence before producing an outline.
- The brief requires current, real-world sources that your training data may
  not cover.
- You need cited material to hand off to a Writer.

## When not to use

- The brief is purely opinion or creative writing with no factual claims.
- `TAVILY_API_KEY` is not in your env (report the blocker instead).
- You already have sufficient cited sources from a prior research pass on the
  same topic.

## Preconditions

- `TAVILY_API_KEY` must be present in your environment. If it is missing, stop.
  Comment on the issue with the blocker and reassign to the Content Director.
  Do not fabricate sources.
- Your runtime must provide an HTTP or web-call capability (e.g. WebFetch,
  `curl`, or the adapter's native web tool). Use whatever your runtime
  provides.

## The Tavily Search API contract

### Endpoint

```
POST https://api.tavily.com/search
Content-Type: application/json
Authorization: Bearer <TAVILY_API_KEY from env>
```

### Request headers

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `Authorization` | `Bearer <TAVILY_API_KEY>` — read the key from your env |

### Request body

```json
{
  "query": "your search query (keep under 400 characters)",
  "search_depth": "advanced",
  "max_results": 8,
  "include_answer": "advanced",
  "topic": "general"
}
```

### Key parameters

| Parameter | Type | Required | Values | Default | Notes |
|---|---|---|---|---|---|---|
| `query` | string | yes | search query | - | Keep under 400 characters. |
| `search_depth` | string | no | `basic`, `advanced`, `fast`, `ultra-fast` | `basic` | Use `advanced` for research (higher relevance). |
| `max_results` | integer | no | 1-20 | 5 | Use 8 for research. |
| `include_answer` | bool/string | no | `true`, `false`, `"basic"`, `"advanced"` | `false` | Use `"advanced"` for an optional AI-generated summary. Not primary evidence. |
| `topic` | string | no | `general`, `news`, `finance` | `general` | Use `"news"` only when the brief is explicitly news/timely. |
| `time_range` | string | no | `day`, `week`, `month`, `year` | null | Use only for fast-moving topics. |
| `include_domains` | array | no | `["example.com"]` | - | Restrict to specific domains. |
| `exclude_domains` | array | no | `["example.com"]` | - | Exclude specific domains. |

### Response shape

```json
{
  "answer": "AI-generated answer summary...",
  "results": [
    {
      "title": "Source Title",
      "url": "https://example.com/article",
      "content": "Content snippet from the source...",
      "score": 0.95,
      "published_date": "2026-01-15",
      "author": "Author Name",
      "domain": "example.com"
    }
  ],
  "response_time": "1.67",
  "usage": { "credits": 1 }
}
```

### How to call it

Use your runtime's HTTP or web-call capability. For example, if your runtime
provides a `curl` or `WebFetch` tool, make a POST request to
`https://api.tavily.com/search` with the `Authorization: Bearer <key>` header
and the JSON body above. The API key must NEVER appear in the request body.
Parse the JSON response. Do not name a specific tool vendor in your approach -
use whatever your runtime provides.

## Process

1. **Read the brief.** Extract the topic, audience, and angle from the issue
   or its parent brief.

2. **Decompose into queries.** Write 2-4 search queries that span the topic
   from broad to specific. For example, if the topic is "why local-first
   software is winning developer mindshare," your queries might be:
   - "local-first software trends 2026"
   - "local-first architecture adoption developers"
   - "local-first vs cloud-first developer survey"

3. **Call Tavily for each query.** Use `search_depth: "advanced"` and
   `max_results: 8`. Use `topic: "news"` only when the brief is explicitly
   news or time-sensitive; otherwise `general`. Use `time_range: "month"` only
   for fast-moving topics.

4. **Parse results.** For each response, read the `answer` field (an optional
   AI-generated orientation summary, not primary evidence) and the `results[]`
   array. Each result has `title`, `url`, `content` (a snippet), and `score`
   (relevance 0-1). Prefer results with `score >= 0.5`.

5. **Refine if needed.** If results are thin or off-angle, refine the query or
   use `include_domains`/`exclude_domains` to focus. Cap at about 6 Tavily
   calls per brief (budget and politeness).

6. **Synthesize the outline.** Write a cited outline with:
   - A title (working headline for the article).
   - A one-sentence premise.
   - 4-7 section headings, each with 2-4 bullet points.
   - Each section references its sources as `[Title](url)`.
   - Optionally include an "Orientation" block summarizing the Tavily `answer`
     for context. Do NOT quote it as evidence — all factual claims must be
     derived from individual `results[]` entries with specific source URLs.

## Output

Save the outline as an issue document with key `outline` via `documents.upsert`.
The document must be markdown. Example structure:

```markdown
# Why Local-First Software Is Winning Developer Mindshare

Premise: Developers are shifting toward local-first architectures because they
offer offline resilience, lower latency, and data ownership without sacrificing
collaboration.

## Section 1: The local-first revival
- Bullet point with a fact [Source Title](url)
- Bullet point with a fact [Source Title](url)

## Section 2: Why developers are switching
- ...

## Orientation
> The Tavily AI-generated summary provides context — verify claims against
> individual source URLs above.
```

After upserting, comment on the issue with a brief research summary and
reassign to the Writer.

## Error handling

| HTTP Status | Meaning | Action |
|---|---|---|
| 200 | Success | Parse results normally. |
| 401 | Invalid or expired API key | Stop immediately. Comment on the issue with the blocker and reassign to the Content Director. Do not retry. |
| 429 | Rate limited | Wait 15 seconds and retry once. If still 429, report the blocker and reassign to the Content Director. |
| 5xx | Server error | Wait 5 seconds and retry once. If still failing, report the blocker with the status code. |
| Usage limit | Account quota exceeded | Stop. Comment on the issue with the remaining quota status (Tavily response includes `usage.credits`). Reassign to the Content Director. |

When reporting a blocker, include: the HTTP status code, the number of queries
you ran, and the remaining credits if available.

## Anti-patterns

- Do not fabricate sources, URLs, or facts. If Tavily returns nothing useful,
  report the blocker.
- Do not paste raw `content` blobs from Tavily results into the outline.
  Synthesize and paraphrase.
- Do not skip citations. Every section must reference at least one source.
- Do not call Tavily more than about 6 times per brief.
- Do not treat the `answer` field as primary evidence. Use individual source
  URLs from `results[]` for factual claims.
- Do not put the API key in the request body. Use the Authorization header only.
- Do not log or expose the `TAVILY_API_KEY` value in comments, documents,
  requests, or logs.
