"use client";

/** Copyright 2026 Google LLC — Apache-2.0 */

import { useCallback, useState } from "react";
import type { UpscaleRequest, UpscaleResponse } from "../types";

async function csrfFetch(path: string, init: RequestInit = {}) {
  const csrf = await fetch("/api/auth/csrf").then((r) => r.json());
  return fetch(path, {
    ...init,
    headers: { ...init.headers, "Content-Type": "application/json", "x-csrf-token": csrf.csrfToken },
  });
}

export function useUpscale() {
  const [mediaItemId, setMediaItemId] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const submit = useCallback(async (request: UpscaleRequest) => {
    setIsSubmitting(true);
    setError(undefined);
    try {
      const response = await csrfFetch("/api/upscale", {
        body: JSON.stringify(request),
        method: "POST",
      });
      if (!response.ok) throw new Error("Upscale request failed");
      const result = (await response.json()) as UpscaleResponse;
      setMediaItemId(result.mediaItemId);
      return result;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Upscale request failed";
      setError(message);
      throw cause;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { error, isSubmitting, mediaItemId, submit };
}
