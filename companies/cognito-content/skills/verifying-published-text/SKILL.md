---
name: verifying-published-text
description: >
  Prevent corrupted English or Vietnamese characters in article output. Use
  whenever writing or updating article-draft or article-final issue documents.
recommendedForRoles:
  - general
  - qa
tags:
  - writing
  - unicode
  - quality
---

# Verify Published Text

Use UTF-8 for all article output. This is the default for both English and
Vietnamese; it does not change normal English text.

## Before writing the issue document

1. Keep the article in native Unicode. Do not convert Vietnamese letters to
   ASCII, HTML entities, or escaped replacement text.
2. If using Windows PowerShell to call the Paperclip API, follow the `paperclip`
   skill's UTF-8 JSON mutation instructions. Do not send a JSON string through
   raw `Invoke-RestMethod`; use the bundled Paperclip request helper that sends
   BOM-less UTF-8 bytes with `application/json; charset=utf-8`.
3. Inspect the final article body before sending it. Stop if it contains:
   - `�` (U+FFFD replacement character);
   - repeated question marks inside words, such as `Nghi?n c?u`; or
   - Vietnamese keywords that no longer match the intact outline or brief.
4. Write the article document only after the body passes that inspection.

Normal question marks at the end of English or Vietnamese questions are valid.
Do not reject an article merely because it contains `?`.

## After writing the issue document

1. Fetch the same document back from Paperclip.
2. Check the headline, deck, section headings, and several Vietnamese phrases
   against the text you intended to publish.
3. If any character changed, do not approve, reassign, publish, or close the
   issue. Rewrite the document from the intact outline/source using the safe
   UTF-8 request path, then fetch and check it again.

Do not try to reconstruct an already corrupted article by guessing which
letters replaced `?`. Use the intact outline and sources to rewrite it.
