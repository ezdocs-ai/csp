/** Copyright 2026 Google LLC — Apache-2.0
 * Right node inspector for the canvas. Configuration is generated from STEP_FIELDS;
 * ref/ref-list fields render ordered connection summaries with explicit Disconnect
 * controls (config refs are canonical — disconnect writes through the canvas adapter,
 * never derives from legacy outputRef/inputs). See plan §6 "Right inspector".
 *
 * Pure presentation: state/actions arrive via props. Empty state shows workflow
 * validation guidance when no node is selected. */
"use client";

import { useId, useRef } from "react";
import { Badge, Button, Field, Input } from "@/src/components/ui";
import { STEP_FIELDS, type BackendInputRef, type ConfigValues, type StepFieldSpec } from "@/src/features/workflow-editor/hooks/step-configs";
import { normalizeParamOutputName } from "@/src/features/workflow-editor/hooks/identifiers";
import type { InputParam, InputParamType } from "@/src/features/workflow-editor/types";
import type { WorkflowCanvasNodeData } from "../graph-types";

const selectClass = "h-[var(--tri-input-height)] w-full rounded-[var(--tri-input-radius)] border border-[var(--tri-input-border)] bg-[var(--tri-input-bg)] px-[var(--tri-input-padding-inline)] text-[var(--tri-text-primary)]";
const textareaClass = "min-h-20 w-full rounded-[var(--tri-input-radius)] border border-[var(--tri-input-border)] bg-[var(--tri-input-bg)] p-[var(--tri-input-padding-inline)] text-[var(--tri-text-primary)] placeholder:text-[var(--tri-text-tertiary)] focus:border-[var(--tri-input-focus-border)]";
const paramTypes: InputParamType[] = ["text", "image"];

/** One resolved incoming connection on a ref/ref-list field. sourceLabel is the
 * display label of the producing step; the composition layer fills it from the
 * graph edges + step labels. */
export interface InspectorConnectionSummary {
  field: string;
  ref: BackendInputRef;
  sourceLabel: string;
}

/** Per-field connection view the inspector consumes. */
export interface InspectorRefFieldState {
  field: StepFieldSpec;
  connections: InspectorConnectionSummary[];
  /** Ordered ref-list max (model capability). Omit when unlimited/unsupported. */
  capacity?: number;
  /** True when the selected model exposes this ref-list handle at all. */
  handleAvailable?: boolean;
}

/** Human-readable summary of one connection. Pure. */
export function formatRefSummary(ref: BackendInputRef, sourceLabel: string): string {
  return sourceLabel ? `${sourceLabel} · ${ref.output}` : `${ref.step}::${ref.output}`;
}

/** Capacity indicator for a ref-list, e.g. "2 / 4" or "2". Pure. */
export function capacityLabel(count: number, capacity: number | undefined): string {
  return capacity === undefined ? `${count}` : `${count} / ${capacity}`;
}

/** Display label for a STEP_FIELDS field with the required marker. Pure. */
export function fieldDisplayName(field: StepFieldSpec): string {
  return field.required ? `${field.label} *` : field.label;
}

/** True when a config slot holds a resolved BackendInputRef object — the value that
 *  would otherwise render as "[object Object]" inside a text/textarea control.
 *  Strings (incl. the "step::output" inline form) and arrays are NOT objects. Pure. */
export function isBackendInputRefValue(value: unknown): value is BackendInputRef {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "step" in value &&
    "output" in value &&
    typeof (value as { step: unknown }).step === "string" &&
    typeof (value as { output: unknown }).output === "string"
  );
}

/** Split a node's STEP_FIELDS into editable config (non-ref) and connection
 * (ref/ref-list) groups so the inspector renders them in distinct sections. Pure. */
export function splitInspectorFields(node: WorkflowCanvasNodeData): {
  config: StepFieldSpec[];
  refs: StepFieldSpec[];
} {
  const fields = STEP_FIELDS[node.stepType] ?? [];
  const config: StepFieldSpec[] = [];
  const refs: StepFieldSpec[] = [];
  for (const field of fields) {
    if (field.kind === "ref" || field.kind === "ref-list") refs.push(field);
    else config.push(field);
  }
  return { config, refs };
}

/** True for an independent virtual input node projected from the hidden singleton
 *  (canvasKind text-input/image-input). These render their own minimal identity and
 *  never the multi-parameter `+ Add parameter` editor. Pure. */
export function isVirtualInputNode(node: WorkflowCanvasNodeData): boolean {
  return node.canvasKind === "text-input" || node.canvasKind === "image-input";
}

