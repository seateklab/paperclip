---
name: Suijin
description: Research, review, write, illustrate, and publish source-backed Facebook posts through a two-gate pipeline
owner: task-agent
---

# Suijin

Suijin is the project for the five-agent Facebook content pipeline. The human
board operator starts a root issue with the literal fields `Research request:`,
`Language:`, and `Target Facebook Page:`. The request and Page are mandatory;
when Language is omitted, the pipeline uses Vietnamese.

## Stage order

1. Research Agent writes one numbered `research-results` document with titles,
   rationales, and real source URLs.
2. Task Agent creates one child topic issue per result, reusing an existing
   child whose description contains the exact `Research result: N` marker.
3. Each topic child enters `in_review` behind a `request_confirmation` gate.
   Only a trimmed, case-insensitive human comment equal to `Approved`, `Agree`,
   `Đồng ý`, or `Duyệt` releases it.
4. Facebook Writer writes the durable `facebook-post` document and assigns
   Image Agent only after UTF-8 readback succeeds.
5. Image Agent creates exactly one durable attachment and the
   `facebook-image` artifact before assigning Facebook Publisher.
6. Facebook Publisher creates or reuses one linked `request_board_approval`.
   Its payload names the exact Page, `facebook-post`, `facebook-image`, and a
   stable publication key. It loads the external Noto skill only after the
   approval is `approved`.
7. A successful Noto result creates the publication artifact, comments the
   permalink, and marks the topic child `done`.

## Failure ownership

Research failures return to Task Agent. Topic-gate feedback remains with Task
Agent until an exact approval comment arrives. Writer validation failures
remain with Facebook Writer. Kie quota, authentication, or guardrail failures
return to Task Agent; transient generation failures remain with Image Agent.
Noto setup, Page, approval, and ambiguous publication outcomes remain blocked
with Facebook Publisher and name the required owner/action. The root closes
only after every child has a durable outcome.
