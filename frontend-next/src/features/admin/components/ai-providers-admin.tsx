/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useState } from "react";

import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  Input,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui";

import { useAiProviders } from "../hooks/use-ai-providers";
import type { AiProvider, AiProviderInput } from "../ai-providers-types";
import { SlideToggle } from "./admin-controls";

const SELECT_CLASS = "h-[var(--tri-input-height)] w-full rounded-[var(--tri-input-radius)] border border-[var(--tri-input-border)] bg-[var(--tri-input-bg)] px-[var(--tri-input-padding-inline)] text-[var(--tri-text-primary)] outline-none transition-[var(--tri-button-transition)] hover:border-[var(--tri-input-hover-border)] focus-visible:border-[var(--tri-input-focus-border)] focus-visible:ring-[3px] focus-visible:ring-[var(--tri-input-focus-ring)]";
const CHECKBOX_CLASS = "size-5 accent-[var(--tri-brand-primary)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--tri-a11y-focus-ring)]";
const EMPTY_FORM: AiProviderInput = { key: "", displayName: "", providerType: "google_vertex", enabled: true, baseUrl: "", timeoutSeconds: 60, secretRef: "" };

/** Build a PATCH input from a stored provider (mirrors the edit form). */
export function providerToInput(provider: AiProvider, enabled: boolean = provider.enabled): AiProviderInput {
  return { key: provider.key, displayName: provider.displayName, providerType: provider.providerType, enabled, baseUrl: provider.baseUrl, timeoutSeconds: provider.timeoutSeconds };
}

