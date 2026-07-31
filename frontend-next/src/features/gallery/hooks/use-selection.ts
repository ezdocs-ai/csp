/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";
import { useCallback, useMemo, useState } from "react";

export function useSelection<T extends { id: string }>() {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const toggle = useCallback((id: string) => setIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);
  const selectAll = useCallback((items: T[]) => setIds(new Set(items.map((i) => i.id))), []);
  const clear = useCallback(() => setIds(new Set()), []);
  const isSelected = useCallback((id: string) => ids.has(id), [ids]);
  return { ids: useMemo(() => Array.from(ids), [ids]), count: ids.size, toggle, selectAll, clear, isSelected };
}