/** Distinct type label shown in the inspector identity for a Ingredients-to-Image
 *  node; ordinary nodes show their backend stepType. Pure. */
export function inspectorTypeLabel(node: WorkflowCanvasNodeData): string {
  return node.canvasKind === "ingredients-image" ? "Ingredients to image" : node.stepType;
}

export interface NodeInspectorProps {
  /** Selected node data, or null to show the empty/guidance state. */
  node: WorkflowCanvasNodeData | null;
  /** Connection summaries for the selected node's ref/ref-list fields. */
  refFields: InspectorRefFieldState[];
  onUpdateLabel: (label: string) => void;
  onUpdateConfig: (patch: Partial<ConfigValues>) => void;
  onUpdateInputParams: (params: InputParam[]) => void;
  /** Clear a scalar ref or remove one ref-list entry. */
  onDisconnectRef: (field: string, ref: BackendInputRef) => void;
  onDelete: () => void;
  /** Whole-workflow validation messages for the empty state summary. */
  validation: string[];
}

export function NodeInspector({
  node,
  refFields,
  onUpdateLabel,
  onUpdateConfig,
  onUpdateInputParams,
  onDisconnectRef,
  onDelete,
  validation,
}: NodeInspectorProps) {
  if (!node) {
    return (
      <aside aria-label="Node inspector" className="flex min-h-0 w-full min-w-0 flex-col gap-[var(--tri-space-3)] overflow-y-auto border-l border-[var(--tri-border-subtle)] bg-[var(--tri-bg-surface)] p-[var(--tri-space-4)]">
        <h2 className="font-[var(--tri-font-display)] text-[var(--tri-text-h4-size)] leading-[var(--tri-text-h4-line-height)]">
          Inspector
        </h2>
        <p className="text-[length:var(--tri-text-small-size)] text-[var(--tri-text-secondary)]">
          Select a node to edit its label, configuration, and connections.
        </p>
        <WorkflowValidationSection validation={validation} />
      </aside>
    );
  }

  // Virtual input nodes (canvasKind text-input/image-input) render ONLY their
  // independent properties: name editor, input-type selector, one output summary,
  // workflow validation, and Delete. They never show config/connection sections or
  // the multi-parameter `+ Add parameter` UI (plan §6 / v2_independent_input_nodes).
  if (isVirtualInputNode(node)) {
    return (
      <aside aria-label={`Inspector for ${node.label}`} className="flex min-h-0 w-full min-w-0 flex-col gap-[var(--tri-space-4)] overflow-y-auto border-l border-[var(--tri-border-subtle)] bg-[var(--tri-bg-surface)] p-[var(--tri-space-4)]">
        <VirtualInputIdentity node={node} onUpdate={onUpdateInputParams} />
        <WorkflowValidationSection validation={validation} />
        <DeleteNode node={node} onDelete={onDelete} />
      </aside>
    );
  }

  const { config: configFields, refs: refFieldSpecs } = splitInspectorFields(node);
  const refStateByField = new Map(refFields.map((entry) => [entry.field.name, entry]));

  return (
    <aside aria-label={`Inspector for ${node.label}`} className="flex min-h-0 w-full min-w-0 flex-col gap-[var(--tri-space-4)] overflow-y-auto border-l border-[var(--tri-border-subtle)] bg-[var(--tri-bg-surface)] p-[var(--tri-space-4)]">
      <NodeIdentity node={node} onUpdateLabel={onUpdateLabel} />

      {configFields.length > 0 ? (
        <fieldset className="grid gap-[var(--tri-space-3)]">
          <legend className="mb-[var(--tri-space-1)] text-[length:var(--tri-label-overline-size)] font-[var(--tri-font-weight-semibold)] uppercase tracking-[var(--tri-label-overline-tracking)] text-[var(--tri-text-tertiary)]">
            Configuration
          </legend>
          {configFields.map((field) => (
            <ConfigField
              key={field.name}
              field={field}
              value={node.config?.[field.name]}
              onChange={onUpdateConfig}
              refState={refStateByField.get(field.name)}
              onDisconnectRef={onDisconnectRef}
            />
          ))}
        </fieldset>
      ) : null}

      {refFieldSpecs.length > 0 ? (
        <section aria-labelledby="inspector-connections" className="grid gap-[var(--tri-space-3)]">
          <h2 id="inspector-connections" className="text-[length:var(--tri-label-overline-size)] font-[var(--tri-font-weight-semibold)] uppercase tracking-[var(--tri-label-overline-tracking)] text-[var(--tri-text-tertiary)]">
            Connections
          </h2>
          {refFieldSpecs.map((field) => (
            <ConnectionField
              key={field.name}
              field={field}
              state={refStateByField.get(field.name)}
              onDisconnectRef={onDisconnectRef}
            />
          ))}
        </section>
      ) : null}

      {node.validation.length > 0 ? (
        <section aria-label="Node validation" className="grid gap-[var(--tri-space-1)]">
          {node.validation.map((error) => (
            <p key={error} className="text-[length:var(--tri-text-small-size)] text-[var(--tri-state-error)]" role="alert">
              {error}
            </p>
          ))}
        </section>
      ) : null}

      {/* Workflow-level validation stays visible even while a node is selected so
        save-blocking problems are never hidden behind node-local errors. */}
      <WorkflowValidationSection validation={validation} />

      <DeleteNode node={node} onDelete={onDelete} />
    </aside>
  );
}

