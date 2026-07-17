import type { PluginCompanySettingsPageProps, PluginPageProps } from "@paperclipai/plugin-sdk/ui";
import { useHostNavigation, usePluginData } from "@paperclipai/plugin-sdk/ui";
import type { ReactNode } from "react";

type Generation = {
  generationId: string;
  issueId: string;
  model: string;
  prompt: string;
  purpose: string | null;
  aspectRatio: string;
  resolution: string | null;
  outputFormat: string | null;
  status: string;
  resultUrls: string[];
  estimatedCostCents: number;
  actualCostCents: number | null;
  createdAt: string;
  completedAt: string | null;
  failureMessage: string | null;
};

type HistoryData = { generations: Generation[] };
type SettingsData = {
  apiKeyConfigured: boolean;
  webhookHmacConfigured: boolean;
  publicBaseUrl: string | null;
  pollIntervalSeconds: number;
  timeoutMinutes: number;
  guardrails: {
    maxImagesPerRun: number;
    maxActivePerCompany: number;
    maxEstimatedSpendCentsPerRun: number;
  };
};

export function KieHistoryPage({ context }: PluginPageProps) {
  const companyId = context.companyId ?? "";
  const history = usePluginData<HistoryData>("kie-history", { companyId, limit: 50 });
  const navigation = useHostNavigation();
  const generations = history.data?.generations ?? [];

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-6">
      <header className="flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Automation</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">Kie image generations</h1>
          <p className="mt-1 text-sm text-muted-foreground">Autonomous text-to-image requests and durable Paperclip handoffs.</p>
        </div>
        <a {...navigation.linkProps("/company/settings/kie-image-generation")} className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Configure KieAPI
        </a>
      </header>

      {!companyId ? <Callout tone="warning">Choose a company to view Kie image history.</Callout> : null}
      {history.loading ? <Callout>Loading image history…</Callout> : null}
      {history.error ? <Callout tone="danger">Unable to load history: {history.error.message}</Callout> : null}
      {!history.loading && !history.error && companyId && generations.length === 0 ? (
        <Callout>No Kie image generations have been requested for this company.</Callout>
      ) : null}
      {generations.length > 0 ? (
        <div className="overflow-hidden border border-border bg-background">
          <div className="divide-y divide-border">
            {generations.map((generation) => (
              <GenerationRow key={generation.generationId} generation={generation} />
            ))}
          </div>
        </div>
      ) : null}
    </main>
  );
}

export function KieSettingsPage({ context }: PluginCompanySettingsPageProps) {
  const companyId = context.companyId ?? "";
  const settings = usePluginData<SettingsData>("kie-settings", { companyId });
  const data = settings.data;
  return (
    <main className="mx-auto max-w-3xl space-y-5 p-6">
      <header className="border-b border-border pb-4">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Company settings</p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">Kie image generation</h1>
        <p className="mt-1 text-sm text-muted-foreground">The host-managed plugin settings form owns secret references. This page reports readiness and fixed autonomy guardrails.</p>
      </header>
      {settings.loading ? <Callout>Loading Kie configuration…</Callout> : null}
      {settings.error ? <Callout tone="danger">Unable to load settings: {settings.error.message}</Callout> : null}
      {data ? (
        <div className="space-y-4">
          <section className="grid gap-3 sm:grid-cols-2">
            <SettingCard label="KieAPI secret reference" value={data.apiKeyConfigured ? "Configured" : "Missing"} tone={data.apiKeyConfigured ? "ok" : "danger"} />
            <SettingCard label="Callback HMAC reference" value={data.webhookHmacConfigured ? "Configured" : "Polling fallback"} tone={data.webhookHmacConfigured ? "ok" : "muted"} />
            <SettingCard label="Public callback URL" value={data.publicBaseUrl ?? "Not configured"} tone={data.publicBaseUrl ? "ok" : "muted"} />
            <SettingCard label="Poll / timeout" value={`${data.pollIntervalSeconds}s / ${data.timeoutMinutes}m`} tone="muted" />
          </section>
          <section className="border border-border bg-muted/20 p-4 text-sm">
            <h2 className="font-medium text-foreground">Autonomy guardrails</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>{data.guardrails.maxImagesPerRun} images per agent run</li>
              <li>{data.guardrails.maxActivePerCompany} active generations per company</li>
              <li>${(data.guardrails.maxEstimatedSpendCentsPerRun / 100).toFixed(2)} estimated spend per run</li>
              <li>No confirmation interaction; every request posts a preflight comment first.</li>
            </ul>
          </section>
          <Callout>To change credentials or callback settings, open the plugin manager’s instance configuration form and edit the Paperclip secret references. Raw KieAPI keys are never accepted here.</Callout>
        </div>
      ) : null}
    </main>
  );
}

function GenerationRow({ generation }: { generation: Generation }) {
  const navigation = useHostNavigation();
  const issueHref = navigation.resolveHref(`/issues/${generation.issueId}`);
  const estimate = `$${(generation.estimatedCostCents / 100).toFixed(2)}`;
  const actual = generation.actualCostCents == null ? "—" : `$${(generation.actualCostCents / 100).toFixed(2)}`;
  const resultLabel = generation.resultUrls.length > 0 ? `${generation.resultUrls.length} provider URL(s), persist via skill` : "No provider URLs yet";
  return (
    <article className="space-y-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusPill status={generation.status} />
          <span className="font-mono text-xs text-muted-foreground">{generation.generationId}</span>
        </div>
        <a href={issueHref} className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Open issue</a>
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <div className="font-medium text-foreground">{generation.purpose ?? "Image request"} · {generation.model}</div>
          <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{generation.prompt}</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:min-w-48">
          <dt>Settings</dt><dd className="text-right">{generation.aspectRatio} · {generation.resolution ?? "provider default"} · {generation.outputFormat ?? "provider default"}</dd>
          <dt>Estimate</dt><dd className="text-right">{estimate}</dd>
          <dt>Actual</dt><dd className="text-right">{actual}</dd>
          <dt>Results</dt><dd className="text-right">{resultLabel}</dd>
        </dl>
      </div>
      {generation.failureMessage ? <p className="text-sm text-destructive">{generation.failureMessage}</p> : null}
      <p className="text-xs text-muted-foreground">Started {formatDate(generation.createdAt)}{generation.completedAt ? ` · completed ${formatDate(generation.completedAt)}` : ""}</p>
    </article>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone = status === "success" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700" : status === "fail" || status === "timeout" ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-amber-500/40 bg-amber-500/10 text-amber-700";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}>{status}</span>;
}

function SettingCard({ label, value, tone }: { label: string; value: string; tone: "ok" | "danger" | "muted" }) {
  const valueClass = tone === "ok" ? "text-emerald-700" : tone === "danger" ? "text-destructive" : "text-muted-foreground";
  return <div className="border border-border bg-background p-3"><div className="text-xs text-muted-foreground">{label}</div><div className={`mt-1 text-sm font-medium ${valueClass}`}>{value}</div></div>;
}

function Callout({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "warning" | "danger" }) {
  const className = tone === "danger" ? "border-destructive/30 bg-destructive/5 text-destructive" : tone === "warning" ? "border-amber-500/30 bg-amber-500/5 text-amber-800" : "border-border bg-muted/20 text-muted-foreground";
  return <div className={`border p-4 text-sm ${className}`} role={tone === "danger" ? "alert" : undefined}>{children}</div>;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
