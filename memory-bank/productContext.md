# Product Context

## Why Paperclip exists

Task management alone is insufficient for an AI workforce. Paperclip provides
the company-level command, communication, and control plane needed to organize
agents, align work to goals, govern decisions, monitor execution, and control
token spend.

## Desired experience

The board should be able to create a company, define its goal, establish an org
tree, configure agents, approve governed actions, start execution, and inspect
outputs and costs. The first useful result should be achievable quickly, while
progressive disclosure keeps raw logs and transcripts available without making
them the primary surface.

## Product principles

- Company is the unit of organization and authorization.
- Every task should trace back to a company goal.
- Paperclip orchestrates; adapters execute.
- Work remains company-visible by default to the board and in-company agents.
- Tasks and comments are the core communication model; Paperclip is not a
  general chat application.
- Outputs such as documents, files, previews, links, and screenshots are first
  class work products.
- Autonomy must remain observable, auditable, budget-aware, and interruptible.
- Optional or specialized capabilities belong in plugins and extensions.

## Explicit boundaries

The product is not a complete Jira/GitHub replacement, a general chatbot, or
an enterprise RBAC system. Project/issue privacy and fine-grained ACLs are not
the default V1 work-visibility model.
