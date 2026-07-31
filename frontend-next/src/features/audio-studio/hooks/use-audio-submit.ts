/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useCallback, useState } from "react";

import type { AudioGenerationRequest, AudioGenerationResponse } from "../types";

async function csrfFetch(path: string, init: RequestInit = {}) {
  const csrf = await fetch("/api/auth/csrf").then((r) => r.json());
  return fetch(path, {
    ...init,
    headers: { ...init.headers, "Content-Type": "application/json", "x-csrf-token": csrf.csrfToken },
  });
}

export function useAudioSubmit() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (req: AudioGenerationRequest): Promise<AudioGenerationResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await csrfFetch("/api/audio", { method: "POST", body: JSON.stringify(req) });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as AudioGenerationResponse;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audio generation failed");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { submit, loading, error };
}
