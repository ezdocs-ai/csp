/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { VideoGenerationRequest, VideoMode } from "../types";

const STORAGE_KEY = "videoStudioState";
type InitialState = Partial<VideoGenerationRequest> & { generationModel?: string };

const fallbackState: VideoGenerationRequest = {
  workspaceId: 0,
  generationModel: "",
  mode: "text-to-video",
  prompt: "",
};

export function useVideoState(initial: InitialState = {}) {
  const [state, setState] = useState<VideoGenerationRequest>(() => ({
    ...fallbackState,
    workspaceId: initial.workspaceId ?? 0,
    ...initial,
  }));
  const restored = useRef(false);

  useEffect(() => {
    let frame: number | undefined;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const restoredState = saved
        ? { ...fallbackState, ...JSON.parse(saved), ...initial }
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

  // ponytail: drop the persisted model when the backend registry disables it.
  // For now, preserve user choice; capability hook decides whether to render
  // unsupported controls or to remap to defaultModelKey.
  const value = useMemo(() => state, [state]);

  const update = useCallback(
    (change: Partial<VideoGenerationRequest> & { mode?: VideoMode }) => setState((current) => ({ ...current, ...change })),
    [],
  );

  return {
    state: value,
    update,
  };
}
