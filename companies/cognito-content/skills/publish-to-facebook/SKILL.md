---
name: publish-to-facebook
description: >
  DORMANT - do not use until the board activates this skill. When active,
  publishes a reviewed article to a Facebook Page via the Graph API after a
  board approval gate.
recommendedForRoles:
  - general
tags:
  - facebook
  - publishing
  - dormant
---

# Publish to Facebook

## Status: DORMANT

**This skill is parked.** Do not perform any publishing work until the board
explicitly activates this skill. The article workflow (Researcher -> Writer ->
Reviewer) must be validated first.

If you receive an issue and this skill is still dormant, comment on the issue
saying you are parked and reassign back to the Content Director.

---

## When to use (when activated)

- An issue with an `article-final` document has been assigned to you.
- The work product is in `reviewState: approved`.
- The board has activated this skill.

## When not to use (when activated)

- No `article-final` document exists. Reassign back to the Reviewer.
- No board approval has been granted for the publish action.
- `FACEBOOK_PAGE_ACCESS_TOKEN` is not in your env. Report the blocker.

## Preconditions (when activated)

- `FACEBOOK_PAGE_ID` must be present in your env. This is the numeric or
  slug-based Page ID to post to (e.g. `123456789`).
- `FACEBOOK_PAGE_ACCESS_TOKEN` must be present in your env. If missing, stop.
  Comment on the issue with the blocker and reassign to the Content Director.
- A `request_board_approval` approval linked to the issue must be in status
  `approved`. If no approval exists or it is pending, create one and wait.

## The Facebook Graph API contract (when activated)

### Endpoint

```
POST https://graph.facebook.com/<version>/<page-id>/feed
```

Use the latest supported version from Meta's documentation
(https://developers.facebook.com/docs/graph-api/). At time of writing, the
latest version is v25.0. Example: `POST https://graph.facebook.com/v25.0/<page-id>/feed`

### Parameters

| Parameter | Type | Required | Notes |
|---|---|---|---|---|
| `message` | string | yes | The article text or a summary + link. Keep within Facebook's character limits. |
| `link` | string | no | A URL to the full article if hosted externally. |
| `access_token` | string | yes | The page access token from `FACEBOOK_PAGE_ACCESS_TOKEN` env. |

The `<page-id>` in the endpoint URL comes from the `FACEBOOK_PAGE_ID` env var.

### Response shape

```json
{
  "id": "1234567890_9876543210"
}
```

The `id` is the post identifier. Construct the post URL as
`https://www.facebook.com/<page-id>/posts/<post-id-from-response>`.

### How to call it

Use your runtime's HTTP or web-call capability. Make a POST request to the
Graph API endpoint with the parameters above. Parse the JSON response. Do not
log the access token.

## Process (when activated)

1. **Verify prerequisites.** Check that `article-final` exists, the work
   product is `approved`, `FACEBOOK_PAGE_ID` and `FACEBOOK_PAGE_ACCESS_TOKEN`
   are in env.

2. **Request board approval.** Create a `request_board_approval` approval
   linked to the issue with payload:
   ```json
   {
     "action": "publish_facebook_post",
     "targetPage": "<page-id>",
     "draftDocumentKey": "article-final"
   }
   ```

3. **Wait for approval.** Stop and wait. You will be woken when the board
   approves. Do not proceed without an approved approval.

4. **Publish.** On approval wake, call the Facebook Graph API:
   - Endpoint: `POST https://graph.facebook.com/<latest-version>/$FACEBOOK_PAGE_ID/feed`
   - `message`: a summary of the article (or the full text if within limits).
   - `link`: a URL to the article if hosted externally.
   - `access_token`: from `FACEBOOK_PAGE_ACCESS_TOKEN` env.

5. **Record the result.** Create or update a work product on the issue with:
   - `type: "artifact"`
   - `externalId: "<fb-post-id>"`
   - `url: "https://www.facebook.com/<page-id>/posts/<post-id>"`
   - `status: "active"`
   - `reviewState: "approved"`

6. **Hand off.** Comment on the issue with the live post URL and reassign to
   the Content Director.

## Output (when activated)

- The article is posted to the Facebook Page.
- A work product with `status: active`, `reviewState: approved`, and the live
  post URL.
- The issue is reassigned to the Content Director.

## Anti-patterns (when activated)

- Do not publish without an approved board approval.
- Do not log or expose the `FACEBOOK_PAGE_ACCESS_TOKEN` value.
- Do not edit the article. If it needs changes, reassign to the Writer via the
  Content Director.
- Do not retry the Graph API call on failure without commenting on the issue
  first.
