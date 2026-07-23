# [TASK009] - Add a Unicode-Safe Article Output Skill

## Status

**Task status:** completed
**Implementation:** complete
**Validation:** passed
**Activation/follow-up:** not_required
**Created:** 2026-07-17

## Goal

Create one reusable Cognito Content skill that tells an article-producing agent
how to avoid corrupted English or Vietnamese characters in issue-document
output.

## Scope

- Add only `skills/verifying-published-text/SKILL.md`.
- Default to UTF-8 for both English and Vietnamese.
- Require the existing Paperclip Windows UTF-8 JSON helper when PowerShell is
  used.
- Require a readback check before accepting the article output.
- Do not change agent instructions, workflow gates, server code, fonts,
  schemas, or other company documentation.

## Success criteria

- The skill distinguishes valid question punctuation from suspicious question
  marks embedded inside words.
- It tells agents to compare Vietnamese keywords with the intact outline.
- It explains that damaged text must be rewritten from intact context rather
  than guessed.
- The skill remains safe and applicable to ordinary English articles.

## Next action

Use `verifying-published-text` when an article-producing agent needs explicit
English/Vietnamese output-safety guidance. Agent assignment remains a separate
future decision.

## Validation result

The skill is valid strict UTF-8, has the required name and description
frontmatter, covers English and Vietnamese, points Windows PowerShell to the
existing safe Paperclip helper, and requires document readback. All temporary
agent, workflow, helper-script, test, design, and plan changes from the
discarded broader approach were removed. The eight pre-existing company files
touched during that attempt match their verified backups byte-for-byte.
