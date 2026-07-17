# Project Brief

## Mission

Paperclip is the control plane for autonomous AI companies. It coordinates
companies, goals, agents, issues, approvals, budgets, costs, execution, and
human governance while adapters run agents in external environments.

## Product scope

- A single deployment can host multiple company-scoped organizations.
- Companies contain goals, org trees, agents, projects, issues, comments,
  work products, approvals, activity, budgets, and cost records.
- Agents execute through built-in or dynamically loaded adapters; the control
  plane owns authorization, orchestration, visibility, and auditability.
- The board needs a human-readable view of what is happening, why it matters,
  what it costs, and where intervention is required.

## Source of truth

For implementation behavior, `doc/SPEC-implementation.md` is authoritative.
The repository `AGENTS.md` defines contribution and safety rules. Product
context lives in `doc/GOAL.md` and `doc/PRODUCT.md`; operational guidance lives
in `doc/DEVELOPING.md` and `doc/DATABASE.md`.

## Current workspace baseline

This Memory Bank was initialized on 2026-07-13 at the user's request. No
source-code change was made as part of initialization. The worktree already
contained unrelated/pre-existing changes; they are intentionally preserved.
