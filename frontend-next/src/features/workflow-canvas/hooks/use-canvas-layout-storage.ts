/** Copyright 2026 Google LLC — Apache-2.0
 * Saved-workflow-only local layout persistence (plan §10). Positions/viewport
 * are stored per `workflowId` under a key that includes a stable hash of the
 * step list, so adding/removing/retyping steps naturally invalidates stale
 * positions. The hash also covers the user-input step's virtual outputs
 * (singleton id + normalized output name + type), so renaming/adding/removing a
 * run-time parameter invalidates the layout too. Version mismatch or hash
 * mismatch discards the stored layout and falls back to the adapter's
 * deterministic layout.
 *
 * Storage version 2 (v2): the v1 signature ignored virtual outputs and is
 * rejected outright — a v1 payload is dropped by the version check, and any v1
 * key left in storage is a hash-miss that gets pruned on the next write.
 *
 * Unsaved workflows (empty `workflowId`) are NEVER persisted: their positions
 * live only in component memory until the first save returns an id.
 *
 * No React Flow metadata (dimensions/selected/style) is stored. The pure
 * helpers accept an optional `storage` (defaults to `window.localStorage`) so
 * tests can supply an in-memory Storage. */
"use client";

import { useCallback } from "react";

import type {
  SavedLayout,
  Viewport,
  WorkflowCanvasNode,
  XYPosition,
} from "../graph-types";
import type { WorkflowStep } from "../../workflow-editor/types";
import { toIdentifier } from "../../workflow-editor/hooks/transforms";

export const LAYOUT_STORAGE_VERSION = 2;

/* --------------------------------- hash ----------------------------------- */

/** FNV-1a 32-bit — stability only, not cryptographic. The signature is the
 *  sorted token set of the workflow shape, so the same shape produces the same
 *  hash regardless of array order. Tokens:
 *  - real steps: `${id}:${type}` (order-independent, as before);
 *  - virtual input outputs of the (singleton) user-input step:
 *    `${stepId}/${normalizedOutputName}:${type}`, using `toIdentifier` so a
 *    renamed parameter ("Prompt" -> "prompt") is the only stable identity and
 *    any add/remove/rename of a run-time parameter invalidates the layout. */
