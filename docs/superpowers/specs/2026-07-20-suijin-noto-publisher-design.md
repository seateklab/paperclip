# Suijin Noto Publisher Design

**Date:** 2026-07-20
**Status:** Approved in conversation
**Scope:** Finish the Suijin Content Facebook workflow using the installed external Noto plugin.

## Goal

Make the Suijin Facebook Publisher reliably complete the final stage of the
existing package-only workflow:

```text
Research -> reviewed topic -> Facebook post -> durable image
  -> final board approval -> dynamic Noto discovery -> Facebook publication
```

The Publisher must use the Noto plugin that is already installed in Paperclip,
without hard-coding a provider function name or expanding the plugin into a
Suijin-specific Facebook wrapper.

## Current contracts

The external Noto plugin is installed as `seatek.noto`, is `ready`, and exposes
four generic agent tools through its managed `noto` skill:

- `seatek.noto:list_connections`
- `seatek.noto:get_connection`
- `seatek.noto:list_connection_tools`
- `seatek.noto:execute_connection_function`

The Noto sequence is discovery first, schema inspection second, and execution
only with a function name and input accepted by the returned `inputSchema`.
The plugin normalizes execution to `{ success, output, error, duration }` and
classifies ambiguous outcomes as non-retryable because it currently exposes no
execution ID, status lookup, or idempotency mechanism.

Suijin already provides:

- `facebook-post` issue document;
- one active attachment-backed `facebook-image` artifact;
- final linked `request_board_approval`;
- target Page input on the issue;
- publication-key convention `suijin:<issue-id>:facebook-v1`;
- `provider: "noto"` publication artifact contract.

## Selected approach

### Schema-driven Publisher, package-only

Update only the Suijin Publisher agent instructions and local
`publish-facebook-via-noto` skill. Do not add Suijin routes, server services,
database tables, or a Facebook-specific wrapper inside Noto.

Alternatives rejected:

- A high-level Facebook wrapper in Noto would provide a deterministic API but
  make the provider-generic connector Facebook-specific and enlarge plugin
  scope.
- Hard-coding a currently discovered provider function would be brittle and
  violate the plugin's schema-discovery contract.

## Publisher architecture

The Publisher is invoked after Image Agent has persisted the post and image.
It validates prerequisites and creates or reuses the final board approval as
needed. External Noto execution starts only after that approval is `approved`.

1. Validate `facebook-post`, exactly one active attachment-backed
   `facebook-image`, a concrete `Target Facebook Page:`, the installed managed
   `noto` skill, and absence of a successful publication artifact.
2. List linked approvals before creating or using an approval. Reuse pending or
   revision-requested approvals, use an existing approved approval, block on a
   rejected approval, and create exactly one new
   `request_board_approval` only when no linked approval exists.
3. On an approval wake, fetch the linked approval and require status exactly
   `approved` before any Noto call.
4. Call `list_connections` with the Facebook platform and connected status.
   Do not guess a connection ID.
5. Select one unambiguous connection. If multiple connected Facebook
   connections remain and the issue cannot identify the intended Page or
   connection, block instead of guessing.
6. Call `get_connection` for the selected connection and verify its identity
   and connected status.
7. Call `list_connection_tools` for the selected connection and inspect every
   candidate function's name, description, and `inputSchema`.
8. Select a function only when its schema and description clearly support the
   required publication inputs: target Page, post text, and image/media.
   Function names are never hard-coded.
9. Construct an input object using only properties accepted by that schema.
10. Execute the selected function once for the publication key.
11. Accept only a definitive successful result whose output contains an
   unambiguous external post ID and permalink.
12. Create the Noto publication artifact, comment the permalink, and mark the
   topic child `done`.

## Input mapping

### Target Page

Read the issue's literal `Target Facebook Page:` value. Map it only when the
returned schema property name or description clearly identifies a Page name or
Page identifier. If the schema does not expose a compatible Page input, block.

### Post text

Read the complete `facebook-post` document body and map it only to a schema
property whose name or description clearly accepts Facebook post text,
message, or content. Do not shorten or rewrite the document during publishing.

### Image

Read the durable `facebook-image` artifact metadata and attachment paths. Pass
an image only when the discovered schema accepts a representation that is
actually available and reachable:

- a durable public content URL only when Paperclip has a configured canonical
  URL reachable by Noto;
- a provider-accepted upload/media reference only when the schema and Noto
  contract explicitly provide one;
- another representation only when its schema and documented contract are
  explicit.

A local URL, guessed upload field, guessed base64 format, or inaccessible
Paperclip path must not be sent. If the image cannot be mapped safely, block
before execution and state the required media configuration.

### Publication key

