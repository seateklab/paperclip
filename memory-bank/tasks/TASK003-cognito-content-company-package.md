# [TASK003] - Create Cognito Content Agent Company Package

**Status:** Completed
**Added:** 2026-07-13
**Updated:** 2026-07-14
**Implementation:** complete
**Validation:** passed
**Activation/follow-up:** pending_user

## Purpose

Create an importable Agent Companies package for a cited content pipeline:
brief, research and outline, article drafting, editorial review, and an
approval-gated Facebook publisher held inactive until explicitly enabled.

## Durable decisions

- Use a linear issue-reassignment pipeline led by a Content Director.
- Keep agent instructions in `AGENTS.md` and package-specific procedures in
  reusable `SKILL.md` files.
- Use Tavily through the runtime's web capability with a secret-backed input;
  do not add product plugin code for the package.
- Persist the outline, draft, and final article as issue documents and represent
  the article as a work product using supported status/review fields.
- Keep Facebook publishing approval-gated and paused by default.

## Delivered package

The source package lives at `../../companies/cognito-content/` and contains the
company definition, five agent personas, four custom skills, a content-pipeline
project, and a sample article task. The distributable archive is
`../../companies/cognito-content.zip`.

## Validation conclusion

The package imported successfully and the Phase 1 article pipeline produced
the expected outline, draft, final article, and approved active work product.
Sensitive identifiers, runtime/database snapshots, and secret-derived evidence
are intentionally omitted. Facebook activation remains a user-controlled
follow-up.
