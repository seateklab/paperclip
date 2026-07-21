---
name: create-reviewed-topic-tasks
description: Turn numbered research results into human-approved topic children
---

# Create Reviewed Topic Tasks

Run this skill on a Suijin root issue after Research Agent has durably saved
`research-results`. First validate the root fields and parse the document's
numbered results. Reject an empty or malformed entry; do not create a child
for evidence that lacks a topic title, rationale, or source URL.

## Per-result algorithm

For each numbered result `N`, first read the current `research-results`
document revision and list the root issue's direct children. Match the exact
description marker `Research result: N`. Reuse and update that child when it
exists; never create a second child for the same result number.

### Unmatched result

For an unmatched result, create one child linked to the same parent, project,
and goal with these description fields: `Research result:`, `Topic:`,
`Rationale:`, `Language:`, `Target Facebook Page:`, and `Sources:`. Resolve
Language from the root and default it to Vietnamese only when omitted. Create
the child with no assignee. Create the child interaction before changing its
status or assigning anyone. The `request_confirmation` must be created while
the child is still unassigned, with `continuationPolicy: "none"` and payload
`{version:1,prompt,acceptLabel:"Approve topic",rejectLabel:"Request changes",supersedeOnUserComment:true}`.
Use idempotency key
`suijin-topic-review:<child-id>:<research-results-revision>` derived from the
current research-results document revision. Only after interaction creation,
patch the child to `status: "in_review"` before assignment. Then assign the
resolved Task Agent ID in `assigneeAgentId` in a separate update while
preserving `status: "in_review"`. There must be no todo/assignment wake before
this gate.

### Reused child

Existing terminal children with a valid durable outcome may remain closed and
must not be reassigned. For reused nonterminal children, each is stale until it
is re-gated: update it with the current result fields, clear any stale
assignment or handoff, and create a fresh request_confirmation idempotency key
derived from the current `research-results` document revision while it is
unassigned. Only after the interaction exists, reset to `in_review`. Only then
assign Task Agent, preserving `in_review`. Stale approvals/handoffs never bypass
this fresh gate.

## Feedback wake

On `issue_commented`, fetch the exact wake comment and verify that it is
human-authored. Only a human-authored comment is accepted when its trimmed body,
compared case-insensitively, equals exactly one of `Approved`, `Agree`, `Đồng ý`, or `Duyệt`. An accepted phrase patches the child to `todo` and
assigns `facebook-writer` in one update. Any other comment is feedback: apply
clear requested edits, create a fresh request confirmation, and keep the
child `in_review`. The renewed gate uses idempotency key
`suijin-topic-review:<child-id>:<wake-comment-id>`. Ambiguous feedback gets a
clarifying comment plus a renewed interaction. Set `supersedeOnUserComment:
true` so the existing pending request confirmation is superseded by the human
comment; do not poll interactions or manufacture approval.

After all children and gates are durably created, comment the count and next
board action, then complete the parent root issue only when every child has a
durable outcome. Visible API, ownership, and validation failures remain
blocked with the responsible owner and action.