Use `suijin:<issue-id>:facebook-v1` as Paperclip's local publication key. Pass
it to Noto only when the discovered schema advertises a compatible
idempotency, request-key, or publication-key field. The Publisher must not
pretend that the provider is idempotent when the field is absent.

### Unknown required inputs

If the selected function requires fields that cannot be derived from the issue,
post, durable image, or documented company configuration, block and name the
missing field. Never invent values, use raw credentials, or ask the board for a
provider-private field that the schema does not explain.

## Function selection rules

The agent may use semantic inspection of the returned function metadata, but
must not maintain a hard-coded provider function list. A candidate is valid
only when:

- it belongs to the selected connected Facebook connection;
- its description and schema indicate publication/post creation rather than
  reading, listing, deleting, or account administration;
- required Page, text, and image/media inputs are all supported;
- the input object can be built entirely from durable Suijin state and
  documented configuration;
- no second candidate is equally plausible.

No candidate, multiple equally plausible candidates, or an input schema that
cannot safely represent the durable image is a blocker.

## Result and artifact contract

Noto `success: false` is a definitive provider failure. It does not produce a
publication artifact and does not trigger an automatic retry.

Noto `success: true` is still insufficient by itself. The output must contain:

- one unambiguous external Facebook post identifier;
- one unambiguous permalink.

The Publisher may recognize only explicitly labeled output values. If output
fields are missing, contradictory, or ambiguous, preserve the approval, write
no publication artifact, and block for reconciliation.

After confirmed success, create exactly one artifact:

```json
{
  "type": "artifact",
  "provider": "noto",
  "externalId": "<Noto-returned Facebook post id>",
  "title": "Facebook publication",
  "url": "<Noto-returned permalink>",
  "status": "active",
  "reviewState": "approved",
  "metadata": {
    "publicationKey": "suijin:<issue-id>:facebook-v1",
    "targetPage": "<issue Target Facebook Page>"
  }
}
```

Only after the artifact write succeeds should the Publisher comment the
permalink and mark the topic child `done`. A successful existing publication
artifact is reconciled without another external call.

## Failure and retry policy

| Condition | Required behavior |
|---|---|
| Missing post, image, Page, Noto skill, or connection | Block before external execution; name owner and exact action. |
| Multiple candidate connections | Block unless the Page/connection is unambiguous. |
| No compatible function or missing required schema fields | Block; do not guess. |
| Authentication, authorization, configuration, or connection failure | Block and report safely to Task Agent. |
| Definitive provider rejection | Block without retry until provider/input state changes. |
| Ambiguous execution error | Never retry; require an independent status/readback path. |
| Successful result missing post ID or permalink | Preserve approval, write no artifact, and block for reconciliation. |
| Existing successful Noto artifact | Do not call Noto again; reconcile as published. |

A previously approved board approval remains linked and reusable after a
configuration fix. External failures must not create duplicate approvals.
Comments and activity entries must not include credentials, Page tokens, or
private provider response data.

## Verification

### Static package contract

Extend the Suijin contract test to verify that Publisher instructions:

- use the four managed Noto operations in discovery -> inspection -> execution
  order;
- require schema inspection before execution;
- require Page, post, and image/media mapping;
- fail closed on incompatible image transport;
- require explicit external post ID and permalink before artifact creation;
- prohibit hard-coded provider function names, namespaces, direct social APIs,
  raw credentials, and blind retries;
- preserve final board approval and publication-key semantics.

### Noto regression suite

Keep the existing Noto plugin tests passing. Do not weaken current guarantees
for secret resolution, redaction, audit ordering, definitive failures, or
ambiguous failures.

### Live read-only discovery

With the Suijin company configured and a valid connected Facebook Noto account:

1. Discover connections.
2. Inspect the selected connection.
3. Inspect its advertised function schemas.
4. Record only sanitized function metadata needed to confirm compatibility.
5. Do not execute a provider mutation during this phase.

### Controlled end-to-end smoke

Use a dedicated Facebook test Page only. Run one topic through research, topic
approval, writing, durable image persistence, final board approval, dynamic
Noto discovery, one publication call, and artifact creation. Verify one
external post ID, one permalink, one `provider: "noto"` artifact, and no
second publication call.

If no dedicated Page or schema-compatible media representation is available,
stop at the blocker. That is the expected safe behavior; production
publication is never a verification prerequisite.

## Non-goals

- No direct Facebook/Meta API fallback.
- No hard-coded Noto provider function name.
- No new Paperclip server route or database state machine.
- No automatic retry for ambiguous Noto outcomes.
- No public exposure of credentials or provider-private payloads.
- No production Facebook publication for testing.
