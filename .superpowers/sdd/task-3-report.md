# Suijin Noto Publisher — Task 3 Verification Report

Date: 2026-07-20 (managed Paperclip service response date)
Scope: regression, portability, import preview, installed Noto readiness, and conditional live-publication gating. No provider mutation or Facebook publication was attempted.

## Service/process preflight

- Managed process inspection (`hub ps`) showed `paperclip-dev` exited, but its managed watcher was still listening on `127.0.0.1:3100` (PID 25416); no duplicate server was started.
- Command: `curl.exe -sS -i http://127.0.0.1:3100/api/health`
- Result: HTTP 200; `status=ok`, version `0.3.1`, `deploymentMode=local_trusted`, `bootstrapStatus=ready`, `authReady=true`.

## Required tests

1. Command: `node --test companies/suijin-content/tests/suijin-pipeline-contract.test.mjs`
   - Result: PASS.
   - Output summary: 1 test passed, 0 failed, 0 skipped.

2. Command: `pnpm exec vitest run --project @paperclipai/server server/src/__tests__/company-portability.test.ts`
   - Result: PASS.
   - Output summary: 1 test file passed; 49 tests passed, 0 failed; duration 10.32s.

3. Command: `pnpm test`
   - Result: BLOCKED by the known Windows/toolchain process-spawn issue; the suite was not bypassed or altered.
   - Exact failure summary:
     - `preflight:workspace-links` completed successfully.
     - `test:run` selected `general-server` suites excluding 91 serialized suites.
     - Vitest startup failed with `spawnSync pnpm ENOENT`.
     - Command exited with code 1.

4. Working directory `D:/seatek_tasks/Plugins/noto`; command: `pnpm test`
   - Result: PASS.
   - Output summary: 6 test files passed; 27 tests passed, 0 failed; duration 1.26s.

## Import preview and imported-state inspection

Command:

```powershell
pnpm paperclipai company import ./companies/suijin-content --target new --include company,agents,projects,issues,skills --dry-run --json --api-base http://127.0.0.1:3100
```

Result: PASS; `errors: []`.

Dry-run plan/manifest summary:

