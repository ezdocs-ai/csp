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

import { useAiModels } from "../hooks/use-ai-models";
import { useAiProviders } from "../hooks/use-ai-providers";
import type { AiModel, AiModelInput } from "../ai-providers-types";
import { SlideToggle } from "./admin-controls";

const SELECT_CLASS = "h-[var(--tri-input-height)] w-full rounded-[var(--tri-input-radius)] border border-[var(--tri-input-border)] bg-[var(--tri-input-bg)] px-[var(--tri-input-padding-inline)] text-[var(--tri-text-primary)] outline-none transition-[var(--tri-button-transition)] hover:border-[var(--tri-input-hover-border)] focus-visible:border-[var(--tri-input-focus-border)] focus-visible:ring-[3px] focus-visible:ring-[var(--tri-input-focus-ring)]";
const CHECKBOX_CLASS = "size-5 accent-[var(--tri-brand-primary)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--tri-a11y-focus-ring)]";

const EMPTY_FORM: AiModelInput = {
  key: "",
  providerId: 0,
  vendorModelId: "",
  mediaType: "video",
  displayName: "",
  enabled: true,
  environment: "production",
  priority: 100,
  capabilities: { textToVideo: true, imageToVideo: false, durations: [5, 8], aspectRatios: ["16:9"], resolutions: ["1K"], maxOutputs: 1 },
  defaults: { durationSeconds: null, aspectRatio: null, resolution: null },
  costMetadata: null,
};

/** Build a PATCH input from a stored model (mirrors the edit form). */
export function modelToInput(model: AiModel, enabled: boolean = model.enabled): AiModelInput {
  return { key: model.key, providerId: model.providerId, vendorModelId: model.vendorModelId, mediaType: model.mediaType, displayName: model.displayName, enabled, capabilities: model.capabilities, defaults: model.defaults, costMetadata: model.costMetadata, environment: model.environment, priority: model.priority };
}

