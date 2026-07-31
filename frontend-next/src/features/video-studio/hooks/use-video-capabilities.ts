/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useEffect, useState } from "react";

import {
  FALLBACK_ASPECT_RATIOS,
  FALLBACK_DURATIONS,
  FALLBACK_RESOLUTIONS,
  type VideoCapabilities,
  type VideoGenerationOptions,
  type VideoModelOption,
} from "../types";

type State = {
  loading: boolean;
  error: string | null;
  options: VideoGenerationOptions | null;
};

/**
 * Fetches the public video capability registry once per session.
 * Browser never holds a bearer token; the BFF proxy forwards the server session.
 */
export function useVideoCapabilities() {
  const [state, setState] = useState<State>({ loading: true, error: null, options: null });

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setState({ loading: true, error: null, options: null });
      fetch("/api/options/video-generation", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Capability fetch failed (${response.status})`);
        return (await response.json()) as VideoGenerationOptions;
      })
      .then((options) => {
        if (cancelled) return;
        setState({ loading: false, error: null, options });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setState({ loading: false, error: cause instanceof Error ? cause.message : "Capability fetch failed", options: null });
      });
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  return state;
}

export function pickModel(options: VideoGenerationOptions | null, requestedKey?: string): VideoModelOption | null {
  if (!options?.models?.length) return null;
  const byKey = requestedKey ? options.models.find((model) => model.modelKey === requestedKey) : null;
  if (byKey) return byKey;
  if (options.defaultModelKey) {
    const byDefault = options.models.find((model) => model.modelKey === options.defaultModelKey);
    if (byDefault) return byDefault;
  }
  return options.models[0] ?? null;
}

export function safeResolutions(capabilities: VideoCapabilities | undefined | null): string[] {
  const list = capabilities?.resolutions;
  return Array.isArray(list) && list.length ? list : FALLBACK_RESOLUTIONS;
}

export function safeDurations(capabilities: VideoCapabilities | undefined | null): number[] {
  const list = capabilities?.durations;
  return Array.isArray(list) && list.length ? list : FALLBACK_DURATIONS;
}

export function safeAspectRatios(capabilities: VideoCapabilities | undefined | null): string[] {
  const list = capabilities?.aspectRatios;
  return Array.isArray(list) && list.length ? list : FALLBACK_ASPECT_RATIOS;
}

export function safeMaxOutputs(capabilities: VideoCapabilities | undefined | null): number {
  return Number.isFinite(capabilities?.maxOutputs) && (capabilities?.maxOutputs ?? 0) > 0 ? capabilities?.maxOutputs ?? 1 : 1;
}
