/** Copyright 2026 Google LLC — Apache-2.0
 * Saved-workflow-only layout persistence: unsaved workflows are never persisted,
 * the storage key embeds a step-hash + version so structural changes or version
 * bumps invalidate stale layouts, and unavailable storage (SSR / null) is a
 * silent no-op. */
import { expect, test } from "bun:test";

import type { WorkflowStep } from "../../workflow-editor/types";
import {
  LAYOUT_STORAGE_VERSION,
  clearSavedLayout,
  layoutHash,
  readSavedLayout,
  writeSavedLayout,
} from "../hooks/use-canvas-layout-storage";

const img = (id: string): WorkflowStep => ({
  id,
  type: "image",
  label: id,
  inputs: [{ mode: "fixed" }],
  config: { prompt: "p", model: "m", aspect_ratio: "1:1", brand_guidelines: false },
});

/** user-input (singleton) step carrying run-time params -> virtual outputs. */
const ui = (
  id: string,
  params: { name: string; type: "text" | "image" }[] = [],
): WorkflowStep => ({
  id,
  type: "user-input",
  label: id,
  inputs: [{ mode: "fixed" }],
  inputParams: params,
});

function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    removeItem: (k: string) => {
      m.delete(k);
    },
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
  } as unknown as Storage;
}

/** Storage whose `key()` always throws — simulates a partial/custom mock. */
function throwingKeyStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    key: () => {
      throw new Error("key() unavailable");
    },
    removeItem: (k: string) => {
      m.delete(k);
    },
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
  } as unknown as Storage;
}

/** Storage whose `removeItem()` always throws — simulates read-only-ish mock. */
function throwingRemoveStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    removeItem: () => {
      throw new Error("removeItem unavailable");
    },
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
  } as unknown as Storage;
}

function keysOf(s: Storage): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) out.push(s.key(i)!);
  return out;
}

// --- saved workflow only ---

test("writeSavedLayout and readSavedLayout are no-ops for an unsaved workflow", () => {
  const s = memStorage();
  const steps = [img("a")];
  writeSavedLayout("", steps, [{ stepId: "a", position: { x: 1, y: 2 } }], null, s);
  expect(s.getItem(`workflow-canvas::${layoutHash(steps)}`)).toBeNull();
  expect(readSavedLayout("", steps, s)).toBeNull();
});

test("writeSavedLayout then readSavedLayout round-trips positions and viewport", () => {
  const s = memStorage();
  const steps = [img("a"), img("b")];
  writeSavedLayout("wf1", steps, [{ stepId: "a", position: { x: 10, y: 20 } }], { x: 1, y: 2, zoom: 3 }, s);
  const layout = readSavedLayout("wf1", steps, s);
  expect(layout).not.toBeNull();
  expect(layout!.version).toBe(LAYOUT_STORAGE_VERSION);
  expect(layout!.nodes).toEqual([{ stepId: "a", position: { x: 10, y: 20 } }]);
  expect(layout!.viewport).toEqual({ x: 1, y: 2, zoom: 3 });
});

// --- key / hash / version invalidation ---

test("readSavedLayout returns null when the step list changed (hash/key mismatch)", () => {
  const s = memStorage();
  writeSavedLayout("wf1", [img("a")], [{ stepId: "a", position: { x: 0, y: 0 } }], null, s);
  // Same workflow id but an added step => different hash => different key => miss.
  expect(readSavedLayout("wf1", [img("a"), img("b")], s)).toBeNull();
});

test("readSavedLayout returns null for a different workflow id", () => {
  const s = memStorage();
  const steps = [img("a")];
  writeSavedLayout("wf1", steps, [{ stepId: "a", position: { x: 0, y: 0 } }], null, s);
  expect(readSavedLayout("wf2", steps, s)).toBeNull();
});

test("readSavedLayout rejects a stored payload whose hash no longer matches", () => {
  const s = memStorage();
  const steps = [img("a")];
  const h = layoutHash(steps);
  s.setItem(`workflow-canvas:wf1:${h}`, JSON.stringify({ version: LAYOUT_STORAGE_VERSION, hash: "deadbeef", nodes: [] }));
  expect(readSavedLayout("wf1", steps, s)).toBeNull();
});

test("readSavedLayout rejects a stored payload with the wrong version", () => {
  const s = memStorage();
  const steps = [img("a")];
  const h = layoutHash(steps);
  s.setItem(`workflow-canvas:wf1:${h}`, JSON.stringify({ version: 999, hash: h, nodes: [] }));
  expect(readSavedLayout("wf1", steps, s)).toBeNull();
});

