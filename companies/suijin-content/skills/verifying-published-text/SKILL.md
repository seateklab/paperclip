---
name: verifying-published-text
description: >
  Prevent corrupted English or Vietnamese characters in document and post
  output. Use whenever writing or updating an article document or `facebook-post`.
recommendedForRoles:
  - general
  - qa
tags:
  - writing
  - unicode
  - quality
---

# Verify Published Text

Use UTF-8 for every issue document and published post. This is the default for
both English and Vietnamese; it does not change normal English text. Apply the
same readback discipline to long-form articles and the direct Facebook
`facebook-post` document; do not assume that one is an article.

## Before writing the issue document or post

1. Keep the document or post in native Unicode. Do not convert Vietnamese
   letters to ASCII, HTML entities, or escaped replacement text.
2. If using Windows PowerShell to call the Paperclip API, follow the `paperclip`
   skill's UTF-8 JSON mutation instructions. Do not send a JSON string through
   raw `Invoke-RestMethod`; use the bundled Paperclip request helper that sends
   BOM-less UTF-8 bytes with `application/json; charset=utf-8`.
3. Inspect the final document or post before sending it. Stop if it contains:
   - `�` (U+FFFD replacement character);
   - repeated question marks inside words, such as `Nghi?n c?u`; or
   - Vietnamese keywords that no longer match the intact outline, brief, or
     approved topic.
4. Write the document or post only after that inspection passes.

Normal question marks at the end of English or Vietnamese questions are valid.
Do not reject a document or post merely because it contains `?`.

## After writing the issue document or post

1. Fetch the same saved document or post revision back from Paperclip.
2. For an article document, check the headline, deck, section headings, and
   several Vietnamese phrases against the intended text. For `facebook-post`,
   check the hook, body, closing takeaway or call to action, Unicode
   characters, and every source link against the intended text and approved
   sources.
3. If any character or required content changed, do not approve, reassign,
   publish, or close the issue. Rewrite the document or post from the intact
   outline/source using the safe UTF-8 request path, then fetch and check it
   again. The Facebook Writer handoff is allowed only after `facebook-post`
   readback passes all hook/body/closing/source-link checks.

Do not try to reconstruct an already corrupted document or post by guessing
which letters replaced `?`. Use the intact outline and sources to rewrite it.

## After external publication

For a Facebook publication, read the actual Facebook post through the
schema-compatible Noto readback operation using the transport-safe managed
plugin-tool helper. Compare the published body, hook, closing, Unicode
characters, and source links with the approved `facebook-post` document.

If readback is unavailable, the body is missing, or any character differs,
record the returned external post ID as a durable blocked/manual-correction
outcome. The Publisher must not create a publication artifact, must not mark
the issue `done`, and must not automatically run the publication again.
