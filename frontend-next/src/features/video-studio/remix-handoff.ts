/** Copyright 2026 Google LLC — Apache-2.0 */

/**
 * Pure parser + state patch for the cross-feature remix handoff the gallery
 * stages under sessionStorage `"remixState"` before routing to `/video`
 * (writers: `gallery-actions.ts` builders + image-studio `handleGenerateVideo`).
 *
 * The `/video` receiver reads that key ONCE on mount, deferred past hydration
 * (see `video-studio.tsx`). Only the recognized fields below are extracted;
 * every other key is ignored. Explicit template `initialState` props always win
 * — the remix only hydrates gaps (never overwrites an explicit prop).
 *
 * These helpers are pure (no storage access) so they are SSR-safe and unit
 * testable without a DOM.
 */
import type { VideoGenerationRequest, VideoMode } from "./types";

/** sessionStorage key shared by all studios for the remix handoff. */
export const REMIX_STATE_KEY = "remixState";

/** Slot asset binding mirrored from `video-studio.tsx` (local preview state). */
export type SlotAsset = { assetId?: string; previewUrl?: string; name?: string };

type SourceLink = { mediaItemId: number; mediaIndex: number; role: string };
type MediaRef = {
  id: number;
  type: string;
  index: number;
  name: string;
  previewUrl?: string;
};

/** Recognized remixState fields for the `/video` receiver. */
export type VideoRemixIntent = {
  prompt?: string;
  generationModel?: string;
  isOmniMode?: boolean;
  startConcatenation?: boolean;
  parentMediaItemId?: number;
  startImagePreviewUrl?: string;
  endImagePreviewUrl?: string;
  sourceMediaItems: SourceLink[];
  referenceVideo?: MediaRef;
  referenceAudio?: MediaRef;
};

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";

function parseSourceLink(raw: unknown): SourceLink | null {
  if (!isObj(raw)) return null;
  const { mediaItemId, mediaIndex, role } = raw;
  if (!isNum(mediaItemId) || !isNum(mediaIndex) || !isStr(role)) return null;
  return { mediaItemId, mediaIndex, role };
}

function parseMediaRef(raw: unknown): MediaRef | null {
  if (!isObj(raw)) return null;
  const { id, type, index, name, previewUrl } = raw;
  if (!isNum(id) || !isStr(type) || !isNum(index)) return null;
  return {
    id,
    type,
    index,
    name: isStr(name) ? name : "",
    previewUrl: isStr(previewUrl) ? previewUrl : undefined,
  };
}

/**
 * Validate a raw sessionStorage payload and extract ONLY recognized fields.
 * Returns `null` when the shape is not an actionable video handoff (not an
 * object, or carries no media source / omni reference). A prompt without any
 * media source is rejected — every real video handoff pairs a prompt with a
 * `start_frame`/`end_frame`/`video_extension_source`/`concatenation_source`
 * link or an Omni `referenceVideo`/`referenceAudio`.
 */
export function parseVideoRemix(raw: unknown): VideoRemixIntent | null {
  if (!isObj(raw)) return null;

  const sourceMediaItems = Array.isArray(raw.sourceMediaItems)
    ? raw.sourceMediaItems
        .map(parseSourceLink)
        .filter((link): link is SourceLink => link !== null)
    : [];

  const intent: VideoRemixIntent = { sourceMediaItems };
  if (isStr(raw.prompt) && raw.prompt) intent.prompt = raw.prompt;
  if (isStr(raw.generationModel) && raw.generationModel)
    intent.generationModel = raw.generationModel;
  if (raw.isOmniMode === true) intent.isOmniMode = true;
  if (raw.startConcatenation === true) intent.startConcatenation = true;
  if (isNum(raw.parentMediaItemId)) intent.parentMediaItemId = raw.parentMediaItemId;
  if (isStr(raw.startImagePreviewUrl)) intent.startImagePreviewUrl = raw.startImagePreviewUrl;
  if (isStr(raw.endImagePreviewUrl)) intent.endImagePreviewUrl = raw.endImagePreviewUrl;

  const refVideo = parseMediaRef(raw.referenceVideo);
  if (refVideo) intent.referenceVideo = refVideo;
  const refAudio = parseMediaRef(raw.referenceAudio);
  if (refAudio) intent.referenceAudio = refAudio;

  const actionable =
    sourceMediaItems.length > 0 || !!intent.referenceVideo || !!intent.referenceAudio;
  return actionable ? intent : null;
}

export type VideoRemixPatch = {
  statePatch: Partial<VideoGenerationRequest>;
  slots: Record<string, SlotAsset>;
};

/**
 * Project a validated intent onto the video studio's state + slot APIs.
 *
 * Explicit template `initialState` props are never overwritten — each remix
 * field is guarded by `key in initialState`. Slot bindings (local preview
 * state, never part of `initialState`) always hydrate. Pure + deterministic.
 *
 * Role → slot mapping mirrors `mode-slots.ts` + the in-studio toolbar handlers
 * (`handleExtendWithAi`/`handleEditWithOmni`/`handleConcatenate`):
 *   start_frame            → frames-to-video, `start`
 *   end_frame              → frames-to-video, `end`
 *   video_extension_source → extend-video, `source`
 *   concatenation_source   → concatenate-video, `first`
 *   Omni referenceVideo    → ingredients-to-video, `ref-video`
 *   Omni referenceAudio    → ingredients-to-video, `ref-audio`
 */
export function videoRemixPatch(
  intent: VideoRemixIntent,
  initialState: Partial<VideoGenerationRequest>,
): VideoRemixPatch {
  const statePatch: Partial<VideoGenerationRequest> = {};
  const slots: Record<string, SlotAsset> = {};
  const guarded = (key: keyof VideoGenerationRequest): boolean => key in initialState;
  const setMode = (mode: VideoMode): void => {
    if (!guarded("mode")) statePatch.mode = mode;
  };

  if (!guarded("prompt") && intent.prompt) statePatch.prompt = intent.prompt;
  if (!guarded("generationModel") && intent.generationModel)
    statePatch.generationModel = intent.generationModel;

  if (intent.isOmniMode || intent.referenceVideo || intent.referenceAudio) {
    setMode("ingredients-to-video");
    if (intent.parentMediaItemId != null && !guarded("parentMediaItemId"))
      statePatch.parentMediaItemId = String(intent.parentMediaItemId);
    if (intent.referenceVideo)
      slots["ref-video"] = {
        assetId: String(intent.referenceVideo.id),
        previewUrl: intent.referenceVideo.previewUrl,
        name: intent.referenceVideo.name,
      };
    if (intent.referenceAudio)
      slots["ref-audio"] = {
        assetId: String(intent.referenceAudio.id),
        name: intent.referenceAudio.name,
      };
  } else {
    const source = intent.sourceMediaItems[0];
    if (!source) return { statePatch, slots };
    const assetId = String(source.mediaItemId);
    switch (source.role) {
      case "start_frame":
        setMode("frames-to-video");
        slots["start"] = { assetId, previewUrl: intent.startImagePreviewUrl };
        break;
      case "end_frame":
        setMode("frames-to-video");
        slots["end"] = { assetId, previewUrl: intent.endImagePreviewUrl };
        break;
      case "video_extension_source":
        setMode("extend-video");
        slots["source"] = { assetId, previewUrl: intent.startImagePreviewUrl };
        break;
      case "concatenation_source":
        setMode("concatenate-video");
        slots["first"] = { assetId, previewUrl: intent.startImagePreviewUrl };
        break;
      default:
        break; // unrecognized role (e.g. image-only `input`) — no video slot
    }
  }

  return { statePatch, slots };
}
