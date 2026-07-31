/* Copyright 2026 Google LLC
 * Licensed under Apache-2.0
 */
"use client";

import { useEffect, useRef } from "react";

import {
  MediaLightbox,
  type MediaLightboxMedia,
  type MediaVariant,
} from "@/src/components/studio/media-lightbox";
import type { MediaItem } from "./media-card";

export interface LightboxProps {
  media: MediaItem;
  onClose: () => void;
  /** Item-level previous/next (distinct from per-output thumbnails in the stage). */
  onNavigate?: (direction: "previous" | "next") => void;
}

function variantOf(mimeType: string): Exclude<MediaVariant, "comparison"> {
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "image";
}

/**
 * Modal overlay shell for previewing a single gallery item. Delegates the media
 * stage (image / video / audio + output thumbnails + action toolbar) to the
 * shared `studio/MediaLightbox` to avoid a second stage implementation. Owns
 * only the a11y dialog, scrim, close button, Escape/arrow keyboard, and
 * item-level previous/next navigation.
 */
export function Lightbox({ media, onClose, onNavigate }: LightboxProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const mimeType = typeof media.metadata?.mimeType === "string" ? media.metadata.mimeType : "image/*";
  const prompt = typeof media.metadata?.prompt === "string" ? media.metadata.prompt : undefined;
  const urls = media.presignedUrls;
  const stageMedia: MediaLightboxMedia = {
    url: urls[0],
    urls: urls.length > 1 ? urls : undefined,
    prompt,
    mimeType,
    posterUrl: media.presignedThumbnailUrls[0],
  };

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onNavigate?.("previous");
      if (event.key === "ArrowRight") onNavigate?.("next");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNavigate]);

  return (
    <div
      aria-label={`Media ${media.id}`}
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-[var(--tri-dialog-scrim)] p-[var(--tri-space-4)]"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
      role="dialog"
    >
      <div className="relative max-h-full w-full max-w-[var(--tri-layout-wide)] overflow-auto rounded-[var(--tri-radius-lg)] bg-[var(--tri-bg-surface)] p-[var(--tri-space-4)]">
        <button
          aria-label="Close media preview"
          className="absolute right-[var(--tri-space-4)] top-[var(--tri-space-4)] z-10 grid size-[44px] place-items-center rounded-[var(--tri-radius-full)] bg-[var(--tri-bg-surface)] text-[var(--tri-text-primary)]"
          onClick={onClose}
          ref={closeRef}
          type="button"
        >
          ×
        </button>
        {urls[0] ? (
          <MediaLightbox media={stageMedia} variant={variantOf(mimeType)} />
        ) : (
          <p className="text-[var(--tri-text-secondary)]">Media unavailable.</p>
        )}
        {onNavigate ? (
          <div className="mt-[var(--tri-space-4)] flex justify-between">
            <button
              className="min-h-[44px] px-[var(--tri-space-3)] text-[var(--tri-text-primary)]"
              onClick={() => onNavigate("previous")}
              type="button"
            >
              Previous
            </button>
            <button
              className="min-h-[44px] px-[var(--tri-space-3)] text-[var(--tri-text-primary)]"
              onClick={() => onNavigate("next")}
              type="button"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
