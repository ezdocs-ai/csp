/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useCallback, useEffect, useState } from "react";

import type { AiModel, AiModelInput } from "../ai-providers-types";

async function getCsrf(): Promise<string> {
  const csrf = await fetch("/api/auth/csrf").then((response) => response.json() as Promise<{ csrfToken: string }>);
  return csrf.csrfToken;
}

export function useAiModels(providerId?: number, initial: AiModel[] = []) {
  const [models, setModels] = useState<AiModel[]>(initial);
  const [loading, setLoading] = useState(initial.length === 0);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = providerId ? `/api/admin/ai-models?providerId=${encodeURIComponent(providerId)}` : "/api/admin/ai-models";
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`Model list failed (${response.status})`);
      setModels((await response.json()) as AiModel[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Model list failed");
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); });
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const create = useCallback(async (input: AiModelInput) => {
    const response = await fetch("/api/admin/ai-models", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": await getCsrf() },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error(`Model create failed (${response.status})`);
    return (await response.json()) as AiModel;
  }, []);

  const update = useCallback(async (id: number, input: AiModelInput) => {
    const response = await fetch(`/api/admin/ai-models/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-csrf-token": await getCsrf() },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error(`Model update failed (${response.status})`);
    return (await response.json()) as AiModel;
  }, []);

  const remove = useCallback(async (id: number) => {
    const response = await fetch(`/api/admin/ai-models/${id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": await getCsrf() },
    });
    if (!response.ok && response.status !== 204) throw new Error(`Model delete failed (${response.status})`);
  }, []);

  return { models, loading, error, refresh, create, update, remove };
}
