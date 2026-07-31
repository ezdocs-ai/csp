/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { defaultImageState, type ImageGenerationRequest } from "../types";

const STORAGE_KEY = "imageStudioState";
type InitialState = Partial<ImageGenerationRequest>;

export function useImageState(initial: InitialState = {}) {
  const [state, setState] = useState<ImageGenerationRequest>(() => ({
    ...defaultImageState,
    workspaceId: initial.workspaceId ?? 0,
    ...initial,
  }));
  const restored = useRef(false);

  useEffect(() => {
    let frame: number | undefined;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const restoredState = saved
        ? { ...defaultImageState, ...JSON.parse(saved), ...initial }
        : null;
      frame = requestAnimationFrame(() => {
        restored.current = true;
        if (restoredState) setState(restoredState);
      });
    } catch {
      restored.current = true;
    }
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
    // Browser-only state is intentionally restored once after hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage blocked
    }
  }, [state]);
  const update = useCallback((change: Partial<ImageGenerationRequest>) => {
    setState((current) => ({ ...current, ...change }));
  }, []);
  return { state, update };
}
