# Suijin Content

Suijin Content is a standalone Agent Companies package for turning an
open-ended research request into reviewed, illustrated Facebook posts. The
human board operator is the CEO. Research is source-backed, every topic is
approved independently, and publication requires a second board approval
before the external Noto plugin is used.

## Workflow

```text
Board root issue
      |
      v
Task Agent -> Research Agent -> research-results
      |
      +-> one topic child per result -> request_confirmation -> human comment
                                              |
                            Approved / Agree / Đồng ý / Duyệt
                                              v
                                   Facebook Writer -> facebook-post
                                              v
                                         Image Agent
                                   durable image + artifact
                                              v
                                   Facebook Publisher
                                  final board approval
                                              v
                                external managed Noto skill
```

The root issue must include `Research request:`, `Language:`, and `Target
Facebook Page:`. Language inherits from the issue and defaults to Vietnamese
when omitted. The Research Agent creates five results by default. The Task
Agent creates one `in_review` child per result and reuses an existing child
identified by `Research result: N` rather than duplicating it. A human releases
a topic only with a trimmed, case-insensitive exact comment of `Approved`,
`Agree`, `Đồng ý`, or `Duyệt`.

The Writer stores `facebook-post`, then Image creates one durable Kie-backed
Paperclip attachment and `facebook-image` artifact. Publisher verifies the
final approval and uses only the installed managed skill `noto`; it does not
assume or expose a vendor tool name, endpoint, raw credential, or direct social
API. Successful publication stores a `provider: noto` artifact, permalink, and
external post ID, then closes the topic.

### How Publisher uses Noto

- Publisher discovers exactly one connected Facebook connection at runtime;
  it does not guess a connection ID.
- Publisher inspects every advertised function's description and
  `inputSchema` before execution.
- The Page, complete post, and image are passed only when each is compatible
  with the discovered schema.
- Missing compatible image transport, an inaccessible attachment
  representation, or any unknown required field blocks safely before
  execution.
- Final board approval is fetched and verified before any external mutation.
- Publication is accepted only with one returned external ID and one returned
  permalink, which are recorded in the Noto artifact.
- No production Page is used for smoke tests.

## Organization

| Agent | Title | Reports to | Skills | Responsibility |
|---|---|---|---|---|
| `task-agent` | Task Agent | human board / none | `paperclip`, `create-reviewed-topic-tasks` | Coordinates the root and topic gates |
| `research-agent` | Research Agent | Task Agent | `paperclip`, `research-facebook-topics`, `agent-browser` | Searches current sources and writes results |
| `facebook-writer` | Facebook Writer | Task Agent | `paperclip`, `write-facebook-post`, `verifying-published-text` | Writes and verifies the post document |
| `image-agent` | Image Agent | Task Agent | `paperclip`, `kie-image-generation` | Generates the durable image artifact |
| `facebook-publisher` | Facebook Publisher | Task Agent | `paperclip`, `publish-facebook-via-noto`, `noto` | Publishes only after final approval |

## Included content

- Project `Suijin` (`suijin`) with a safe starter research issue.
- Local skills: `research-facebook-topics`, `create-reviewed-topic-tasks`,
  `write-facebook-post`, `publish-facebook-via-noto`, and the verified
  `verifying-published-text` skill.
- Referenced runtime skills: `paperclip`, `agent-browser`,
  `kie-image-generation`, and the externally installed `noto` skill.

## Prerequisites and setup

1. Create and bind the company `TAVILY_API_KEY` secret to Research Agent.
2. Configure the managed Kie Image Generation plugin with its company-scoped
   secret reference.
3. Install the external Noto plugin and assign its managed `noto` skill to
   Facebook Publisher.
4. Configure Noto credentials and Page access outside this package.
5. Replace the starter Page placeholder with a dedicated Noto-recognized test
   Page identifier.
6. Run the pipeline. Do not use a production Page for smoke verification.

No adapter is pinned. The package intentionally omits unknown Noto and Kie
configuration fields; those are managed by Paperclip and their plugins.

## Import

From the Paperclip repository root:

```powershell
pnpm paperclipai company import ./companies/suijin-content --target new --include company,agents,projects,issues,skills --dry-run --json
pnpm paperclipai company import ./companies/suijin-content --target new --new-company-name "Suijin Content" --include company,agents,projects,issues,skills --yes --json
```

The dry run should report one company, five agents, one project, one starter
issue, and five local skills. External skill warnings are expected until the
runtime prerequisites are installed.

## References

- Agent Companies specification: https://agentcompanies.io/specification
- Paperclip: https://github.com/paperclipai/paperclip
