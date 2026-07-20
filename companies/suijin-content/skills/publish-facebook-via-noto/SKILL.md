---
name: publish-facebook-via-noto
description: Publish a Facebook post through the externally managed, schema-driven Noto skill
---

# Publish Facebook via Noto

Use this skill only for a topic child after Image Agent has persisted the
durable `facebook-post` document and the durable image. Do not make an
external mutation while validating prerequisites. Before requesting or
executing any publication operation, require all of the following:
- A local URL is never a reachable attachment representation; it must block
  before execution.

- Read `facebook-post` in full; do not publish a partial, guessed, or
  regenerated body.
- Exactly one active attachment-backed artifact exists and its
  `metadata.artifactKind === "facebook-image"`.
- The issue contains a concrete `Target Facebook Page:` value, not the
  starter Page placeholder.
- The managed `noto` skill is installed and available to this agent.
- No successful publication artifact already exists for this issue. If one
  exists, do not call Noto again.

## Final board gate

List the issue's linked approvals before creating anything. The initial list is
advisory, including when it reports `approved`; never treat that listing alone
as permission to call Noto. Apply this decision table:

- Reuse a linked `pending` approval.
- Reuse a linked `revision_requested` approval.
- A linked `rejected` approval blocks; report the board owner and the action
  needed to resubmit a valid approval.
- A linked `approved` approval is eligible for the publication path only after
  it is fetched again and its fresh status is exactly `approved`.
- If the initial listing is empty, enter a serialized/idempotent approval
  guard. Immediately before creating `request_board_approval`, re-list and
  recheck linked approvals. If any approval appeared, reuse it and apply this
  same decision table; create exactly one request only when that final recheck
  is still empty. Never run concurrent creators for the same issue and
  publication key.

The approval payload is:

```json
{
  "action": "publish_facebook_post",
  "targetPage": "<issue Target Facebook Page>",
  "documentKey": "facebook-post",
  "imageWorkProduct": "facebook-image",
  "publicationKey": "suijin:<actual-issue-id>:facebook-v1"
}
```

Keep the topic `in_review` while approval is `pending` or
`revision_requested`. If the initial linked-approval listing reports
`approved`, immediately fetch that same linked approval and require its fresh
status to be exactly `approved`; only then may the publication path continue.
When awakened for an approval after `pending` or `revision_requested`,
immediately fetch the linked approval, require status `approved`, and require
that its fresh status is exactly `approved`; only then may the publication path
continue. A status from either initial listing is never reused as the final
gate.

Immediately before the first Noto operation, and immediately before each
individual Noto operation thereafter, re-fetch the selected linked approval.
The runtime discovery section is unreachable unless that fresh approval status
is exactly `approved`; if any fresh fetch is not exactly `approved`, stop
without loading or calling the managed Noto operations.

## Runtime discovery and execution
After the final approval gate is verified, load the managed skill `noto` and
follow this exact discovery sequence:

1. Call `seatek.noto:list_connections` with `platformSlug facebook` and
   `status connected`. Do not guess an ID.
2. Select exactly one connection whose identity can be reconciled with the
   issue Page. Multiple unresolved candidates block.
3. Call `seatek.noto:get_connection` with the selected `connectionId` and
   require a connected status.
4. Call `seatek.noto:list_connection_tools` with the selected
   `connectionId`.
5. Inspect every function's `name`, `description`, and `inputSchema`.
6. Select one and only one function whose description and schema support
  Facebook publishing to the target Page, post text, and image/media.
7. Call `seatek.noto:execute_connection_function` only with that advertised
   `functionName` and an input object containing only schema-accepted fields.

Use the managed operation names above exactly. Never add a provider-specific
Facebook function name, endpoint, namespace, credential field, or direct API
fallback to this package.

## Schema-safe input mapping

Build the execute `input` from the discovered `inputSchema`, not from an
assumed provider interface:

1. Map the issue's Page only when a discovered property name or description
   clearly identifies a Page name or Page identifier. Otherwise block and
   report the missing compatible field, owner, and next action.
2. Map the complete body read from `facebook-post` only to a discovered
   text, message, or content field. Do not truncate, rewrite, or put it in an
   unrelated field.
3. Map the image only when the discovered schema accepts an actually
   reachable representation of the Paperclip attachment. An attachment ID or
   other representation is usable only when the advertised operation can
   reach it. A local URL, guessed upload field, guessed base64 form, or
   inaccessible path blocks before execution.
4. Map publication key `suijin:<actual-issue-id>:facebook-v1` only when the
   discovered schema advertises a compatible publication or idempotency field.
   Do not invent one.
5. Any unknown required field blocks before execution. Report the exact
   missing field, its owner, and the action needed to make the schema
   compatible.

Send no keys beyond those accepted by the discovered schema. If exactly one
compatible function cannot be selected, or any required mapping is not
schema-compatible. Surface a visible blocker and do not execute.

## Result, artifact, and failure handling

The managed execute result follows the Noto result/error contract:

```text
success: false is a definitive provider failure and is not automatically retried.
A noto_execution_ambiguous result is never retried because the current plugin has no execution ID, status lookup, or idempotency mechanism.
success: true is accepted only when output contains one unambiguous external post ID and one unambiguous permalink.
```

Inspect the returned `success`, `output`, and any Noto error code. A
`success: false` result is definitive: report the provider error to Task Agent,
preserve the approved board approval, and do not automatically retry it. A
`noto_execution_ambiguous` result is never retried; the current plugin has no
execution ID, status lookup, or idempotency mechanism. Never retry this result;
stop and report the provider uncertainty and owner/action instead.

Accept `success: true` only when `output` contains one unambiguous external
post ID and one unambiguous permalink. If either identifier is absent,
duplicated, or ambiguous, block and do not create an artifact. Only after
both identifiers are verified, create exactly one artifact:

```json
{
  "type": "artifact",
  "provider": "noto",
  "externalId": "notoExternalPostId",
  "title": "Facebook publication",
  "url": "notoPermalink",
  "status": "active",
  "reviewState": "approved",
  "metadata": {
    "publicationKey": "suijin:actual-issue-id:facebook-v1",
    "targetPage": "issueTargetFacebookPage"
  }
}
```

Substitute the actual issue ID, returned external post ID, permalink, and
issue Page in the artifact; the example names are not literal values. If
artifact creation succeeds, comment the permalink and mark the topic `done`.
Do not reassign a closed issue.

Before any non-ambiguous retry, check again that no successful publication
artifact exists and use only a status or idempotency mechanism explicitly
advertised by the managed Noto skill. Preserve the approved board approval
across all failures. If no documented safe retry mechanism exists, block
instead of risking a duplicate external post. Missing Noto, credentials,
Page, approval, durable input, compatible schema, or reachable image always
blocks before an external call.
