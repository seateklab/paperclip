# Paperclip Kie Image Plugin

`@paperclipai/plugin-kie-image` adds a pure Paperclip plugin for autonomous
curated text-to-image generation through [KieAPI](https://docs.kie.ai/).

## What it does

- exposes `paperclip.kie-image:generate_image`, `get_generation`, and
  `list_generations` to agents;
- supports GPT Image 2 (`gpt-image-2-text-to-image`) and Nano Banana 2
  (`nano-banana-2`) only;
- writes a preflight issue comment and immediately submits without a
  confirmation interaction;
- enforces two images per agent run, three active generations per company, and
  a `$0.20` estimated spend cap per run;
- reconciles Kie callbacks or one-minute polling, posts one terminal comment,
  and requests one idempotent issue wakeup;
- provides the company-scoped `kie-images` history page and a read-only
  diagnostics/settings page;
- installs the `kie-image-generation` managed skill, which downloads temporary
  Kie result URLs and persists them as Paperclip attachments and artifact work
  products.

## Configuration

Install the package through the Paperclip plugin manager. Configure it in two
scopes:

1. In **Instance defaults**, set only non-secret values such as
   `publicBaseUrl`, `pollIntervalSeconds`, and `timeoutMinutes`.
2. In **Company credentials**, choose the Paperclip secret reference that
   contains the KieAPI bearer key in `apiKeyRef`. Optionally choose a company
   secret for `webhookHmacKeyRef`.

Create or import the secret under the selected company first, then use the
secret picker. Do not paste the Kie token into the plugin form: raw token
values are rejected by design. Secret values are resolved only during a
company-scoped tool invocation and are never logged or persisted.

## Agent behavior

Agents should use the managed `kie-image-generation` skill and invoke
`generate_image` with the current company run context. The first host MVP proves
that one scoped call can resolve `apiKeyRef` and submit to Kie without a
confirmation step. Unscoped calls intentionally remain degraded until a
company configuration is selected.

## Development

From the repository root:

```text
pnpm --filter @paperclipai/plugin-kie-image typecheck
pnpm --filter @paperclipai/plugin-kie-image test
pnpm --filter @paperclipai/plugin-kie-image build
pnpm --filter @paperclipai/plugin-kie-image pack --dry-run
```

The package intentionally follows the existing plugin package scripts. The
repository does not define a plugin lint script; use the typecheck as the
static validation and report a missing `lint` script rather than inventing a
new formatter or core lint configuration.
