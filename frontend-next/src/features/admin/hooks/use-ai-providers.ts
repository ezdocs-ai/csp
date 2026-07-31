/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useCallback, useEffect, useState } from "react";

import type { AiProvider, AiProviderInput, ProviderTestResult } from "../ai-providers-types";

async function getCsrf(): Promise<string> {
  const csrf = await fetch("/api/auth/csrf").then((response) => response.json() as Promise<{ csrfToken: string }>);
  return csrf.csrfToken;
}

export function useAiProviders(initial: AiProvider[] = []) {
  const [providers, setProviders] = useState<AiProvider[]>(initial);
  const [loading, setLoading] = useState(initial.length === 0);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/ai-providers", { cache: "no-store" });
      if (!response.ok) throw new Error(`Provider list failed (${response.status})`);
      setProviders((await response.json()) as AiProvider[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Provider list failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); });
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const create = useCallback(async (input: AiProviderInput) => {
    const response = await fetch("/api/admin/ai-providers", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": await getCsrf() },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error(`Provider create failed (${response.status})`);
    return (await response.json()) as AiProvider;
  }, []);

  const update = useCallback(async (id: number, input: AiProviderInput) => {
    const response = await fetch(`/api/admin/ai-providers/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-csrf-token": await getCsrf() },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error(`Provider update failed (${response.status})`);
    return (await response.json()) as AiProvider;
  }, []);

  const remove = useCallback(async (id: number) => {
    const response = await fetch(`/api/admin/ai-providers/${id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": await getCsrf() },
    });
    if (!response.ok && response.status !== 204) throw new Error(`Provider delete failed (${response.status})`);
  }, []);

  const test = useCallback(async (id: number) => {
    const response = await fetch(`/api/admin/ai-providers/${id}/test`, {
      method: "POST",
      headers: { "x-csrf-token": await getCsrf() },
    });
    if (!response.ok) throw new Error(`Provider test failed (${response.status})`);
    return (await response.json()) as ProviderTestResult;
  }, []);

  return { providers, loading, error, refresh, create, update, remove, test };
}
