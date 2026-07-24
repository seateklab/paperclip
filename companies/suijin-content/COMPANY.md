---
name: Suijin Content
description: A Facebook content company that researches open-ended requests, gates each topic through human review, writes and illustrates approved posts, and publishes through Noto after final approval
slug: suijin-content
schema: agentcompanies/v1
version: 0.1.0
license: MIT
goals:
  - Turn open-ended research requests into approved, illustrated, safely published Facebook posts
requirements:
  secrets:
    - TAVILY_API_KEY
    - KIE_API_KEY
---

# Suijin Content

Suijin Content turns an open-ended research request into source-backed
Facebook posts. Every candidate topic is independently reviewed by the human
board before writing, and every completed post passes a second board approval
before external publication.

## Workflow

The company is a five-agent pipeline coordinated by the Task Agent. The human
board operator is the CEO and supplies the root issue. A root issue must carry
these literal labels:

- `Research request:` - the open-ended research brief.
- `Language:` - the requested content language; if omitted, agents use Vietnamese.
- `Target Facebook Page:` - the exact Page recognized by the external Noto skill.

The Research Agent writes one `research-results` document containing numbered
results. The Task Agent creates one child issue per result and one independent
`request_board_approval` linked to that child. Each approval appears as a
separate Inbox item. The child remains in `in_review` until its own approval is
approved; approving one topic never releases another topic to the Facebook
Writer.

The Facebook Writer saves `facebook-post` and hands the durable issue to the
Image Agent. The Image Agent downloads the Kie result, uploads the image bytes
to a private or draft Noto media file, and creates one Paperclip attachment plus
one `facebook-image` artifact containing the Noto file identity. The Facebook
Publisher then requires a linked `request_board_approval` for the exact Page,
post, image artifact, and idempotency key. Only an approved gate permits the
Publisher to execute the external managed Noto publication skill. On success it
records a Noto publication artifact, comments the permalink, and closes that
topic child. The Task Agent closes the root after all result children have
durable outcomes.

## Org chart

| Agent | Title | Reports to | Skills | Status |
|---|---|---|---|---|
| task-agent | Task Agent | - | paperclip, create-reviewed-topic-tasks | active |
| research-agent | Research Agent | task-agent | paperclip, research-facebook-topics, agent-browser | active |
| facebook-writer | Facebook Writer | task-agent | paperclip, write-facebook-post, verifying-published-text | active |
| image-agent | Image Agent | task-agent | paperclip, kie-image-generation, persist-facebook-image-to-noto, managed-tool-utf8-transport, noto | active |
| facebook-publisher | Facebook Publisher | task-agent | paperclip, managed-tool-utf8-transport, publish-facebook-via-noto, verifying-published-text, noto | active/idle-by-default |

The Publisher is not parked by package configuration. Its final board approval
is the safety gate, and missing external setup blocks before any call.

## Project and durable handoffs

Project **Suijin** (`suijin`) owns the starter research request and its child
topic issues. Documents are keyed `research-results` and `facebook-post`.
Images and publication records are artifact work products. Attachments, work
products, comments, interactions, approvals, assignees, and status transitions
are written through Paperclip's existing control-plane contracts.

## Secrets and external prerequisites

- `TAVILY_API_KEY` is required by Research Agent and must be bound as a company
  secret reference.
- `KIE_API_KEY` is required by the managed Kie Image Generation plugin and must
  be configured in the plugin's company-scoped settings.
- The external Noto plugin must be installed and expose the managed skill
  shortname `noto` to Image Agent and Facebook Publisher. The selected Noto
  connection must advertise private/draft folder and byte-upload operations.
  Configure its credentials and Page access outside this package. Noto
  credentials, tokens, Page identifiers that are not the issue's input, and
  machine-local paths never belong in package files.

Suijin does not call a direct social-network API and does not invent a Noto
tool or endpoint name. If Noto, Kie, a Page, a secret, or either approval is
missing, the owning agent records the blocker and stops without an external
side effect.

## References

- Agent Companies specification: https://agentcompanies.io/specification
- Paperclip: https://github.com/paperclipai/paperclip