function NodeIdentity({ node, onUpdateLabel }: { node: WorkflowCanvasNodeData; onUpdateLabel: (label: string) => void }) {
  const labelId = useId();
  return (
    <section className="grid gap-[var(--tri-space-2)]">
      <Field htmlFor={labelId} label="Label" error={node.validation.find((e) => /label/i.test(e))}>
        <Input id={labelId} value={node.label} invalid={!node.label.trim()} onChange={(event) => onUpdateLabel(event.target.value)} />
      </Field>
      <div className="flex flex-wrap items-center gap-[var(--tri-space-2)] text-[length:var(--tri-text-caption-size)] text-[var(--tri-text-tertiary)]">
        <Badge tone="neutral">{inspectorTypeLabel(node)}</Badge>
        {node.order === null ? null : <Badge tone="info">#{node.order}</Badge>}
        <span className="font-[var(--tri-font-code)] break-all">{node.stepId}</span>
      </div>
    </section>
  );
}

function ConfigField({ field, value, onChange, refState, onDisconnectRef }: { field: StepFieldSpec; value: ConfigValues[string] | undefined; onChange: (patch: Partial<ConfigValues>) => void; refState: InspectorRefFieldState | undefined; onDisconnectRef: (field: string, ref: BackendInputRef) => void }) {
  const id = useId();
  const focusLiteralRef = useRef(false);
  const connection = refState?.connections[0];
  const objectRef = isBackendInputRefValue(value) ? (value as BackendInputRef) : null;
  const activeRef = connection?.ref ?? objectRef;

  // After "Use literal value" clears the ref, focus the literal control on its
  // fresh mount so the user can type immediately. The callback ref self-clears the
  // one-shot flag, so a later unrelated mount never steals focus.
  const grabFocus = (el: HTMLTextAreaElement | null) => {
    if (el && focusLiteralRef.current) {
      focusLiteralRef.current = false;
      el.focus();
    }
  };

  // Literal-or-ref text/textarea field carrying a resolved BackendInputRef: render a
  // linked-source summary chip (never "[object Object]") with Disconnect and an
  // explicit "Use literal value" action that clears the slot and refocuses it so
  // the user can type again. Stays in the Configuration section (not Connections).
  if ((field.kind === "text" || field.kind === "textarea") && activeRef) {
    const summary = formatRefSummary(activeRef, connection?.sourceLabel ?? "");
    return (
      <LinkedRefChip
        field={field}
        summary={summary}
        onDisconnect={() => onDisconnectRef(field.name, activeRef)}
        onUseLiteral={() => {
          onChange({ [field.name]: "" });
          focusLiteralRef.current = true;
        }}
      />
    );
  }

  if (field.kind === "checkbox") {
    return (
      <label className="flex min-h-11 items-center gap-[var(--tri-space-2)] text-[length:var(--tri-text-small-size)] text-[var(--tri-text-secondary)]" htmlFor={id}>
        <input id={id} type="checkbox" className="size-4" checked={Boolean(value ?? field.default)} onChange={(event) => onChange({ [field.name]: event.target.checked })} />
        {field.label}
      </label>
    );
  }
  return (
    <Field htmlFor={id} label={fieldDisplayName(field)}>
      {field.kind === "textarea" ? (
        <textarea id={id} ref={grabFocus} className={textareaClass} value={typeof value === "string" ? value : String(value ?? "")} onChange={(event) => onChange({ [field.name]: event.target.value })} />
      ) : field.kind === "select" ? (
        <select id={id} className={selectClass} value={typeof value === "string" ? value : String(value ?? field.default)} onChange={(event) => onChange({ [field.name]: event.target.value })}>
          {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : (
        <Input id={id} type={field.kind === "number" ? "number" : "text"} step={field.kind === "number" ? "0.1" : undefined} value={typeof value === "number" ? value : ((value ?? "") as string)} onChange={(event) => onChange({ [field.name]: field.kind === "number" ? event.target.value : event.target.value })} />
      )}
    </Field>
  );
}

/** Linked-source summary for a literal-or-ref text/textarea field whose value is a
 *  resolved BackendInputRef. Pure presentation; actions arrive via props. */
function LinkedRefChip({ field, summary, onDisconnect, onUseLiteral }: { field: StepFieldSpec; summary: string; onDisconnect: () => void; onUseLiteral: () => void }) {
  return (
    <div className="grid gap-[var(--tri-space-2)] rounded-[var(--tri-radius-md)] border border-[var(--tri-border-subtle)] bg-[var(--tri-bg-surface-alt)] p-[var(--tri-space-3)]">
      <span className="text-[length:var(--tri-text-small-size)] font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-secondary)]">
        {fieldDisplayName(field)}
      </span>
      <p className="flex min-h-11 items-center gap-[var(--tri-space-2)] text-[length:var(--tri-text-small-size)] text-[var(--tri-text-primary)]">
        <span aria-hidden="true" className="shrink-0 font-[var(--tri-font-code)] text-[length:var(--tri-text-caption-size)] uppercase tracking-[var(--tri-label-overline-tracking)] text-[var(--tri-text-tertiary)]">Linked</span>
        <span className="min-w-0 flex-1 break-words">{summary}</span>
      </p>
      <div className="flex flex-wrap gap-[var(--tri-space-2)]">
        <Button variant="danger" className="min-h-11 min-w-11 px-3" aria-label={`Disconnect ${summary} from ${field.label}`} onClick={onDisconnect}>
          Disconnect
        </Button>
        <Button variant="secondary" className="min-h-11 px-3" aria-label={`Use a literal value for ${field.label}`} onClick={onUseLiteral}>
          Use literal value
        </Button>
      </div>
    </div>
  );
}

function ConnectionField({ field, state, onDisconnectRef }: { field: StepFieldSpec; state: InspectorRefFieldState | undefined; onDisconnectRef: (field: string, ref: BackendInputRef) => void }) {
  const connections = state?.connections ?? [];
  const capacity = state?.capacity;
  const handleAvailable = state?.handleAvailable ?? true;
  const isList = field.kind === "ref-list";
  const disabledHint = isList && !handleAvailable ? "This model does not accept reference images." : undefined;

  return (
    <div className="grid gap-[var(--tri-space-2)] rounded-[var(--tri-radius-md)] border border-[var(--tri-border-subtle)] bg-[var(--tri-bg-surface-alt)] p-[var(--tri-space-3)]">
      <div className="flex items-center justify-between gap-[var(--tri-space-2)]">
        <span className="text-[length:var(--tri-text-small-size)] font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-secondary)]">
          {fieldDisplayName(field)}
        </span>
        {isList ? (
          <span className="font-[var(--tri-font-code)] text-[length:var(--tri-text-caption-size)] text-[var(--tri-text-tertiary)]">
            {capacityLabel(connections.length, capacity)}
          </span>
        ) : null}
      </div>
      {disabledHint ? <p className="text-[length:var(--tri-text-caption-size)] text-[var(--tri-text-tertiary)]">{disabledHint}</p> : null}
      {connections.length === 0 ? (
        <p className="text-[length:var(--tri-text-caption-size)] text-[var(--tri-text-tertiary)]">
          {isList ? "Drag from an image output to add a reference." : "Drag from a compatible output to connect."}
        </p>
      ) : (
        <ol className="grid gap-[var(--tri-space-1)]">
          {connections.map((connection, index) => (
            <li key={`${connection.ref.step}::${connection.ref.output}`} className="flex min-h-11 items-center gap-[var(--tri-space-2)]">
              {isList ? <span aria-hidden="true" className="font-[var(--tri-font-code)] text-[length:var(--tri-text-caption-size)] text-[var(--tri-text-tertiary)]">{index + 1}.</span> : null}
              <span className="min-w-0 flex-1 truncate text-[length:var(--tri-text-small-size)] text-[var(--tri-text-primary)]">
                {formatRefSummary(connection.ref, connection.sourceLabel)}
              </span>
              <Button
                aria-label={`Disconnect ${formatRefSummary(connection.ref, connection.sourceLabel)} from ${field.label}`}
                title="Disconnect"
                variant="danger"
                className="min-h-11 min-w-11 px-3"
                onClick={() => onDisconnectRef(field.name, connection.ref)}
              >
                ×
              </Button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Independent virtual input node editor: a single run-time parameter projected
 *  from the hidden singleton. Renders ONLY the name editor, an accessible text/image
 *  type selector (the hook's updateInputParams replaces the one projected param, so
 *  a type change re-derives canvasKind), and the one output id/type summary derived
 *  from the single projected param output. NEVER the multi-param `+ Add parameter`
 *  UI, and no implicit connections — edits flow through `onUpdateInputParams` with
 *  the single param. Pure presentation. */
function VirtualInputIdentity({ node, onUpdate }: { node: WorkflowCanvasNodeData; onUpdate: (params: InputParam[]) => void }) {
  const nameId = useId();
  const typeId = useId();
  const outId = `${nameId}-output`;
  const typeLabel = node.canvasKind === "image-input" ? "Image input" : "Text input";
  const param: InputParam = node.inputParams?.[0] ?? { name: node.label, type: node.canvasKind === "image-input" ? "image" : "text" };
  const output = normalizeParamOutputName(param.name);
  const refType = param.type === "image" ? "image" : "text";
  const commit = (patch: Partial<InputParam>) => onUpdate([{ ...param, ...patch }]);
  return (
    <section className="grid gap-[var(--tri-space-3)]" aria-label={`${typeLabel} properties`}>
      <div className="flex flex-wrap items-center gap-[var(--tri-space-2)] text-[length:var(--tri-text-caption-size)] text-[var(--tri-text-tertiary)]">
        <Badge tone="info">{typeLabel}</Badge>
        <span className="font-[var(--tri-font-code)] break-all">{node.stepId}</span>
      </div>
      <Field htmlFor={nameId} label="Name">
        <Input id={nameId} value={param.name} aria-describedby={output ? outId : undefined} onChange={(event) => commit({ name: event.target.value })} />
      </Field>
      <Field htmlFor={typeId} label="Input type">
        <select id={typeId} className={selectClass} value={param.type} onChange={(event) => commit({ type: event.target.value as InputParamType })}>
          {paramTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </Field>
      {/* One output summary: the stable id (the single projected param output) + its type. */}
      <p id={outId} className="text-[length:var(--tri-text-caption-size)] text-[var(--tri-text-tertiary)]" role="status">
        Output: <span className="font-[var(--tri-font-code)]">{output || "(unnamed)"}</span> · {refType}
      </p>
    </section>
  );
}

/** Whole-workflow validation summary. Rendered in BOTH the empty and selected
 * states so save-blocking issues are always surfaced and never hidden behind a
 * node's own validation. Pure presentation over the `validation` prop. */
function WorkflowValidationSection({ validation }: { validation: string[] }) {
  return (
    <section aria-labelledby="inspector-validation" className="grid gap-[var(--tri-space-2)]">
      <h3 id="inspector-validation" className="text-[length:var(--tri-label-overline-size)] font-[var(--tri-font-weight-semibold)] uppercase tracking-[var(--tri-label-overline-tracking)] text-[var(--tri-text-tertiary)]">
        Workflow validation
      </h3>
      {validation.length === 0 ? (
        <p className="text-[length:var(--tri-text-small-size)] text-[var(--tri-text-secondary)]" role="status">
          No validation issues.
        </p>
      ) : (
        <ul className="grid gap-[var(--tri-space-1)] text-[length:var(--tri-text-small-size)] text-[var(--tri-state-error)]" role="alert">
          {validation.map((error) => <li key={error}>{error}</li>)}
        </ul>
      )}
    </section>
  );
}

function DeleteNode({ node, onDelete }: { node: WorkflowCanvasNodeData; onDelete: () => void }) {
  return (
    <div className="grid gap-[var(--tri-space-2)]">
      <Button variant="danger" className="self-start" onClick={onDelete}>
        Delete {node.label}
      </Button>
      {/* A single confirm owns the canvas editor: a node with no downstream refs
        deletes directly via the editor's removeNode guard; a node with dependents
        opens one top-level ConfirmDialog (native <dialog> — the browser traps
        focus, Escape closes, focus restores) whose confirm atomically clears refs
        and removes the node. A second confirm here would double-prompt. The 44px
        target + accessible name come from the shared Button. */}
    </div>
  );
}