- Company action: create `Suijin Content`.
- Agents: 5 create plans (`facebook-publisher`, `facebook-writer`, `image-agent`, `research-agent`, `task-agent`).
- Projects: 1 create plan (`suijin`).
- Issues: 1 create plan (`sample-research-request`, title `Research five current Facebook topics`).
- Package skills: 5 compatible plans (`create-reviewed-topic-tasks`, `research-facebook-topics`, `verifying-published-text`, `write-facebook-post`, plus the package's Noto publication skill). The Noto publication skill is present in the package manifest and the external-runtime warnings are expected.
- Warnings: 8 external/catalog runtime skill references are not bundled (`paperclip`, `noto`, `kie-image-generation`, `agent-browser` as applicable to agents). No import errors.
- Publisher package defaults: status `idle`, adapter type `process`, empty adapter/runtime config in the package manifest; no adapter pin or model pin is declared.

A prior managed import was already present in the healthy instance, so read-only state inspection was performed without applying another import:

- Company: `Suijin Content`, active.
- Agents: 5 imported agents present. Publisher is `idle`; its instance-resolved adapter is `claude_local` with managed skill sync only, not a package adapter override. Task Agent is `error` from prior instance history; no run was started during this verification.
- Project: 1 imported `Suijin` project.
- Starter issue: `SUI-1`, backlog, assigned to Research Agent, retaining the dedicated-test-Page placeholder and fail-closed instructions.
- An unrelated pre-existing manual issue `SUI-2` was observed and left untouched.

## Installed Noto readiness (read-only)

Command: `pnpm paperclipai plugin list --json --api-base http://127.0.0.1:3100`

- `seatek.noto` is installed and reports `status: ready`; `lastError: null`.
- Command: `pnpm paperclipai plugin health seatek.noto --json --api-base http://127.0.0.1:3100`
- Result: healthy; registry, manifest, and status checks all passed.
- Instance Noto configuration read-only inspection showed an `apiBaseUrl` and `lastError: null`.
- Company Noto configuration read-only inspection showed the required config shape (`appId`, `clientId`, `workspaceId`, and a Paperclip secret reference); secret values were not read or printed.
- Sanitized secret metadata inspection showed one active Noto secret reference. No plaintext credential was accessed.
- The installed manifest advertises the read-only-capable functions `list_connections`, `get_connection`, and `list_connection_tools`, plus the mutating-capable generic `execute_connection_function`. The static generic execute schema does not establish the provider's Page/text/media schema.

The required controlled Publisher runtime context was unavailable: `run list --company-id 57b0a2e8-a5bc-4102-a9c3-d0a92f8192f6 --agent-id 86b83201-2d44-4bba-b366-6a45a941baf0 --limit 20 --json --api-base http://127.0.0.1:3100` returned `[]`. Therefore no synthetic run, stale run context, raw credential, direct provider call, or plugin tool execution was used. Live Noto connection discovery and advertised-function inspection could not safely be performed.

## Conditional live smoke

Skipped fail-closed because all dedicated smoke prerequisites were not available and not explicitly verified:

- TAVILY secret bound to Research Agent: not present in sanitized company secret metadata (only the Noto secret reference was present).
- Kie company-scoped secret/config: read-only endpoint returned `null`.
- Noto company configuration: present and schema-shaped, but connected-account discovery was blocked by the missing valid Publisher run context.
- Connected Facebook Noto account and dedicated test Page: not verified.
- Provider function schema explicitly accepting Page, post text, and image/media: not verified.
- Reachable Paperclip attachment URL/media representation: not verified.

No issue was moved to an executable state, no external call was made, and no publication was retried or attempted. Activation prerequisite for the board operator: bind TAVILY to Research Agent, configure Kie company credentials, provide a valid current Publisher runtime context, then use the managed Noto skill to confirm a connected account, dedicated test Page, exact Page/text/image schema, and reachable attachment representation. Only after all are confirmed may the single-topic dedicated-test-Page smoke proceed.

## Hygiene

- Command: `git diff --check`
- Result: PASS (exit 0). Git emitted only normal LF-to-CRLF working-copy warnings for pre-existing modified files; no whitespace errors.
- Command: `git status --short --branch`
- Pre-report result: branch `nha...origin/nha`, ahead 16, with 6 unrelated modified files and 16 unrelated/uncommitted Suijin/planning artifacts already present. Those changes were preserved. This report is the only additional file created by Task 3.
- Package inventory contained only expected package files (`README.md`, `LICENSE`, manifest/company/project/agent/skill/test files); no backup or scaffold artifacts were found.

## Package fixes/commit

No verification failure identified a concrete package defect. No product/package files were modified and no package-fix commit was created.

## Final package-fix pass addendum

Date: 2026-07-21

The focused contract test initially failed because the explicit result-label
assertions treated Markdown line wrapping as literal spaces. The contract now
uses `\s+` between the required words while retaining the complete phrases:
`explicitly labeled external post ID field or path` and
`explicitly labeled permalink field or path`. During the rerun, the same
contract's older ordering markers also exposed valid Markdown wrapping and
updated package wording; those assertions were made whitespace-robust or
aligned to the exact required wording without weakening the phrase checks.
`assertOrdered` now supports literal strings and regular expressions, and the
ordering checks continue to require every marker and preserve sequence.

The rerun exposed these additional focused-test assertion failures before the
final green run; each was corrected in the contract test only:

- `line 173`: `The input did not match the regular expression /explicitly\s+labeled permalink field or path/`
  because the valid Markdown wraps between `labeled` and `permalink`; the
  assertion now uses `explicitly\s+labeled\s+permalink`.
- `line 176`: `missing ordered marker: successful publication artifact`; the
  phrase wraps across a Markdown line break and now uses
  `/successful publication\s+artifact/`.
- `line 176`: `missing ordered marker: do not call Noto again`; the phrase
  wraps across a Markdown line break and now uses `/do not call Noto\s+again/`.
- `line 185`: `The input did not match the regular expression /source links/`;
  the current Unicode skill says `every source link`, so the contract now
  checks that exact required wording.
- `line 186`: `marker is out of order: external post ID`; the reconciliation
  section legitimately mentions an ID before execution, so the contract now
  orders the unambiguous result phrase `external post ID field or path`.
- `line 198`: `marker is out of order: retry`; the reconciliation section
  legitimately contains `no-retry` before the result contract, so the
  assertion now matches the standalone word boundary `/\bretried\b/`.
- `line 203`: the skill uses lowercase `never retried`; the contract now
  matches `/never retried/` while retaining the ambiguity/no-retry ordering
  requirement.

The complete affected-package review covered the Publisher agent, Noto
publication skill, Image Agent, document-neutral Unicode verification skill,
and focused contract test. The applied fixes remain present and coherent:
paginated connection discovery with `page`, `limit`, and `total`; scoped
`connectionIds: [selectedConnectionId]`; durable blocked/no-retry outcomes;
sanitized provider failure reporting; explicitly labeled result identifiers;
existing publication artifact reconciliation; PNG image output; and
readback verification for both article documents and `facebook-post` content.
No Paperclip core files, external plugins, provider calls, or unrelated
worktree changes were modified.

All five `*.fixbackup-20260721-a` files were read and compared against their
corresponding sources before deletion. Only those five final-fix backups were
removed. No other backup, scaffold, or unrelated file was removed.

## Final focused test output

Command:

```text
node --test companies/suijin-content/tests/suijin-pipeline-contract.test.mjs
```

Result:

```text
TAP version 13
# Subtest: Suijin package declares the complete approval-gated Facebook pipeline
ok 1 - Suijin package declares the complete approval-gated Facebook pipeline
1..1
# tests 1
# pass 1
# fail 0
# cancelled 0
# skipped 0
```