export function AiModelsAdmin({ initial }: { initial: AiModel[] }) {
  const { providers } = useAiProviders();
  const [providerFilter, setProviderFilter] = useState<number | undefined>(undefined);
  const { models, loading, error, refresh, create, update, remove } = useAiModels(providerFilter, initial);
  const [editing, setEditing] = useState<{ id?: number; form: AiModelInput } | null>(null);
  const [deleting, setDeleting] = useState<AiModel | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const list = models;

  async function toggleEnabled(model: AiModel, enabled: boolean) {
    try {
      await update(model.id, modelToInput(model, enabled));
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Could not update model");
    }
  }

  return (
    <section className="space-y-[var(--tri-space-6)]">
      <header className="flex flex-wrap items-start justify-between gap-[var(--tri-space-4)]">
        <div className="grid gap-[var(--tri-space-1)]">
          <h1 className="font-[var(--tri-font-display)] text-[length:var(--tri-text-h2-size)] leading-[var(--tri-text-h2-line-height)]">AI models</h1>
          <p className="text-[var(--tri-text-secondary)]">Map internal model keys to vendor IDs, capabilities, and defaults.</p>
        </div>
        <div className="flex min-h-[var(--tri-button-height)] items-center gap-[var(--tri-space-3)]">
          <span className="inline-flex items-center gap-[var(--tri-space-2)] text-[var(--tri-text-tertiary)]">
            <span className="tabular-nums">{list.length} models</span>
            {loading ? <Spinner label="Refreshing AI models" size="sm" /> : null}
          </span>
          <Button onClick={() => setEditing({ form: { ...EMPTY_FORM, providerId: providers[0]?.id ?? 0 } })}>Add model</Button>
        </div>
      </header>
      <Field htmlFor="ai-model-provider-filter" label="Provider filter">
        <select className={`${SELECT_CLASS} max-w-sm`} id="ai-model-provider-filter" onChange={(event) => setProviderFilter(event.target.value ? Number(event.target.value) : undefined)} value={providerFilter ?? ""}>
          <option value="">All providers</option>
          {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.displayName}</option>)}
        </select>
      </Field>
      {error || (actionError && !editing) ? <p className="text-[var(--tri-state-error)]" role="alert">{error ?? actionError}</p> : null}
      <div className="hidden overflow-hidden rounded-[var(--tri-card-radius)] border border-[var(--tri-border-subtle)] bg-[var(--tri-bg-surface)] md:block">
        <Table aria-busy={loading} aria-label="AI models" stickyHeader>
          <TableHeader sticky>
            <TableRow>
              <TableHead scope="col">Model</TableHead>
              <TableHead scope="col">Provider and vendor</TableHead>
              <TableHead scope="col">Type</TableHead>
              <TableHead scope="col">Environment</TableHead>
              <TableHead className="text-right" scope="col">Priority</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead className="text-right" scope="col"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  {loading ? (
                    <div aria-busy="true" aria-label="Loading AI models" className="mx-auto grid max-w-[var(--tri-measure-compact)] gap-[var(--tri-space-2)] py-[var(--tri-space-8)]">
                      {Array.from({ length: 3 }, (_, index) => <div className="h-[var(--tri-control-height-md)] animate-pulse rounded-[var(--tri-input-radius)] bg-[var(--tri-bg-surface-alt)]" key={index} />)}
                    </div>
                  ) : (
                    <EmptyState actions={<Button onClick={() => setEditing({ form: { ...EMPTY_FORM, providerId: providers[0]?.id ?? 0 } })}>Add model</Button>} description="Add a model mapping or adjust the provider filter." title="No AI models found" />
                  )}
                </TableCell>
              </TableRow>
            ) : list.map((model) => {
              const provider = providers.find((entry) => entry.id === model.providerId);
              const environmentTone = model.environment === "production" ? "success" : model.environment === "staging" ? "warning" : "neutral";
              return (
                <TableRow key={model.id}>
                  <TableCell><div className="grid gap-[var(--tri-space-1)]"><span className="font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-primary)]">{model.displayName}</span><span className="max-w-64 break-words font-mono text-[length:var(--tri-text-small-size)] text-[var(--tri-text-tertiary)]">{model.key}</span></div></TableCell>
                  <TableCell><div className="grid gap-[var(--tri-space-1)]"><span className="text-[var(--tri-text-primary)]">{provider?.displayName ?? model.providerId}</span><span className="max-w-72 break-words font-mono text-[length:var(--tri-text-small-size)] text-[var(--tri-text-tertiary)]">{model.vendorModelId}</span></div></TableCell>
                  <TableCell><Badge tone="info">{model.mediaType}</Badge></TableCell>
                  <TableCell><Badge tone={environmentTone}>{model.environment}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums text-[var(--tri-text-secondary)]">{model.priority}</TableCell>
                  <TableCell><SlideToggle checked={model.enabled} label={`Toggle ${model.displayName}`} onChange={(enabled) => void toggleEnabled(model, enabled)} /></TableCell>
                  <TableCell actions><div className="flex justify-end gap-[var(--tri-space-1)]"><Button onClick={() => setEditing({ id: model.id, form: modelToInput(model) })} variant="secondary">Edit</Button><Button onClick={() => setDeleting(model)} variant="ghost">Delete</Button></div></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="md:hidden">
        {list.length === 0 ? (
          loading ? <div aria-busy="true" aria-label="Loading AI models" className="grid gap-[var(--tri-space-2)]">{Array.from({ length: 3 }, (_, index) => <div className="h-28 animate-pulse rounded-[var(--tri-card-radius)] bg-[var(--tri-bg-surface-alt)]" key={index} />)}</div> : <EmptyState actions={<Button onClick={() => setEditing({ form: { ...EMPTY_FORM, providerId: providers[0]?.id ?? 0 } })}>Add model</Button>} description="Add a model mapping or adjust the provider filter." title="No AI models found" />
        ) : (
          <ul className="grid gap-[var(--tri-space-3)]">
            {list.map((model) => {
              const provider = providers.find((entry) => entry.id === model.providerId);
              const environmentTone = model.environment === "production" ? "success" : model.environment === "staging" ? "warning" : "neutral";
              return <li className="grid gap-[var(--tri-space-3)] rounded-[var(--tri-card-radius)] border border-[var(--tri-border-subtle)] bg-[var(--tri-bg-surface)] p-[var(--tri-space-4)]" key={model.id}><div className="flex items-start justify-between gap-[var(--tri-space-3)]"><div className="min-w-0"><p className="font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-primary)]">{model.displayName}</p><p className="break-words font-mono text-[length:var(--tri-text-small-size)] text-[var(--tri-text-tertiary)]">{model.key}</p></div><Badge tone={environmentTone}>{model.environment}</Badge></div><dl className="grid gap-[var(--tri-space-2)] text-[length:var(--tri-text-small-size)]"><div className="grid gap-[var(--tri-space-1)]"><dt className="text-[var(--tri-text-tertiary)]">Provider</dt><dd className="text-[var(--tri-text-primary)]">{provider?.displayName ?? model.providerId}</dd></div><div className="grid gap-[var(--tri-space-1)]"><dt className="text-[var(--tri-text-tertiary)]">Vendor model</dt><dd className="break-words font-mono text-[var(--tri-text-secondary)]">{model.vendorModelId}</dd></div></dl><div className="flex flex-wrap items-center justify-between gap-[var(--tri-space-2)] border-t border-[var(--tri-table-row-divider)] pt-[var(--tri-space-3)]"><SlideToggle checked={model.enabled} label={`Toggle ${model.displayName}`} onChange={(enabled) => void toggleEnabled(model, enabled)} /><div className="flex gap-[var(--tri-space-1)]"><Button onClick={() => setEditing({ id: model.id, form: modelToInput(model) })} variant="secondary">Edit</Button><Button onClick={() => setDeleting(model)} variant="ghost">Delete</Button></div></div></li>;
            })}
          </ul>
        )}
      </div>
      {editing && (
        <Dialog onClose={() => { setEditing(null); setActionError(null); }} open size="lg" title={editing.id !== undefined ? "Edit model" : "Add model"}>
          <form className="mt-[var(--tri-space-4)] grid gap-[var(--tri-space-4)]" onSubmit={async (event) => { event.preventDefault(); if (!editing.form.key || !editing.form.providerId || !editing.form.vendorModelId) return; setActionError(null); try { if (editing.id !== undefined) await update(editing.id, editing.form); else await create(editing.form); await refresh(); setEditing(null); } catch (cause) { setActionError(cause instanceof Error ? cause.message : "Could not save model"); } }}>
            <div className="grid gap-[var(--tri-space-3)] md:grid-cols-2">
              <Field htmlFor="ai-model-key" label="Key"><Input disabled={editing.id !== undefined} id="ai-model-key" onChange={(event) => setEditing({ ...editing, form: { ...editing.form, key: event.target.value } })} value={editing.form.key ?? ""} /></Field>
              <Field htmlFor="ai-model-display-name" label="Display name"><Input id="ai-model-display-name" onChange={(event) => setEditing({ ...editing, form: { ...editing.form, displayName: event.target.value } })} value={editing.form.displayName ?? ""} /></Field>
              <Field htmlFor="ai-model-provider" label="Provider"><select className={SELECT_CLASS} id="ai-model-provider" onChange={(event) => setEditing({ ...editing, form: { ...editing.form, providerId: Number(event.target.value) } })} value={editing.form.providerId ?? 0}>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.displayName}</option>)}</select></Field>
              <Field htmlFor="ai-model-vendor-id" label="Vendor model ID"><Input id="ai-model-vendor-id" onChange={(event) => setEditing({ ...editing, form: { ...editing.form, vendorModelId: event.target.value } })} value={editing.form.vendorModelId ?? ""} /></Field>
              <Field htmlFor="ai-model-media-type" label="Media type"><select className={SELECT_CLASS} id="ai-model-media-type" onChange={(event) => setEditing({ ...editing, form: { ...editing.form, mediaType: event.target.value } })} value={editing.form.mediaType ?? "video"}><option value="video">Video</option><option value="image">Image</option><option value="audio">Audio</option></select></Field>
              <Field htmlFor="ai-model-environment" label="Environment"><select className={SELECT_CLASS} id="ai-model-environment" onChange={(event) => setEditing({ ...editing, form: { ...editing.form, environment: event.target.value } })} value={editing.form.environment ?? "production"}><option value="production">Production</option><option value="staging">Staging</option><option value="development">Development</option></select></Field>
              <Field htmlFor="ai-model-priority" label="Priority"><Input id="ai-model-priority" min="1" onChange={(event) => setEditing({ ...editing, form: { ...editing.form, priority: Math.max(1, event.target.valueAsNumber || 1) } })} type="number" value={editing.form.priority ?? 100} /></Field>
              <label className="flex min-h-[var(--tri-input-height)] items-center gap-[var(--tri-space-2)] self-end text-[var(--tri-text-secondary)]"><input checked={editing.form.enabled ?? true} className={CHECKBOX_CLASS} onChange={(event) => setEditing({ ...editing, form: { ...editing.form, enabled: event.target.checked } })} type="checkbox" /> Enabled</label>
            </div>
            <fieldset className="grid gap-[var(--tri-space-3)] rounded-[var(--tri-input-radius)] border border-[var(--tri-border-subtle)] bg-[var(--tri-bg-surface-alt)] p-[var(--tri-space-4)] md:grid-cols-2">
              <legend className="px-[var(--tri-space-2)] font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-secondary)]">Capabilities</legend>
              <label className="flex min-h-[var(--tri-input-height)] items-center gap-[var(--tri-space-2)] text-[var(--tri-text-secondary)]"><input checked={editing.form.capabilities?.textToVideo ?? true} className={CHECKBOX_CLASS} onChange={(event) => setEditing({ ...editing, form: { ...editing.form, capabilities: { ...(editing.form.capabilities ?? EMPTY_FORM.capabilities!), textToVideo: event.target.checked } } })} type="checkbox" /> Text to video</label>
              <label className="flex min-h-[var(--tri-input-height)] items-center gap-[var(--tri-space-2)] text-[var(--tri-text-secondary)]"><input checked={editing.form.capabilities?.imageToVideo ?? false} className={CHECKBOX_CLASS} onChange={(event) => setEditing({ ...editing, form: { ...editing.form, capabilities: { ...(editing.form.capabilities ?? EMPTY_FORM.capabilities!), imageToVideo: event.target.checked } } })} type="checkbox" /> Image to video</label>
              <Field htmlFor="ai-model-resolutions" label="Resolutions"><Input id="ai-model-resolutions" onChange={(event) => setEditing({ ...editing, form: { ...editing.form, capabilities: { ...(editing.form.capabilities ?? EMPTY_FORM.capabilities!), resolutions: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) } } })} placeholder="1K, 2K" value={editing.form.capabilities?.resolutions.join(",") ?? ""} /></Field>
              <Field htmlFor="ai-model-durations" label="Durations in seconds"><Input id="ai-model-durations" onChange={(event) => setEditing({ ...editing, form: { ...editing.form, capabilities: { ...(editing.form.capabilities ?? EMPTY_FORM.capabilities!), durations: event.target.value.split(",").map((value) => value.trim()).filter(Boolean).map(Number).filter(Number.isFinite) } } })} placeholder="5, 8" value={editing.form.capabilities?.durations.join(",") ?? ""} /></Field>
              <Field htmlFor="ai-model-aspect-ratios" label="Aspect ratios"><Input id="ai-model-aspect-ratios" onChange={(event) => setEditing({ ...editing, form: { ...editing.form, capabilities: { ...(editing.form.capabilities ?? EMPTY_FORM.capabilities!), aspectRatios: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) } } })} placeholder="16:9, 9:16" value={editing.form.capabilities?.aspectRatios.join(",") ?? ""} /></Field>
              <Field htmlFor="ai-model-max-outputs" label="Maximum outputs"><Input id="ai-model-max-outputs" min="1" onChange={(event) => setEditing({ ...editing, form: { ...editing.form, capabilities: { ...(editing.form.capabilities ?? EMPTY_FORM.capabilities!), maxOutputs: Math.max(1, event.target.valueAsNumber || 1) } } })} type="number" value={editing.form.capabilities?.maxOutputs ?? 1} /></Field>
            </fieldset>
            {actionError ? <p className="text-[var(--tri-state-error)]" role="alert">{actionError}</p> : null}
            <div className="flex justify-end gap-[var(--tri-space-2)]"><Button onClick={() => { setEditing(null); setActionError(null); }} type="button" variant="ghost">Cancel</Button><Button type="submit">{editing.id !== undefined ? "Save changes" : "Add model"}</Button></div>
          </form>
        </Dialog>
      )}
      <ConfirmDialog
        confirmLabel="Delete"
        message={deleting ? `Delete model "${deleting.displayName}"? This cannot be undone.` : ""}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await remove(deleting.id);
          await refresh();
        }}
        open={Boolean(deleting)}
        title="Delete AI model"
        tone="danger"
      />
    </section>
  );
}
