/* Copyright 2026 Google LLC
 * Licensed under Apache-2.0 */

/**
 * Gallery-detail action intents — pure ports of Angular
 * `MediaDetailComponent.{generateWithThisImage,generateVideoWithImage,
 * handleEditWithOmni,sendToVto,handleExtendWithAi,handleConcatenate}`
 * (frontend/src/app/gallery/media-detail/media-detail.component.ts L312-478).
 *
 * Angular carried each intent via Angular router `state: { remixState }`.
 * Next App Router has no router-state, so the established migration contract
 * (see mem:migration_nextjs/parity_impl/wave3_image + the image-studio
 * `handleGenerateVideo`/`handleSendToVto` writers) is to stage the SAME
 * `remixState` shape under sessionStorage key `"remixState"` before navigating
 * to the target studio route. The `/video` and `/vto` receivers read that key
 * on mount (owned by those feature agents).
 *
 * Gallery detail renders a single media item, so every builder uses media
 * index 0 (matches the existing detail page + the wave3_image `activeIndex`
 * ponytail). The detail media is always a `media_item`, so `itemType`
 * defaults to `"media_item"` (Angular did `this.mediaItem.itemType ||
 * 'media_item'`; `MediaItemResponse` carries no itemType field).
 */
import type { MediaDetail } from "./types";

/** sessionStorage key shared by all studios for cross-feature remix handoff. */
export const REMIX_STATE_KEY = "remixState";

export type MediaKind = "image" | "video" | "audio";

export interface RemixIntent {
  /** Target studio route to navigate to. */
  route: string;
  /** Payload staged under sessionStorage `"remixState"`. */
  remixState: Record<string, unknown>;
}

export function mediaKind(mimeType: string | undefined | null): MediaKind | null {
  if (!mimeType) return null;
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return null;
}

export function isImageMedia(mimeType: string | undefined | null): boolean {
  return mediaKind(mimeType) === "image";
}

export function isVideoMedia(mimeType: string | undefined | null): boolean {
  return mediaKind(mimeType) === "video";
}

export function isAudioMedia(mimeType: string | undefined | null): boolean {
  return mediaKind(mimeType) === "audio";
}

type SourceMediaItemLink = {
  mediaItemId: number;
  mediaIndex: number;
  role: string;
};

function sourceLink(media: MediaDetail, role: string): SourceMediaItemLink {
  return { mediaItemId: media.id ?? 0, mediaIndex: 0, role };
}

function primaryUrl(media: MediaDetail): string | undefined {
  return media.presignedUrls?.[0];
}

function primaryThumb(media: MediaDetail): string | undefined {
  return media.presignedThumbnailUrls?.[0] ?? media.presignedUrls?.[0];
}

function primaryGcs(media: MediaDetail): string | undefined {
  return media.gcsUris?.[0];
}

/**
 * Image edit/remix → image studio. The image studio (`(studio)/page.tsx`) is
 * the one studio that consumes router URL params, so the prompt is carried in
 * the query (real prefill) while the reference-image handoff is staged in
 * sessionStorage for the receiver (pending read side).
 */
export function buildImageRemix(media: MediaDetail): RemixIntent {
  const prompt = media.prompt ?? "";
  const route = prompt ? `/?prompt=${encodeURIComponent(prompt)}` : "/";
  return {
    route,
    remixState: {
      sourceMediaItems: [sourceLink(media, "input")],
      prompt,
      previewUrl: primaryUrl(media),
    },
  };
}

/** Image → video studio as the start frame. */
export function buildVideoStart(media: MediaDetail): RemixIntent {
  return {
    route: "/video",
    remixState: {
      prompt: media.prompt,
      sourceMediaItems: [sourceLink(media, "start_frame")],
      startImagePreviewUrl: primaryUrl(media),
      endImagePreviewUrl: undefined,
    },
  };
}

/** Image → video studio as the end frame. */
export function buildVideoEnd(media: MediaDetail): RemixIntent {
  return {
    route: "/video",
    remixState: {
      prompt: media.prompt,
      sourceMediaItems: [sourceLink(media, "end_frame")],
      startImagePreviewUrl: undefined,
      endImagePreviewUrl: primaryUrl(media),
    },
  };
}

/** Image → VTO studio as the model image. */
export function buildSendToVto(media: MediaDetail): RemixIntent {
  return {
    route: "/vto",
    remixState: {
      modelImageAssetId: media.id,
      modelImagePreviewUrl: primaryUrl(media),
      modelImageMediaIndex: 0,
      modelImageGcsUri: primaryGcs(media),
    },
  };
}

/**
 * Video/audio → video studio in Omni edit mode. Angular's toolbar only offers
 * this for video, but the handler branches on audio (referenceAudio) vs
 * everything else (referenceVideo); both branches are ported verbatim.
 */
export function buildEditWithOmni(media: MediaDetail): RemixIntent {
  const index = 0;
  const remixState: Record<string, unknown> = {
    parentMediaItemId: media.id,
    parentMediaIndex: index,
    generationModel: "gemini-omni",
    isOmniMode: true,
  };
  if (isAudioMedia(media.mimeType)) {
    remixState.referenceAudio = {
      id: media.id,
      type: "media_item",
      index,
      name: media.originalPrompt || `Audio Input ${media.id ?? ""}`,
    };
  } else {
    remixState.referenceVideo = {
      id: media.id,
      type: "media_item",
      index,
      name: media.originalPrompt || `Video Input ${media.id ?? ""}`,
      previewUrl: primaryThumb(media) || "",
    };
  }
  return { route: "/video", remixState };
}

/** Video → video studio to extend (switches to Veo 3.1 for video input). */
export function buildExtendWithAi(media: MediaDetail): RemixIntent {
  return {
    route: "/video",
    remixState: {
      prompt: media.prompt,
      sourceMediaItems: [sourceLink(media, "video_extension_source")],
      startImagePreviewUrl: primaryThumb(media),
      generationModel: "veo-3.1-generate-001",
    },
  };
}

/** Video → video studio to start a concatenation. */
export function buildConcatenate(media: MediaDetail): RemixIntent {
  return {
    route: "/video",
    remixState: {
      sourceMediaItems: [sourceLink(media, "concatenation_source")],
      startImagePreviewUrl: primaryThumb(media),
      startConcatenation: true,
    },
  };
}

/**
 * Stage a remix intent's payload in sessionStorage then return its route for
 * the caller to push. Thin side-effecting wrapper (mirrors image-studio
 * `handleGenerateVideo`); the pure builders above are the tested surface.
 * No-op when sessionStorage is blocked (private mode / disabled).
 */
export function stageRemix(intent: RemixIntent): string {
  try {
    sessionStorage.setItem(REMIX_STATE_KEY, JSON.stringify(intent.remixState));
  } catch {
    /* storage blocked */
  }
  return intent.route;
}
