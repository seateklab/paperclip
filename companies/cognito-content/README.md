# Cognito Content

A content-marketing agent company that turns a topic brief into a cited,
reviewed, publication-ready long-form article through a linear agent pipeline.

Built as an [Agent Companies v1](https://agentcompanies.io/specification)
package for [Paperclip](https://github.com/paperclipai/paperclip).

## How it works

1. You assign a brief (a topic + audience + angle) to the Content Director.
2. The Content Director delegates to the Researcher.
3. The Researcher uses the Tavily Search API to gather current, cited sources
   and produces a structured outline.
4. The Writer turns the outline into a long-form article (800-1500 words) with
   inline source links, then autonomously generates one KieAPI hero image. The
   Writer downloads the temporary Kie result immediately, stores it as a
   durable issue attachment, creates a `hero-image` artifact work product, and
   inserts the attachment as an inline Markdown image below the deck.
5. Only after the draft, hero attachment, hero work product, and inline image
   are durable does the Writer hand the issue to the Reviewer. The Reviewer
   checks accuracy, structure, voice, citations, length, and the image. It
   either requests specific revisions (looping back to the Writer) or approves
   and finalizes the article.
6. The Content Director closes the brief. The article is ready.

A Facebook Publisher agent is included but **parked**. It will be activated
once the article workflow is validated. When active, it publishes reviewed
articles to a Facebook Page via the Graph API after a board approval gate.

## Org chart

```
Content Director (cmo)
  |-- Researcher (researcher)      -- Tavily research + cited outline
  |-- Writer (general)             -- long-form cited article
  |-- Reviewer (qa)                -- editorial review + revision loop
  |-- FB Publisher (general)       -- PARKED, board-gated Facebook publishing
```

## Skills

| Skill | Used by | Purpose |
|---|---|---|
| `tavily-research` | Researcher | Call the Tavily Search API and produce a cited outline |
| `write-article` | Writer | Turn a cited outline into a long-form markdown article |
| `kie-image-generation` | Writer | Generate and persist one KieAPI hero image before review handoff |
| `review-article` | Reviewer | Review a draft against editorial criteria; revise or approve |
| `publish-to-facebook` | FB Publisher | DORMANT. Board-gated Facebook Graph API publishing |
| `paperclip` | all | Paperclip heartbeat and execution protocol (runtime skill) |
| `task-planning` | Content Director | Decompose briefs into child issues (catalog skill) |
| `agent-browser` | Researcher | Read JS-rendered pages when Tavily snippets are insufficient (catalog skill) |

The four custom skills live in `skills/<slug>/SKILL.md` inside this package.
`paperclip`, `task-planning`, and `agent-browser` are referenced by shortname
and resolve from the Paperclip runtime or skills catalog at import time.

## Projects

| Project | Owner | Purpose |
|---|---|---|
| `content-pipeline` | Content Director | All article briefs that flow through the pipeline |

The sample brief (`projects/content-pipeline/tasks/sample-article-brief/TASK.md`)
is a smoke-test task to verify the pipeline works end to end.

## Getting started

### 1. Import the company

```sh
paperclipai company import --from ./companies/cognito-content
```

### 2. Create the Tavily API key secret

Create a company secret for `TAVILY_API_KEY`:

```sh
# Via the board UI: Company -> Settings -> Secrets -> Create
# Name: TAVILY_API_KEY, Provider: Local encrypted, Value: <your-tavily-key>

# Or via CLI:
# Set TAVILY_API_KEY in the shell without putting the value in command history.
pnpm paperclipai secrets create -C <company-id> --name TAVILY_API_KEY --value-env TAVILY_API_KEY
```

Get your Tavily API key at https://app.tavily.com/api-key (starts with `tvly-`).

### 3. Install and configure the Kie Image Generation plugin

Install and enable the managed **Kie Image Generation** plugin from **Instance
Settings -> Plugins**. Its managed `kie-image-generation` skill must be
available to the Writer agent. Then create a company secret named
`KIE_API_KEY` and open the plugin configuration. Select the `KIE_API_KEY`
Paperclip secret reference in the plugin configuration and save it. The plugin
must receive a secret reference from this company; do not paste the raw Kie
token into the plugin textbox, an agent config, an issue, or a document.

The Writer uses the `gpt-image-2-text-to-image` model at `16:9`, `1K`, and
`png` by default. Kie result URLs are temporary, so the Writer downloads the
image and uploads the durable Paperclip attachment before handing off to the
Reviewer.

### 4. Bind the secret to the Researcher agent

Creating the secret stores it, but does NOT wire it to the agent. You must
bind it manually:

1. Go to the company → Agents → Researcher → Configuration → Env inputs.
2. Select `TAVILY_API_KEY` from the declared inputs.
3. Bind it to the secret created in step 2. This creates a `secret_ref`
   binding (`{ type: "secret_ref", secretId: "<uuid>", version: "latest" }`)
   in the agent's `adapterConfig.env`.

### 5. Pause the Facebook Publisher

The FB Publisher agent imports as `idle`. To prevent accidental wakeup, pause
it until the article workflow is validated:

- Board UI: Agents → FB Publisher → Pause
- CLI: `pnpm paperclipai agent update <agent-id> --status paused`

### 6. Install referenced catalog skills

If not already installed, install `task-planning` and `agent-browser` from the
skills catalog so the Content Director and Researcher can use them:

```sh
# Via the board UI: Company -> Skills -> Install from catalog
# Or via API:
# POST /api/companies/<company-id>/skills/install-catalog
#   { "catalogId": "paperclipai:bundled:paperclip-operations:task-planning" }
# POST /api/companies/<company-id>/skills/install-catalog
#   { "catalogId": "paperclipai:optional:browser:agent-browser" }
```

### 7. Run the sample brief

Assign the sample task (`projects/content-pipeline/tasks/sample-article-brief/TASK.md`)
to the Content Director via the board UI or API, then watch the pipeline flow
through issue reassignment, document upserts, and work-product state changes.
Verify that the Writer creates exactly one durable `hero-image` work product
and that `article-draft` contains the inline attachment image below the deck
before the Reviewer receives the issue. Move the issue from `backlog` to `todo`
status to trigger the assignment wakeup.

## Requirements

- A Paperclip instance with a default adapter whose runtime provides an HTTP or
  web-call capability (e.g. `opencode_local`, `claude_local`, `codex_local`).
- A [Tavily](https://tavily.com) API key stored as the `TAVILY_API_KEY` secret.
- A KieAPI key stored as the `KIE_API_KEY` company secret and selected by its
  Paperclip secret reference in the Kie Image Generation plugin.
- (Future) A Facebook Page access token stored as the
  `FACEBOOK_PAGE_ACCESS_TOKEN` secret, only when the FB Publisher is activated.

## License

MIT. See [LICENSE](./LICENSE).

## References

- [Agent Companies specification](https://agentcompanies.io/specification)
- [Paperclip](https://github.com/paperclipai/paperclip)
- [Tavily Search API docs](https://docs.tavily.com/)
