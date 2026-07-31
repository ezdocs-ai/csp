/* Copyright 2026 Google LLC
 * Licensed under Apache-2.0
 */
"use client";

import Link from "next/link";
import { useState } from "react";
import type { MouseEvent } from "react";

import type { components } from "@/src/lib/api/types";

export type MediaItem = components["schemas"]["UnifiedGalleryItemResponse"];
type TagModel = components["schemas"]["TagModel"];

export interface MediaCardProps {
  media: MediaItem;
  href?: string;
  /** Receives the event so the gallery can read shiftKey/metaKey for range selection. */
  onSelect?: (media: MediaItem, event: MouseEvent<HTMLButtonElement>) => void;
  selected?: boolean;
  /** True while a gallery selection is active, so the card shows its selection affordance. */
  anySelected?: boolean;
}

function metaString(media: MediaItem, key: string): string {
  const value = media.metadata?.[key];
  return typeof value === "string" ? value : "";
}

/** Mirrors Angular GalleryCardComponent.getShortPrompt (parses JSON prompt_name). */
function shortPrompt(prompt: string): string {
  if (!prompt) return "Generated media";
  let text = prompt;
  try {
    const parsed = JSON.parse(prompt);
    if (parsed && typeof parsed === "object" && parsed.prompt_name) {
      text = String(parsed.prompt_name);
    }
  } catch {
    /* not JSON — use raw prompt */
  }
  const words = text.split(/\s+/);
  return words.length > 20 ? `${words.slice(0, 20).join(" ")}...` : text;
}

const GAP = 16;

/** Mirrors Angular GalleryCardComponent.displayPaddingBottom (aspect-driven spacer). */
function spacerPadding(aspectRatio: string, mimeType: string): string {
  if (aspectRatio) {
    const parts = aspectRatio.split(":").map(Number);
    const valid =
      parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1]) && parts[1] !== 0;
    if (valid) {
      const ratio = parts[0] / parts[1];
      if (ratio >= 2) return `calc(50% - ${GAP / 2}px)`; // 2:1 wide
      if (ratio <= 0.5) return `calc(200% + ${GAP}px)`; // 1:2 tall
      return "100%"; // 1:1
    }
  }
  if (mimeType.startsWith("audio/")) return `calc(50% - ${GAP / 2}px)`; // audio 2:1
  return "100%"; // 1:1 default
}

/** Mirrors Angular displayedTags/hiddenTagsCount (~20-char budget, "+N more"). */
function budgetTags(tags: TagModel[], maxChars = 20): { shown: TagModel[]; hidden: number } {
  const shown: TagModel[] = [];
  let total = 0;
  for (const tag of tags) {
    if (total + tag.name.length <= maxChars || shown.length === 0) {
      shown.push(tag);
      total += tag.name.length + 3;
    } else {
      break;
    }
  }
  return { shown, hidden: Math.max(0, tags.length - shown.length) };
}

const SCRIM_MASK = "linear-gradient(to bottom, transparent, black 85%)";