test("readSavedLayout rejects corrupt JSON", () => {
  const s = memStorage();
  const steps = [img("a")];
  s.setItem(`workflow-canvas:wf1:${layoutHash(steps)}`, "{not json");
  expect(readSavedLayout("wf1", steps, s)).toBeNull();
});

test("layoutHash is order-independent and stable", () => {
  expect(layoutHash([img("a"), img("b")])).toBe(layoutHash([img("b"), img("a")]));
  expect(layoutHash([img("a")])).not.toBe(layoutHash([img("b")]));
});

// --- v2: virtual input outputs in the signature ---

test("layoutHash changes when a user-input parameter is renamed", () => {
  const a = ui("ui", [{ name: "Prompt", type: "text" }]);
  const b = ui("ui", [{ name: "Image", type: "text" }]);
  expect(layoutHash([a])).not.toBe(layoutHash([b]));
});

test("layoutHash changes when a user-input parameter type changes", () => {
  const a = ui("ui", [{ name: "Prompt", type: "text" }]);
  const b = ui("ui", [{ name: "Prompt", type: "image" }]);
  expect(layoutHash([a])).not.toBe(layoutHash([b]));
});

test("layoutHash changes when a user-input parameter is added or removed", () => {
  const one = ui("ui", [{ name: "Prompt", type: "text" }]);
  const two = ui("ui", [{ name: "Prompt", type: "text" }, { name: "Photo", type: "image" }]);
  expect(layoutHash([one])).not.toBe(layoutHash([two]));
});

test("layoutHash is order-independent across user-input parameters and steps", () => {
  const u = ui("ui", [{ name: "Prompt", type: "text" }, { name: "User Image", type: "image" }]);
  const uReordered = ui("ui", [{ name: "User Image", type: "image" }, { name: "Prompt", type: "text" }]);
  // Param order inside the step and step order across the list are both ignored.
  expect(layoutHash([u, img("a")])).toBe(layoutHash([img("a"), uReordered]));
});

test("layoutHash normalizes user-input parameter display names", () => {
  // "User Image" -> "user_image" is the only stable identity (matches paramsToOutputs).
  const display = ui("ui", [{ name: "User Image", type: "image" }]);
  const normalized = ui("ui", [{ name: "user_image", type: "image" }]);
  expect(layoutHash([display])).toBe(layoutHash([normalized]));
});

test("layoutHash ignores a blank user-input parameter (no churn)", () => {
  const blank = ui("ui", [{ name: "   ", type: "text" }]);
  const none = ui("ui", []);
  expect(layoutHash([blank])).toBe(layoutHash([none]));
});

// --- v2 invalidates v1 state ---

test("readSavedLayout rejects a legacy v1 payload even when the key hash matches", () => {
  const s = memStorage();
  const steps = [img("a")];
  const h = layoutHash(steps);
  // No user-input step => the v2 hash equals the legacy v1 hash, so the key is
  // found; the payload itself is version 1 and must be rejected outright.
  s.setItem(
    `workflow-canvas:wf1:${h}`,
    JSON.stringify({ version: 1, hash: h, nodes: [{ stepId: "a", position: { x: 5, y: 5 } }] }),
  );
  expect(readSavedLayout("wf1", steps, s)).toBeNull();
});

test("readSavedLayout returns null after a user-input parameter is renamed", () => {
  const s = memStorage();
  const before = [ui("ui", [{ name: "Prompt", type: "text" }]), img("a")];
  writeSavedLayout("wf1", before, [{ stepId: "ui", position: { x: 1, y: 1 } }], null, s);
  // Renaming the run-time parameter => different virtual output => hash/key miss.
  const after = [ui("ui", [{ name: "Image", type: "text" }]), img("a")];
  expect(readSavedLayout("wf1", after, s)).toBeNull();
});

test("writeSavedLayout prunes a leftover v1-payload key for the same workflow on write", () => {
  const s = memStorage();
  // Seed a leftover v1 entry (version 1) under this workflow's key prefix.
  s.setItem(
    "workflow-canvas:wf1:00000001",
    JSON.stringify({ version: 1, hash: "00000001", nodes: [] }),
  );
  const steps = [ui("ui", [{ name: "Prompt", type: "text" }])];
  writeSavedLayout("wf1", steps, [{ stepId: "ui", position: { x: 0, y: 0 } }], null, s);
  expect(s.getItem("workflow-canvas:wf1:00000001")).toBeNull();
  expect(keysOf(s).filter((k) => k.startsWith("workflow-canvas:wf1:"))).toHaveLength(1);
});

