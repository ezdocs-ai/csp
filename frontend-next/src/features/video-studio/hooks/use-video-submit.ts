/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useCallback, useState } from "react";

import type { VideoGenerationRequest, VideoGenerationResponse } from "../types";

async function csrfFetch(path: string, init: RequestInit = {}) {
  const csrf = await fetch("/api/auth/csrf").then((response) => response.json());
  return fetch(path, {
    ...init,
    headers: { ...init.headers, "Content-Type": "application/json", "x-csrf-token": csrf.csrfToken },
  });
}

/** Maps capability-driven UI state into the backend `CreateVeoDto` wire shape. */
function toBackendPayload(request: VideoGenerationRequest) {
  const startFrame = request.firstFrameAssetId ? { id: Number(request.firstFrameAssetId), type: "source_asset" } : null;
  const endFrame = request.lastFrameAssetId ? { id: Number(request.lastFrameAssetId), type: "source_asset" } : null;
  const referenceImages = request.referenceAssetIds?.length
    ? request.referenceAssetIds.map((id) => ({ assetId: Number(id), referenceType: "ASSET" as const }))
    : null;
  return {
    prompt: request.prompt,
    workspaceId: request.workspaceId,
    generationModel: request.generationModel,
    aspectRatio: request.aspectRatio,
    resolution: request.resolution,
    durationSeconds: request.durationSeconds,
    numberOfMedia: request.outputCount,
    generateAudio: request.generateAudio ?? false,
    negativePrompt: request.negativePrompt ?? "",
    startImageAssetId: startFrame,
    endImageAssetId: endFrame,
    referenceImages,
  };
}

export function useVideoSubmit() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (request: VideoGenerationRequest): Promise<VideoGenerationResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await csrfFetch("/api/video", { method: "POST", body: JSON.stringify(toBackendPayload(request)) });
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as VideoGenerationResponse;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Video generation failed");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { submit, loading, error };
}
