/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useCallback, useEffect, useState } from "react";

import type { SourceAsset, SourceAssetPage } from "../types";

function csrfToken() { return document.cookie.split("; ").find((item) => item.startsWith("csp_csrf="))?.split("=").slice(1).join("=") ?? ""; }
function asAssets(data: SourceAssetPage | SourceAsset[]) { return Array.isArray(data) ? data : data.data ?? []; }

export function useSourceAssets(type?: SourceAsset["type"]) {
  const [assets, setAssets] = useState<SourceAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const refresh = useCallback(async () => { setLoading(true); setError(null); try { const response = await fetch(`/api/source-assets${type ? `?type=${type}` : ""}`); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Failed to load source assets"); setAssets(asAssets(data)); } catch (cause) { setError(cause instanceof Error ? cause : new Error("Failed to load source assets")); } finally { setLoading(false); } }, [type]);
  useEffect(() => { const timer = window.setTimeout(() => { void refresh(); }); return () => window.clearTimeout(timer); }, [refresh]);
  const upload = useCallback(async (file: File, workspaceId: number, fields: Record<string, string> = {}) => { const body = new FormData(); body.set("file", file); body.set("workspaceId", String(workspaceId)); Object.entries(fields).forEach(([key, value]) => body.set(key, value)); const response = await fetch("/api/source-assets", { method: "POST", headers: { "x-csrf-token": csrfToken() }, body }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Failed to upload source asset"); await refresh(); return data as SourceAsset; }, [refresh]);
  const remove = useCallback(async (id: string) => { const response = await fetch(`/api/source-assets/${encodeURIComponent(id)}`, { method: "DELETE", headers: { "x-csrf-token": csrfToken() } }); if (!response.ok) { const data = await response.json(); throw new Error(data.error ?? "Failed to delete source asset"); } setAssets((current) => current.filter((asset) => asset.id !== id)); }, []);
  return { assets, loading, error, upload, remove, refresh };
}