// --- unavailable storage ---

test("readSavedLayout returns null when storage is unavailable", () => {
  expect(readSavedLayout("wf1", [img("a")], null)).toBeNull();
});

test("writeSavedLayout and clearSavedLayout do not throw when storage is unavailable", () => {
  const steps = [img("a")];
  expect(() => writeSavedLayout("wf1", steps, [{ stepId: "a", position: { x: 0, y: 0 } }], null, null)).not.toThrow();
  expect(() => clearSavedLayout("wf1", steps, null)).not.toThrow();
});

// --- clear ---

test("clearSavedLayout removes the stored layout", () => {
  const s = memStorage();
  const steps = [img("a")];
  writeSavedLayout("wf1", steps, [{ stepId: "a", position: { x: 0, y: 0 } }], null, s);
  clearSavedLayout("wf1", steps, s);
  expect(readSavedLayout("wf1", steps, s)).toBeNull();
});

// --- stale-key pruning on write ---

test("writeSavedLayout prunes older same-workflow keys and keeps the current hash", () => {
  const s = memStorage();
  const steps1 = [img("a")];
  writeSavedLayout("wf1", steps1, [{ stepId: "a", position: { x: 0, y: 0 } }], null, s);
  const oldKey = `workflow-canvas:wf1:${layoutHash(steps1)}`;
  expect(keysOf(s)).toEqual([oldKey]);

  // Different step list => new hash => new key; the old key must be pruned.
  const steps2 = [img("a"), img("b")];
  writeSavedLayout("wf1", steps2, [{ stepId: "a", position: { x: 1, y: 1 } }], null, s);
  const newKey = `workflow-canvas:wf1:${layoutHash(steps2)}`;

  expect(keysOf(s)).toEqual([newKey]);
  expect(s.getItem(oldKey)).toBeNull();

  // Surviving payload still carries the right version + hash.
  const layout = readSavedLayout("wf1", steps2, s)!;
  expect(layout.version).toBe(LAYOUT_STORAGE_VERSION);
  expect(layout.hash).toBe(layoutHash(steps2));
});

test("writeSavedLayout never removes keys for other workflows or unrelated storage", () => {
  const s = memStorage();
  const otherSteps = [img("z")];
  writeSavedLayout("wf2", otherSteps, [{ stepId: "z", position: { x: 9, y: 9 } }], null, s);
  s.setItem("unrelated-key", "keep");
  // A stale same-prefix key that isn't a valid layout must be pruned by prefix.
  s.setItem("workflow-canvas:wf1:deadbeef", "{}");

  writeSavedLayout("wf1", [img("a")], [{ stepId: "a", position: { x: 0, y: 0 } }], null, s);

  expect(readSavedLayout("wf2", otherSteps, s)).not.toBeNull();
  expect(s.getItem("unrelated-key")).toBe("keep");
  expect(s.getItem("workflow-canvas:wf1:deadbeef")).toBeNull();
});

test("writeSavedLayout keeps only one key after many writes for a workflow", () => {
  const s = memStorage();
  for (let n = 1; n <= 5; n++) {
    const steps = Array.from({ length: n }, (_, i) => img(`s${i}`));
    writeSavedLayout("wf1", steps, steps.map((st) => ({ stepId: st.id, position: { x: 0, y: 0 } })), null, s);
  }
  const wfKeys = keysOf(s).filter((k) => k.startsWith("workflow-canvas:wf1:"));
  expect(wfKeys.length).toBe(1);
});

// --- storage exception safety during pruning ---

test("writeSavedLayout does not throw when storage.key() throws", () => {
  const s = throwingKeyStorage();
  expect(() =>
    writeSavedLayout("wf1", [img("a")], [{ stepId: "a", position: { x: 0, y: 0 } }], null, s)
  ).not.toThrow();
  // The write itself still succeeded.
  expect(s.getItem(`workflow-canvas:wf1:${layoutHash([img("a")])}`)).not.toBeNull();
});

test("writeSavedLayout does not throw when storage.removeItem() throws", () => {
  const s = throwingRemoveStorage();
  // Seed a stale same-workflow key so pruning attempts a removal.
  s.setItem("workflow-canvas:wf1:oldhash", "{}");
  expect(() =>
    writeSavedLayout("wf1", [img("a")], [{ stepId: "a", position: { x: 0, y: 0 } }], null, s)
  ).not.toThrow();
});