export function AiProvidersAdmin({ initial }: { initial: AiProvider[] }) {
  const { providers, loading, error, refresh, create, update, remove, test } = useAiProviders(initial);
  const [editing, setEditing] = useState<{ id?: number; form: AiProviderInput } | null>(null);
  const [deleting, setDeleting] = useState<AiProvider | null>(null);
  const list = providers;
  const [busy, setBusy] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  async function submit() {
    if (!editing?.form.key || !editing.form.displayName) return;
    try {
      if (editing.id !== undefined) await update(editing.id, editing.form);
      else await create(editing.form);
      await refresh();
      setEditing(null);
    } catch (cause) {
      setTestResult({ success: false, message: cause instanceof Error ? cause.message : "Save failed" });
    }
  }

  async function toggleEnabled(provider: AiProvider, enabled: boolean) {
    try {
      await update(provider.id, providerToInput(provider, enabled));
      await refresh();
    } catch (cause) {
      setTestResult({ success: false, message: cause instanceof Error ? cause.message : "Toggle failed" });
    }
  }

  async function runTest(id: number) {
    setBusy(id);
    setTestResult(null);
    try {
      setTestResult(await test(id));
    } catch (cause) {
      setTestResult({ success: false, message: cause instanceof Error ? cause.message : "Test failed" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-[var(--tri-space-6)]">
      <header className="flex flex-wrap items-start justify-between gap-[var(--tri-space-4)]">
        <div className="grid gap-[var(--tri-space-1)]">
          <h1 className="font-[var(--tri-font-display)] text-[length:var(--tri-text-h2-size)] leading-[var(--tri-text-h2-line-height)]">AI providers</h1>
          <p className="text-[var(--tri-text-secondary)]">Configure registry connections without exposing secret values.</p>
        </div>
        <div className="flex min-h-[var(--tri-button-height)] items-center gap-[var(--tri-space-3)]">
          <span className="inline-flex items-center gap-[var(--tri-space-2)] text-[var(--tri-text-tertiary)]"><span className="tabular-nums">{list.length} providers</span>{loading ? <Spinner label="Refreshing AI providers" size="sm" /> : null}</span>
          <Button onClick={() => setEditing({ form: { ...EMPTY_FORM } })}>Add provider</Button>
        </div>
      </header>
      {error ? <p className="text-[var(--tri-state-error)]" role="alert">{error}</p> : null}
      <div className="hidden overflow-hidden rounded-[var(--tri-card-radius)] border border-[var(--tri-border-subtle)] bg-[var(--tri-bg-surface)] md:block">
        <Table aria-busy={loading} aria-label="AI providers" stickyHeader>
          <TableHeader sticky>
            <TableRow>
              <TableHead scope="col">Provider</TableHead>
              <TableHead scope="col">Type</TableHead>
              <TableHead scope="col">Secret</TableHead>
              <TableHead className="text-right" scope="col">Timeout</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead className="text-right" scope="col"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow><TableCell colSpan={6}>{loading ? <div aria-busy="true" aria-label="Loading AI providers" className="mx-auto grid max-w-[var(--tri-measure-compact)] gap-[var(--tri-space-2)] py-[var(--tri-space-8)]">{Array.from({ length: 3 }, (_, index) => <div className="h-[var(--tri-control-height-md)] animate-pulse rounded-[var(--tri-input-radius)] bg-[var(--tri-bg-surface-alt)]" key={index} />)}</div> : <EmptyState actions={<Button onClick={() => setEditing({ form: { ...EMPTY_FORM } })}>Add provider</Button>} description="Add a provider registry entry to connect vendor models." title="No AI providers found" />}</TableCell></TableRow>
            ) : list.map((provider) => (
              <TableRow key={provider.id}>
                <TableCell><div className="grid gap-[var(--tri-space-1)]"><span className="font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-primary)]">{provider.displayName}</span><span className="font-mono text-[length:var(--tri-text-small-size)] text-[var(--tri-text-tertiary)]">{provider.key}</span></div></TableCell>
                <TableCell><Badge tone="info">{provider.providerType.replaceAll("_", " ")}</Badge></TableCell>
                <TableCell><Badge tone={provider.hasSecret ? "success" : "neutral"}>{provider.hasSecret ? "Configured" : "Not set"}</Badge></TableCell>
                <TableCell className="text-right tabular-nums text-[var(--tri-text-secondary)]">{provider.timeoutSeconds}s</TableCell>
                <TableCell><SlideToggle checked={provider.enabled} label={`Toggle ${provider.displayName}`} onChange={(enabled) => void toggleEnabled(provider, enabled)} /></TableCell>
                <TableCell actions><div className="flex justify-end gap-[var(--tri-space-1)]"><Button onClick={() => setEditing({ id: provider.id, form: providerToInput(provider) })} variant="secondary">Edit</Button><Button disabled={busy === provider.id} onClick={() => void runTest(provider.id)} variant="ghost">{busy === provider.id ? "Testing…" : "Test"}</Button><Button onClick={() => setDeleting(provider)} variant="ghost">Delete</Button></div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="md:hidden">
        {list.length === 0 ? (loading ? <div aria-busy="true" aria-label="Loading AI providers" className="grid gap-[var(--tri-space-2)]">{Array.from({ length: 2 }, (_, index) => <div className="h-28 animate-pulse rounded-[var(--tri-card-radius)] bg-[var(--tri-bg-surface-alt)]" key={index} />)}</div> : <EmptyState actions={<Button onClick={() => setEditing({ form: { ...EMPTY_FORM } })}>Add provider</Button>} description="Add a provider registry entry to connect vendor models." title="No AI providers found" />) : <ul className="grid gap-[var(--tri-space-3)]">{list.map((provider) => <li className="grid gap-[var(--tri-space-3)] rounded-[var(--tri-card-radius)] border border-[var(--tri-border-subtle)] bg-[var(--tri-bg-surface)] p-[var(--tri-space-4)]" key={provider.id}><div className="flex items-start justify-between gap-[var(--tri-space-3)]"><div className="min-w-0"><p className="font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-primary)]">{provider.displayName}</p><p className="font-mono text-[length:var(--tri-text-small-size)] text-[var(--tri-text-tertiary)]">{provider.key}</p></div><Badge tone="info">{provider.providerType.replaceAll("_", " ")}</Badge></div><div className="flex flex-wrap gap-[var(--tri-space-2)]"><Badge tone={provider.hasSecret ? "success" : "neutral"}>{provider.hasSecret ? "Secret configured" : "Secret not set"}</Badge><span className="inline-flex items-center text-[length:var(--tri-text-small-size)] text-[var(--tri-text-secondary)]">Timeout {provider.timeoutSeconds}s</span></div><div className="flex items-center justify-between gap-[var(--tri-space-2)] border-t border-[var(--tri-table-row-divider)] pt-[var(--tri-space-3)]"><SlideToggle checked={provider.enabled} label={`Toggle ${provider.displayName}`} onChange={(enabled) => void toggleEnabled(provider, enabled)} /><div className="flex flex-wrap justify-end gap-[var(--tri-space-1)]"><Button onClick={() => setEditing({ id: provider.id, form: providerToInput(provider) })} variant="secondary">Edit</Button><Button disabled={busy === provider.id} onClick={() => void runTest(provider.id)} variant="ghost">{busy === provider.id ? "Testing…" : "Test"}</Button><Button onClick={() => setDeleting(provider)} variant="ghost">Delete</Button></div></div></li>)}</ul>}
      </div>
      {testResult && <p className={testResult.success ? "text-[var(--tri-state-success)]" : "text-[var(--tri-state-error)]"} role={testResult.success ? "status" : "alert"}>{testResult.success ? "Success" : "Failed"}: {testResult.message}</p>}
      {editing && (
        <Dialog onClose={() => setEditing(null)} open size="md" title={editing.id !== undefined ? "Edit provider" : "Add provider"}>
          <form className="mt-[var(--tri-space-4)] grid gap-[var(--tri-space-3)]" onSubmit={async (event) => { event.preventDefault(); await submit(); }}>
            <Field htmlFor="ai-provider-key" label="Key"><Input disabled={editing.id !== undefined} id="ai-provider-key" onChange={(event) => setEditing({ ...editing, form: { ...editing.form, key: event.target.value } })} value={editing.form.key ?? ""} /></Field>
            <Field htmlFor="ai-provider-display-name" label="Display name"><Input id="ai-provider-display-name" onChange={(event) => setEditing({ ...editing, form: { ...editing.form, displayName: event.target.value } })} value={editing.form.displayName ?? ""} /></Field>
            <Field htmlFor="ai-provider-type" label="Provider type"><select className={SELECT_CLASS} id="ai-provider-type" onChange={(event) => setEditing({ ...editing, form: { ...editing.form, providerType: event.target.value } })} value={editing.form.providerType ?? "google_vertex"}><option value="google_vertex">Google Vertex</option><option value="google_ai">Google AI</option><option value="replicate">Replicate</option><option value="fal">fal.ai</option></select></Field>
            <Field htmlFor="ai-provider-base-url" label="Base URL"><Input id="ai-provider-base-url" onChange={(event) => setEditing({ ...editing, form: { ...editing.form, baseUrl: event.target.value } })} value={editing.form.baseUrl ?? ""} /></Field>
            <Field htmlFor="ai-provider-secret" label="Secret Manager reference"><Input id="ai-provider-secret" onChange={(event) => setEditing({ ...editing, form: { ...editing.form, secretRef: event.target.value } })} placeholder="projects/x/secrets/y" value={editing.form.secretRef ?? ""} /></Field>
            <Field htmlFor="ai-provider-timeout" label="Timeout in seconds"><Input id="ai-provider-timeout" min="1" onChange={(event) => setEditing({ ...editing, form: { ...editing.form, timeoutSeconds: Math.max(1, event.target.valueAsNumber || 1) } })} type="number" value={editing.form.timeoutSeconds ?? 60} /></Field>
            <label className="flex min-h-[var(--tri-input-height)] items-center gap-[var(--tri-space-2)] text-[var(--tri-text-secondary)]"><input checked={editing.form.enabled ?? true} className={CHECKBOX_CLASS} onChange={(event) => setEditing({ ...editing, form: { ...editing.form, enabled: event.target.checked } })} type="checkbox" /> Enabled</label>
            <div className="flex justify-end gap-[var(--tri-space-2)]"><Button onClick={() => setEditing(null)} type="button" variant="ghost">Cancel</Button><Button type="submit">{editing.id !== undefined ? "Save changes" : "Add provider"}</Button></div>
          </form>
        </Dialog>
      )}
      <ConfirmDialog
        confirmLabel="Delete"
        message={deleting ? `Delete provider "${deleting.displayName}"? Models using it may stop working.` : ""}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await remove(deleting.id);
          await refresh();
        }}
        open={Boolean(deleting)}
        title="Delete AI provider"
        tone="danger"
      />
    </section>
  );
}