export function MediaCard({ anySelected = false, href, media, onSelect, selected = false }: MediaCardProps) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);

  const mimeType = metaString(media, "mimeType");
  const aspectRatio = metaString(media, "aspectRatio");
  const alt = shortPrompt(metaString(media, "prompt"));
  const isVideo = mimeType.startsWith("video/");
  const isAudio = mimeType.startsWith("audio/");
  const thumbs = media.presignedThumbnailUrls.length ? media.presignedThumbnailUrls : media.presignedUrls;
  const urls = thumbs.slice();
  const videoUrl = media.presignedUrls[index] ?? media.presignedUrls[0];
  const multi = urls.length > 1;
  const pad = spacerPadding(aspectRatio, mimeType);
  const tags = media.tags ?? [];
  const { shown, hidden } = budgetTags(tags);

  const onIndicator = onSelect
    ? (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        onSelect(media, event);
      }
    : undefined;

  const cycle = (event: MouseEvent<HTMLButtonElement>, delta: number) => {
    event.preventDefault();
    event.stopPropagation();
    setIndex((i) => (i + delta + urls.length) % urls.length);
  };

  const stage = (
    <>
      {isAudio ? (
        <div className="absolute inset-0 grid place-items-center bg-[#2a2a2e] transition-colors group-hover:bg-[#38383e]">
          <span aria-hidden className="size-20 text-white/40 group-hover:animate-pulse group-hover:text-[#a0c4ff]">
            <EqualizerIcon />
          </span>
        </div>
      ) : isVideo && hovered && videoUrl ? (
        <video
          aria-label={alt}
          autoPlay
          className="absolute inset-0 size-full object-cover"
          loop
          muted
          playsInline
          src={videoUrl}
        />
      ) : (
        urls.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={alt}
            className={`absolute inset-0 size-full object-cover transition-opacity duration-500 ${
              i === index ? "opacity-100 group-hover:opacity-80" : "pointer-events-none opacity-0"
            }`}
            key={url}
            loading="lazy"
            src={url}
          />
        ))
      )}

      {isVideo && !(hovered && videoUrl) ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 grid place-items-center bg-black/20 opacity-50 transition-opacity duration-300 group-hover:opacity-0"
        >
          <span className="size-16 text-white">
            <PlayIcon />
          </span>
        </div>
      ) : null}

      {/* Spacer defines the card aspect ratio (Angular `.spacer`). */}
      <div style={{ paddingBottom: pad }} />

      {/* Bottom gradient scrim + item-type icon (Angular gallery-item-overlay). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 flex h-20 items-end justify-between bg-black/50 p-3 backdrop-blur-md"
        style={{ maskImage: SCRIM_MASK, WebkitMaskImage: SCRIM_MASK }}
      >
        <span className="size-4 text-white/90">
          {media.itemType === "source_asset" ? <CloudUploadIcon /> : <SparkIcon />}
        </span>
      </div>

      {/* Tag chips (Angular `.tags-section`); plain glass — Angular colored layer is disabled. */}
      {tags.length > 0 ? (
        <div className="pointer-events-none absolute bottom-7 left-1/2 z-20 flex max-w-[90%] -translate-x-1/2 items-center gap-1">
          {shown.map((tag) => (
            <span
              className="rounded-full bg-white/5 px-1 py-0.5 text-[10px] font-medium text-white shadow-sm backdrop-blur-md"
              key={tag.id ?? tag.name}
            >
              {tag.name}
            </span>
          ))}
          {hidden > 0 ? (
            <span className="rounded-full bg-neutral-800 px-1 py-0.5 text-[10px] font-medium text-white">
              +{hidden} more
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );

  const linkClass =
    "relative block min-h-[44px] w-full transition-transform duration-300 focus-visible:outline-none";
  const rootClass = `group relative overflow-hidden rounded-[var(--tri-card-radius)] transition-all duration-300 ${
    selected
      ? "bg-[var(--tri-bg-surface-alt)] shadow-[0_0_15px_rgba(66,133,244,0.3)]"
      : "shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1)] hover:shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1)]"
  }`;

  const indicatorVisibility = selected
    ? "opacity-100"
    : anySelected
      ? "opacity-60 group-hover:opacity-100"
      : "opacity-0 group-hover:opacity-100";

  return (
    <div className={rootClass} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {href ? (
        <Link aria-label={`Open ${alt}`} className={linkClass} href={href}>
          {stage}
        </Link>
      ) : onSelect ? (
        <button
          aria-pressed={selected}
          className={linkClass}
          onClick={(event) => onSelect(media, event)}
          type="button"
        >
          {stage}
        </button>
      ) : (
        <div className={linkClass}>{stage}</div>
      )}

      {onSelect ? (
        <button
          aria-label={selected ? `Deselect ${alt}` : `Select ${alt}`}
          aria-pressed={selected}
          className="absolute left-3 top-3 z-30 grid min-h-[44px] min-w-[44px] place-items-center focus-visible:outline-none"
          onClick={onIndicator}
          type="button"
        >
          <span
            className={`grid size-7 place-items-center rounded-full border backdrop-blur transition ${indicatorVisibility} ${
              selected
                ? "border-white/40 text-white shadow-[0_0_10px_rgba(66,133,244,0.5)]"
                : "border-white/20 bg-white/10 text-white group-hover:bg-white/20"
            }`}
            style={
              selected
                ? { background: "linear-gradient(135deg, var(--tri-brand-primary), var(--tri-accent-success, #34a853))" }
                : undefined
            }
          >
            {selected ? <CheckIcon /> : null}
          </span>
        </button>
      ) : null}

      {multi ? (
        <>
          <button
            aria-label="Previous image"
            className="absolute left-2 top-1/2 z-30 grid min-h-[44px] min-w-[44px] -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white opacity-0 transition hover:bg-black/70 focus-visible:opacity-100 group-hover:opacity-100"
            onClick={(event) => cycle(event, -1)}
            type="button"
          >
            <ChevronLeftIcon />
          </button>
          <button
            aria-label="Next image"
            className="absolute right-2 top-1/2 z-30 grid min-h-[44px] min-w-[44px] -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white opacity-0 transition hover:bg-black/70 focus-visible:opacity-100 group-hover:opacity-100"
            onClick={(event) => cycle(event, 1)}
            type="button"
          >
            <ChevronRightIcon />
          </button>
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 gap-1.5 opacity-0 transition group-hover:opacity-100"
          >
            {urls.map((url, i) => (
              <span
                className={`block size-2 rounded-full transition-colors ${
                  i === index ? "bg-white" : "bg-gray-400"
                }`}
                key={url}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/* Inline SVGs — Lucide-style. Color/size come from the parent span. */
function PlayIcon() {
  return (
    <svg className="size-full" fill="currentColor" viewBox="0 0 20 20">
      <path
        clipRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
        fillRule="evenodd"
      />
    </svg>
  );
}

function EqualizerIcon() {
  return (
    <svg className="size-full" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={2.5} viewBox="0 0 24 24">
      <path d="M5 14v4M5 6v2M12 10v8M12 6v0M19 16v2M19 6v6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="size-3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} viewBox="0 0 24 24">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg className="size-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="size-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function CloudUploadIcon() {
  return (
    <svg className="size-full" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.34 9 4 4 0 0 0 6 17h2" />
      <path d="M12 12v8M9 15l3-3 3 3" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg className="size-full" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2c.3 3.8 2.2 5.7 6 6-3.8.3-5.7 2.2-6 6-.3-3.8-2.2-5.7-6-6 3.8-.3 5.7-2.2 6-6z" />
    </svg>
  );
}
