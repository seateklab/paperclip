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

For each numbered result `N`, perform these steps in order:

1. List the root issue's direct children. Match the exact description marker
   `Research result: N`. Reuse and update that child when it exists; never
   create a second child for the same result number.
2. Create unmatched children only for results without a reusable child. For an
   unmatched result, create one child linked to the same parent, project, and
   goal. Set `status: "todo"`, resolve Task Agent's assigned agent ID in
   `assigneeAgentId`, and include these description fields:
   `Research result:`, `Topic:`, `Rationale:`, `Language:`, `Target Facebook
   Page:`, and `Sources:`. Resolve Language from the root and default it to
   Vietnamese only when omitted.
3. Create the child interaction before changing its status. The interaction
   has `kind: "request_confirmation"`, `continuationPolicy: "none"`, and
   payload `{version:1,prompt,acceptLabel:"Approve topic",rejectLabel:"Request changes",supersedeOnUserComment:true}`.
   Use idempotency key `suijin-topic-review:<child-id>:initial` for the first
   gate.
4. Only after interaction creation, patch the child to `in_review` and
   comment the next action. The gate accepts only a human-authored comment
   whose trimmed body, compared case-insensitively, equals exactly one of
   `Approved`, `Agree`, `Đồng ý`, or `Duyệt`.

## Feedback wake

On `issue_commented`, fetch the exact wake comment and verify that it is
human-authored. An exact accepted phrase patches the child to `todo` and
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
