---
name: review-article
description: >
  Review an article draft against editorial criteria (accuracy, structure,
  voice, citations, clarity, length) and either request specific revisions or
  approve and finalize. Use when a draft is assigned to you for review.
recommendedForRoles:
  - qa
tags:
  - review
  - editorial
  - quality
---

# Review Article

Review an article draft against editorial criteria. Either request specific,
actionable revisions or approve and finalize. Never rewrite the article
yourself. Never rubber-stamp.

## When to use

- An issue with an `article-draft` document has been assigned to you for
  review.

## When not to use

- No `article-draft` document exists. Reassign back to the Writer.
- You are also the Writer of this draft (you cannot review your own work).

## Review criteria checklist

Run each criterion in order. If any fails, request revision.

### 1. Accuracy (highest priority)

- Check every cited claim against its source URL. Open the URL and verify the
  claim matches the source.
- Flag any claim that is unsupported, misattributed, or contradicted by its
  source.
- If a claim has no source link, flag it as unsupported.

### 2. Structure

- Does the article flow logically from headline to conclusion?
- Are the sections well-ordered? Does each section build on the previous one?
- Is the headline specific (12 words or fewer)?
- Is the deck one sentence and does it frame the article?

### 3. Voice

- Is the tone consistent throughout? Confident and plain-voiced, not hedged.
- Are there generic filler phrases ("in today's fast-paced world...")? Flag
  them.

### 4. Citations

- Is every factual claim linked to a source?
- Are the source links from the outline used? Are any missing?

### 5. Clarity

- Is the article clear and readable for the stated audience?
- Are there jargon-heavy passages that need simplification?

### 6. Length

- Count the article's total words (split on whitespace, count non-empty tokens).
- Is the article between 800 and 1500 words? If outside this range, you MUST
  request revision. Report the exact word count in your comment.
  Example: "Article is 2,087 words. Allowed range: 800–1,500. Decision: REVISION
  REQUIRED — reduce to within range."
- Do not approve an article outside the 800–1500 range regardless of other
  criteria.

## Decision: revision

If any criterion fails:
1. Post specific, actionable comments on the issue. For each failing claim,
   write what is wrong and what the Writer should do. Example: "Section 3
   claims X but the source at [url] says Y. Correct the claim or remove it."
2. Do not write "make it better" or "needs work." Be specific.
3. Reassign the issue back to the Writer.
4. Do not upsert `article-final`.

## Decision: approve

If all criteria pass:
1. Upsert issue document key `article-final` with the approved article (copy
   the `article-draft` content).
2. Update the work product to `reviewState: approved`.
3. Reassign the issue to the Content Director.
4. Comment on the issue with a brief approval note (e.g. "Approved. All claims
   verified against sources. Structure, voice, and length meet criteria.").

## Output

- **Revision path:** specific comments on the issue, reassigned to the Writer.
- **Approve path:** `article-final` document upserted, work product updated to
  `reviewState: approved`, issue reassigned to the Content Director.

## Anti-patterns

- Do not rewrite the article. If it needs rewriting, request revision.
- Do not rubber-stamp. If you cannot verify a claim, request revision.
- Do not post vague comments ("needs improvement"). Be specific and
  actionable.
- Do not approve without checking every cited claim against its source.
- Do not skip the work product update on approve.