export function layoutHash(steps: WorkflowStep[]): string {
  const tokens: string[] = [];
  for (const s of steps) {
    tokens.push(`${s.id}:${s.type}`);
    if (s.type === "user-input") {
      for (const p of s.inputParams ?? []) {
        const name = toIdentifier(p.name);
        // Skip blank identifiers: an empty "new param" row contributes no output
        // (matches paramsToOutputs) and must not churn the hash.
        if (name) tokens.push(`${s.id}/${name}:${p.type}`);
      }
    }
  }
  const sig = tokens.sort().join("|");
  let h = 0x811c9dc5;
  for (let i = 0; i < sig.length; i++) {
    h ^= sig.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/* ------------------------------- storage key ------------------------------ */

function storageKey(workflowId: string, hash: string): string {
  return `workflow-canvas:${workflowId}:${hash}`;
}

function resolveStorage(storage?: Storage | null): Storage | null {
  if (storage !== undefined) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

/* --------------------------------- read ----------------------------------- */

/** Read the saved layout for `workflowId`. Returns null when the workflow is
 *  unsaved, the key is missing, the JSON is corrupt, the version mismatches,
 *  or the stored hash no longer matches the current step list. */
export function readSavedLayout(
  workflowId: string,
  steps: WorkflowStep[],
  storage?: Storage | null,
): SavedLayout | null {
  if (!workflowId) return null;
  const s = resolveStorage(storage);
  if (!s) return null;
  const hash = layoutHash(steps);
  const raw = s.getItem(storageKey(workflowId, hash));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SavedLayout;
    if (parsed.version !== LAYOUT_STORAGE_VERSION) return null;
    if (parsed.hash !== hash) return null;
    return parsed;
  } catch {
    return null;
  }
}

/* --------------------------------- write ---------------------------------- */

/** A persisted layout entry. `stepId` holds any canvas node id — a backend
 *  step id or a synthetic canvas-only node id — and need not map to a real
 *  WorkflowStep; storage treats it as an opaque node id keyed only by
 *  the workflow's shape hash. */
export type LayoutPositionEntry = { stepId: string; position: XYPosition };

/** Remove earlier `workflow-canvas:<workflowId>:*` entries left over from
 *  previous step hashes, keeping only `keepKey`. Scoped to this workflow's key
 *  prefix, so it never touches other workflows or unrelated storage. Best-effort:
 *  any Storage exception (or a custom Storage mock that doesn't implement
 *  `length`/`key`) is swallowed so cleanup can't break the write path. */
function pruneStaleWorkflowKeys(s: Storage, workflowId: string, keepKey: string): void {
  const prefix = `workflow-canvas:${workflowId}:`;
  let length: number;
  try {
    length = s.length;
  } catch {
    return;
  }
  // Iterate backwards: removing an entry shifts later indices, so descending
  // order keeps remaining indices stable.
  for (let i = length - 1; i >= 0; i--) {
    let k: string | null = null;
    try {
      k = s.key(i);
    } catch {
      continue;
    }
    if (k === null || !k.startsWith(prefix) || k === keepKey) continue;
    try {
      s.removeItem(k);
    } catch {
      /* best-effort: a failed removal must not abort cleanup of the rest */
    }
  }
}

/** Persist positions/viewport under `workflowId`. No-op when the workflow is
 *  unsaved (empty id) or storage is unavailable (SSR). On a successful write,
 *  older keys for the same workflow (previous step hashes) are pruned so stale
 *  entries don't accumulate; the just-written version/hash payload is kept. */
export function writeSavedLayout(
  workflowId: string,
  steps: WorkflowStep[],
  positions: Iterable<LayoutPositionEntry>,
  viewport: Viewport | null,
  storage?: Storage | null,
): void {
  if (!workflowId) return;
  const s = resolveStorage(storage);
  if (!s) return;
  const hash = layoutHash(steps);
  const key = storageKey(workflowId, hash);
  // `nodes[].stepId` carries any canvas node id (not only real step ids); the
  // entry is opaque to storage and is invalidated purely by the shape hash.
  const layout: SavedLayout = {
    version: LAYOUT_STORAGE_VERSION,
    hash,
    nodes: Array.from(positions, (p) => ({ stepId: p.stepId, position: p.position })),
    viewport: viewport ?? undefined,
  };
  s.setItem(key, JSON.stringify(layout));
  pruneStaleWorkflowKeys(s, workflowId, key);
}

/* --------------------------------- clear ---------------------------------- */

/** Remove the saved layout matching the current step hash. Stale hashes are
 *  left for the browser to evict (or for an explicit cleanup pass elsewhere). */
export function clearSavedLayout(
  workflowId: string,
  steps: WorkflowStep[],
  storage?: Storage | null,
): void {
  if (!workflowId) return;
  const s = resolveStorage(storage);
  if (!s) return;
  s.removeItem(storageKey(workflowId, layoutHash(steps)));
}

/* ---------------------------------- hook ---------------------------------- */

export type CanvasLayoutStorage = {
  read: (workflowId: string, steps: WorkflowStep[]) => SavedLayout | null;
  write: (
    workflowId: string,
    steps: WorkflowStep[],
    nodes: WorkflowCanvasNode[],
    viewport: Viewport | null,
  ) => void;
  clear: (workflowId: string, steps: WorkflowStep[]) => void;
};

/**
 * Thin stable-callback wrapper around the pure helpers. Callers pass the live
 * canvas `nodes` (whose `id` is the canonical canvas node id — a backend step id
 * OR a virtual input node id) plus the current viewport; the hook extracts
 * positions and persists only what the storage contract allows. Keyed by
 * `node.id` (NOT `data.stepId`): virtual input nodes share `data.stepId` (the
 * hidden singleton), so keying on it would collapse every virtual node onto one
 * position. */
export function useCanvasLayoutStorage(): CanvasLayoutStorage {
  const read = useCallback(
    (workflowId: string, steps: WorkflowStep[]) => readSavedLayout(workflowId, steps),
    [],
  );
  const write = useCallback(
    (
      workflowId: string,
      steps: WorkflowStep[],
      nodes: WorkflowCanvasNode[],
      viewport: Viewport | null,
    ) =>
      writeSavedLayout(
        workflowId,
        steps,
        nodes.map((n) => ({ stepId: n.id, position: n.position })),
        viewport,
      ),
    [],
  );
  const clear = useCallback(
    (workflowId: string, steps: WorkflowStep[]) => clearSavedLayout(workflowId, steps),
    [],
  );
  return { read, write, clear };
}
