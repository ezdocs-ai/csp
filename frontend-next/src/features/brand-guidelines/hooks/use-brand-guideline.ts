/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useCallback, useEffect, useState } from "react";

// Mirrors `BrandGuidelineResponseDto` (camelCase via backend `to_camel` alias).
export type BrandGuideline = {
  id?: string | number | null;
  name?: string;
  status?: string;
  errorMessage?: string | null;
  toneOfVoiceSummary?: string | null;
  visualStyleSummary?: string | null;
  guidelineText?: string | null;
  colorPalette?: string[];
  sourcePdfGcsUris?: string[];
  presignedSourcePdfUrls?: string[];
  workspaceId?: string | number | null;
};

export function useBrandGuideline(id: string | number | null) {
  const [guideline, setGuideline] = useState<BrandGuideline | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState<string | null>(null);
  const status = guideline?.status ?? (id ? "processing" : "idle");
  const terminal = status === "completed" || status === "failed" || status === "stopped";

  const poll = useCallback(async () => {
    if (!id || document.hidden) return;
    try {
      const response = await fetch(`/api/brand-guidelines/${encodeURIComponent(String(id))}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to load brand guideline");
      setGuideline(data); setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to load brand guideline"); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const initial = window.setTimeout(() => { void poll(); }, 0);
    const visible = () => { if (!document.hidden) void poll(); };
    document.addEventListener("visibilitychange", visible);
    const interval = window.setInterval(() => { if (!terminal) void poll(); }, 5000);
    return () => { document.removeEventListener("visibilitychange", visible); window.clearTimeout(initial); window.clearInterval(interval); };
  }, [id, poll, terminal]);

  return { guideline, status, loading, error };
}
