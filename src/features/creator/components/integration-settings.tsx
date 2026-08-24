"use client";

import { useActionState, useState, useTransition } from "react";
import {
  Activity,
  CheckCircle2,
  Cloud,
  Database,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  PauseCircle,
  PlayCircle,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRoundPlus,
} from "lucide-react";

import {
  addBridgeAccountAction,
  activateProviderAction,
  deleteBridgeAccountAction,
  deleteProviderAction,
  disconnectDriveAction,
  loadProviderModelsAction,
  saveProviderAction,
  setBridgeAccountEnabledAction,
  setBridgeRateLimitAction,
} from "@/app/(admin)/admin/integrations/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DriveConnectionStatus } from "@/features/creator/server/drive";
import type { R2Status } from "@/features/creator/server/r2";
import type {
  BridgeAccountStatus,
  BridgePoolStatus,
  ImageProviderKind,
  ImageProviderSetting,
  IntegrationActionState,
} from "@/features/creator/types";

const initialActionState: IntegrationActionState = { status: "idle", message: "" };

export function IntegrationSettings({
  providers,
  bridgePool,
  bridgeMessage,
  drive,
  r2,
  setupMessage,
  initialMessage,
}: {
  providers: ImageProviderSetting[];
  bridgePool: BridgePoolStatus | null;
  bridgeMessage: string | null;
  drive: DriveConnectionStatus;
  r2: R2Status;
  setupMessage: string | null;
  initialMessage: string;
}) {
  const [saveState, saveAction, savePending] = useActionState(saveProviderAction, initialActionState);
  const [accountState, accountAction, accountPending] = useActionState(addBridgeAccountAction, initialActionState);
  const [rateState, rateAction, ratePending] = useActionState(setBridgeRateLimitAction, initialActionState);
  const [kind, setKind] = useState<ImageProviderKind>("gemini-official");
  const [baseUrl, setBaseUrl] = useState("https://generativelanguage.googleapis.com/v1");
  const [model, setModel] = useState("gemini-3.1-flash-image");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [localMessage, setLocalMessage] = useState(initialMessage);
  const [isPending, startTransition] = useTransition();
  const feedback = localMessage || accountState.message || rateState.message || saveState.message;

  function loadModels() {
    setLocalMessage("");
    startTransition(async () => {
      const result = await loadProviderModelsAction({ kind, baseUrl, apiKey });
      if (result.ok) {
        setModels(result.models);
        setLocalMessage(`Loaded ${result.models.length} models.`);
      } else {
        setLocalMessage(result.message);
      }
    });
  }

  function runProviderMutation(action: (id: string) => Promise<IntegrationActionState>, id: string) {
    setLocalMessage("");
    startTransition(async () => {
      const result = await action(id);
      setLocalMessage(result.message);
    });
  }

  function runBridgeMutation(action: () => Promise<IntegrationActionState>) {
    setLocalMessage("");
    startTransition(async () => {
      const result = await action();
      setLocalMessage(result.message);
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-neon">Admin / Integrations</p>
        <h1 className="mt-3 font-display text-3xl font-bold">Creator integrations</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Configure one image provider, one admin-owned Drive archive, and the optional 24-hour R2 hot cache.</p>
      </div>

      {setupMessage ? <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm leading-6 text-amber-100">{setupMessage}</div> : null}
      <div className="min-h-6 text-sm text-muted" aria-live="polite">{feedback}</div>

      <Card className="overflow-hidden">
        <div className="border-b border-white/10 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-neon/10 text-brand-neon"><PlugZap className="h-5 w-5" aria-hidden="true" /></span>
            <div><h2 className="font-display text-xl font-bold">Image provider</h2><p className="mt-1 text-sm leading-6 text-muted">A provider must generate a new image from an uploaded reference before it can be activated.</p></div>
          </div>
        </div>

        <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[1fr_1.1fr]">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-muted">Saved providers</h3>
            <div className="mt-3 space-y-3">
              {providers.length ? providers.map((provider) => (
                <div key={provider.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><div className="flex items-center gap-2"><p className="font-semibold">{provider.name}</p>{provider.isActive ? <Badge variant="success">Active</Badge> : null}</div><p className="mt-1 break-all text-xs text-muted">{provider.model} · {provider.baseUrl}</p></div>
                    <Badge variant={provider.supportsReferenceImages ? "success" : "warning"}>{provider.supportsReferenceImages ? "Full test passed" : "Reference test failed"}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted"><KeyRound className="h-3.5 w-3.5" aria-hidden="true" /> API key: {provider.hasApiKey ? "•••••••• stored in Vault" : "not required"}</div>
                  {provider.lastError ? <p className="mt-3 rounded-lg bg-amber-300/5 p-3 text-xs leading-5 text-amber-100">{provider.lastError}</p> : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {!provider.isActive ? <Button type="button" variant="primary" disabled={isPending || !provider.supportsReferenceImages} onClick={() => runProviderMutation(activateProviderAction, provider.id)}><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Activate</Button> : null}
                    {!provider.isActive ? <Button type="button" variant="danger" disabled={isPending} onClick={() => runProviderMutation(deleteProviderAction, provider.id)}><Trash2 className="h-4 w-4" aria-hidden="true" /> Delete</Button> : null}
                  </div>
                </div>
              )) : <p className="rounded-xl border border-dashed border-white/12 p-5 text-sm text-muted">No provider saved yet.</p>}
            </div>
          </div>

          <form action={saveAction} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <h3 className="font-display text-lg font-bold">Add and test provider</h3>
            <p className="mt-1 text-xs leading-5 text-muted">The full test creates one small reference-guided image and may use provider credits. Passing does not activate automatically.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <AdminField label="Name" htmlFor="provider-name"><input id="provider-name" name="name" required className={inputClassName} placeholder="Official Gemini" /></AdminField>
              <AdminField label="Provider type" htmlFor="provider-kind"><select id="provider-kind" name="kind" value={kind} onChange={(event) => { const next = event.target.value as ImageProviderKind; setKind(next); if (next === "gemini-official") setBaseUrl("https://generativelanguage.googleapis.com/v1"); }} className={inputClassName}><option value="gemini-official">Official Gemini</option><option value="gemini-compatible">Gemini-compatible bridge</option></select></AdminField>
              <div className="sm:col-span-2"><AdminField label="Complete API base URL" htmlFor="provider-url"><input id="provider-url" name="baseUrl" type="url" required value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} className={inputClassName} placeholder="https://host.example/gemini/v1beta" /></AdminField></div>
              <AdminField label="Model" htmlFor="provider-model"><input id="provider-model" name="model" list="provider-models" required value={model} onChange={(event) => setModel(event.target.value)} className={inputClassName} /><datalist id="provider-models">{models.map((item) => <option key={item} value={item} />)}</datalist></AdminField>
              <AdminField label="API key" htmlFor="provider-key" hint="Never returned after storage."><input id="provider-key" name="apiKey" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} className={inputClassName} autoComplete="new-password" placeholder="Paste provider key" /></AdminField>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={loadModels} disabled={isPending || !baseUrl}><RefreshCw className={isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" /> Load models</Button>
              <Button type="submit" variant="primary" disabled={savePending || Boolean(setupMessage)}>{savePending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />} Test and save</Button>
            </div>
          </form>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-white/10 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-neon/10 text-brand-neon"><Activity className="h-5 w-5" aria-hidden="true" /></span>
              <div><h2 className="font-display text-xl font-bold">Gemini account rotation</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-muted">Add account cookies once. The bridge sends each new request to the least-used ready account and keeps every account inside the same request limit.</p></div>
            </div>
            {bridgePool ? <Badge variant={bridgePool.summary.ready > 0 ? "success" : "warning"}>{bridgePool.summary.ready} ready of {bridgePool.summary.total}</Badge> : null}
          </div>
        </div>

        {bridgeMessage ? <div className="m-5 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm leading-6 text-amber-100 sm:m-6">{bridgeMessage}</div> : null}
        {!bridgePool && !bridgeMessage ? <p className="p-5 text-sm leading-6 text-muted sm:p-6">Activate a Gemini-compatible bridge to manage rotating accounts here.</p> : null}
        {bridgePool ? (
          <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="grid gap-3 sm:grid-cols-3">
                <PoolMetric label="Ready" value={bridgePool.summary.ready} />
                <PoolMetric label="Busy" value={bridgePool.summary.busy} />
                <PoolMetric label="At limit" value={bridgePool.summary.limited} />
              </div>
              <div className="mt-4 space-y-3">
                {bridgePool.accounts.length ? bridgePool.accounts.map((account) => (
                  <BridgeAccountRow
                    key={account.id}
                    account={account}
                    pending={isPending}
                    onToggle={() => runBridgeMutation(() => setBridgeAccountEnabledAction(account.id, !account.enabled))}
                    onDelete={() => runBridgeMutation(() => deleteBridgeAccountAction(account.id))}
                  />
                )) : <p className="rounded-xl border border-dashed border-white/12 p-5 text-sm text-muted">No Gemini account added yet.</p>}
              </div>
            </div>

            <div className="space-y-4">
              <form action={rateAction} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                <h3 className="font-display text-lg font-bold">Request limit for every account</h3>
                <p className="mt-1 text-xs leading-5 text-muted">Example: 1 request in 60 seconds applies separately to each enabled account.</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <AdminField label="Requests" htmlFor="bridge-requests"><input id="bridge-requests" name="requests" type="number" min="1" max="100" defaultValue={bridgePool.rateLimit.requests} required className={inputClassName} /></AdminField>
                  <AdminField label="Seconds" htmlFor="bridge-window"><input id="bridge-window" name="windowSeconds" type="number" min="1" max="86400" defaultValue={bridgePool.rateLimit.windowSeconds} required className={inputClassName} /></AdminField>
                </div>
                <Button className="mt-4" type="submit" variant="secondary" disabled={ratePending}>{ratePending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />} Save limit</Button>
              </form>

              <form action={accountAction} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                <h3 className="font-display text-lg font-bold">Add or refresh Gemini account</h3>
                <p className="mt-1 text-xs leading-5 text-muted">Paste fresh cookies to add an account or restore the same account after its session expires. Cookies are sent only to your private bridge and are never shown again.</p>
                <div className="mt-4 space-y-4">
                  <AdminField label="Account name" htmlFor="bridge-label"><input id="bridge-label" name="label" required maxLength={80} className={inputClassName} placeholder="Gemini account 2" /></AdminField>
                  <AdminField label="__Secure-1PSID" htmlFor="bridge-1psid"><input id="bridge-1psid" name="secure1psid" type="password" required autoComplete="new-password" className={inputClassName} /></AdminField>
                  <AdminField label="__Secure-1PSIDTS" htmlFor="bridge-1psidts" hint="Optional when this cookie is not present."><input id="bridge-1psidts" name="secure1psidts" type="password" autoComplete="new-password" className={inputClassName} /></AdminField>
                </div>
                <Button className="mt-4" type="submit" variant="primary" disabled={accountPending}>{accountPending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserRoundPlus className="h-4 w-4" aria-hidden="true" />} Add and check account</Button>
              </form>
            </div>
          </div>
        ) : null}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-400/10 text-sky-200"><Database className="h-5 w-5" aria-hidden="true" /></span><div><h2 className="font-display text-xl font-bold">Google Drive archive</h2><p className="mt-1 text-sm leading-6 text-muted">One administrator connects Drive. Users never see Google permissions.</p></div></div>
          <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">Connection</span><Badge variant={drive.connected ? "success" : drive.configured ? "warning" : "danger"}>{drive.connected ? "Connected" : drive.configured ? "Ready to connect" : "Environment missing"}</Badge></div>
            {drive.accountEmail ? <p className="mt-2 text-xs text-muted">{drive.accountEmail}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {!drive.connected ? <a href="/admin/integrations/google-drive/connect" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-neon px-4 text-sm font-bold text-black hover:bg-brand-soft"><ExternalLink className="h-4 w-4" aria-hidden="true" /> Connect Google Drive</a> : <Button type="button" variant="danger" disabled={isPending} onClick={() => startTransition(async () => { const result = await disconnectDriveAction(); setLocalMessage(result.message); })}>Disconnect</Button>}
            </div>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-400/10 text-violet-200"><Cloud className="h-5 w-5" aria-hidden="true" /></span><div><h2 className="font-display text-xl font-bold">Cloudflare R2 hot cache</h2><p className="mt-1 text-sm leading-6 text-muted">Private, signed access for the first 24 hours. Drive remains the durable source.</p></div></div>
          <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">Configuration</span><Badge variant={r2.healthy ? "success" : r2.configured ? "danger" : "warning"}>{r2.healthy ? "Healthy" : r2.configured ? "Health check failed" : "Optional / not set"}</Badge></div>
            <p className="mt-2 text-xs text-muted">Bucket: {r2.bucket ?? "—"} · Retention: {r2.retentionHours} hours</p>
            <p className="mt-2 text-xs leading-5 text-muted">{r2.message}</p>
            <p className="mt-4 text-xs leading-5 text-muted">In Cloudflare, add a lifecycle rule that deletes objects under <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-brand-soft">hot/</code> after one day.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function PoolMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{label}</p><p className="mt-2 font-display text-2xl font-bold">{value}</p></div>;
}

function BridgeAccountRow({
  account,
  pending,
  onToggle,
  onDelete,
}: {
  account: BridgeAccountStatus;
  pending: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const statusVariant = account.status === "ready" ? "success" : account.status === "not_ready" ? "danger" : "warning";
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="font-semibold">{account.label}</p><p className="mt-1 text-xs text-muted">{account.remainingInWindow} of {account.requestLimit} requests left in this {formatWindow(account.windowSeconds)}</p></div>
        <Badge variant={statusVariant}>{account.status.replace("_", " ")}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted">
        <span>Total <strong className="mt-1 block text-sm text-white">{account.totalRequests}</strong></span>
        <span>Passed <strong className="mt-1 block text-sm text-white">{account.successfulRequests}</strong></span>
        <span>Failed <strong className="mt-1 block text-sm text-white">{account.failedRequests}</strong></span>
      </div>
      {account.lastError ? <p className="mt-3 rounded-lg bg-amber-300/5 p-3 text-xs leading-5 text-amber-100">{account.lastError}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={pending} onClick={onToggle}>{account.enabled ? <PauseCircle className="h-4 w-4" aria-hidden="true" /> : <PlayCircle className="h-4 w-4" aria-hidden="true" />}{account.enabled ? "Pause" : "Enable"}</Button>
        <Button type="button" variant="danger" disabled={pending || account.status === "busy"} onClick={onDelete}><Trash2 className="h-4 w-4" aria-hidden="true" /> Remove</Button>
      </div>
    </div>
  );
}

function formatWindow(seconds: number): string {
  if (seconds % 3600 === 0) return `${seconds / 3600} hour${seconds === 3600 ? "" : "s"}`;
  if (seconds % 60 === 0) return `${seconds / 60} minute${seconds === 60 ? "" : "s"}`;
  return `${seconds} seconds`;
}

function AdminField({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return <div><label htmlFor={htmlFor} className="text-sm font-semibold">{label}</label>{hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}<div className="mt-2">{children}</div></div>;
}

const inputClassName = "min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white placeholder:text-brand-gray focus:border-brand-neon/50 focus:outline-none focus-visible:outline-none";
