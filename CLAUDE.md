# CLAUDE.md

Claude companion for Paperclip.

## Read First

1. `AGENTS.md`
2. `doc/GOAL.md`
3. `doc/PRODUCT.md`
4. `doc/SPEC-implementation.md`
5. `doc/DEVELOPING.md`
6. `doc/DATABASE.md`

## Priority

- User instructions override everything.
- `AGENTS.md` overrides this file.
- This file only adds Claude-specific guidance.

## Edit Safety

- Back up any existing file in the same directory before editing it.
- If backup creation fails, stop and do not edit.
- Use `.orig` or a timestamped `.orig.YYYYMMDD-HHMMSS` suffix; never overwrite an existing backup.

## Daily Working Rules

- Prefer narrow, local changes.
- Avoid unrelated refactors.
- Preserve repo conventions unless the task explicitly asks otherwise.
- If behavior changes, verify the smallest relevant test path first.
- Update docs when commands or behavior change.

## Done

- The change matches repo policy.
- Existing files were backed up before editing.
- The result was verified.
