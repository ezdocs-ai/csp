/* Copyright 2026 Google LLC
 * Licensed under Apache-2.0
 */
"use client";

import { useEffect, useRef } from "react";

export interface InfiniteLoaderProps { onLoadMore: () => void; hasMore: boolean; loading: boolean; }

export function InfiniteLoader({ hasMore, loading, onLoadMore }: InfiniteLoaderProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const target = ref.current; if (!target || !hasMore || loading) return; const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) onLoadMore(); }); observer.observe(target); return () => observer.disconnect(); }, [hasMore, loading, onLoadMore]);
  return <div aria-live="polite" className="min-h-[44px] text-center text-[var(--tri-text-secondary)]" ref={ref}>{loading ? "Loading media…" : hasMore ? "More media available" : "End of gallery"}</div>;
}
