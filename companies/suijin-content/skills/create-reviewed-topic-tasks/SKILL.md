---
name: create-reviewed-topic-tasks
description: Turn numbered research results into independently approved topic children
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
3. List approvals linked to that child. Reuse the existing topic approval when
   present. If none exists, call the existing `paperclipCreateApproval` tool
   exactly once with `type: "request_board_approval"`, the current Task Agent
   as `requestedByAgentId`, and `issueIds: [childId]`. Keep the payload concise
   and decision-ready; include the topic, rationale, language, target Page,
   source URLs, and the recommended action to approve that one topic for
   Facebook Writer.
4. Keep the child in `in_review` while its approval is `pending` or
   `revision_requested`. The first-class approval is the only topic gate. Do
   not create an issue-thread interaction, do not use a comment as approval,
   and do not release the child because a parent or sibling topic was approved.
   After the approval exists, patch the child to `in_review` before leaving the
   gate waiting.
5. Comment the child's next action with a link to its individual approval. The
   root comment may summarize the count, but every child must have its own
   Inbox item and its own decision.

## Approval wake

When awakened with `PAPERCLIP_APPROVAL_ID` or
`PAPERCLIP_APPROVAL_STATUS`, fetch the approval through the existing
`paperclipGetApproval` tool. Require all of the following before releasing
work:

- the approval ID is the approval named by the wake context;
- its type is `request_board_approval`;
- it is linked to exactly one expected topic child;
- its status is exactly `approved`.

Only after those checks pass may Task Agent patch that matching child to `todo`
and assign `facebook-writer` in one update. Add a handoff comment naming the
approved child and its next action. Sibling children must not change.

Pending, rejected, revision-requested, missing, mismatched, duplicate, or
ambiguous approvals remain visible blockers. Keep the affected child in
`in_review`, name the responsible owner and concrete next action, and never
infer approval from a comment or from another topic's approval. Reuse the same
approval's revision/resubmit path when available; do not create a second active
topic approval for the same child.

After all children and gates are durably created, comment the count and next
board action, then complete the parent root issue only when every child has a
durable outcome. Visible API, ownership, and validation failures remain
blocked with the responsible owner and action.
