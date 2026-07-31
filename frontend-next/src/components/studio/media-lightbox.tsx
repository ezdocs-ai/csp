/* Copyright 2026 Google LLC
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Menu, MenuItem, Tooltip } from "@/src/components/ui";

export type MediaVariant = "image" | "video" | "audio" | "comparison";

export interface MediaLightboxMedia {
  /** Active media url (image/video/audio). */
  url?: string;
  /** All outputs; when >1 a thumbnail strip is rendered. */
  urls?: string[];
  prompt?: string;
  mimeType?: string;
  posterUrl?: string;
}

export interface MediaLightboxActions {
  edit?: () => void;
  /** Image→Video. Opens a start/end submenu (Angular "Use as Start/End Image"). */
  generateVideo?: (position: "start" | "end") => void;
  sendToVto?: () => void;
  editWithOmni?: () => void;
  extendWithAi?: () => void;
  concatenate?: () => void;
  delete?: () => void;
  seeMoreInfo?: () => void;
  share?: () => void;
  download?: () => void;
  assignTags?: () => void;
}

export interface MediaLightboxProps {
  variant: MediaVariant;
  media: MediaLightboxMedia | null;
  /** Comparison variant: before (bottom) and after (top, clipped) images. */
  beforeUrl?: string;
  afterUrl?: string;
  actions?: MediaLightboxActions;
}

/**
 * Clip the AFTER (top) image so the handle at `percent` reveals AFTER on the right
 * and BEFORE (bottom) on the left. Clamps to [0,100].
 */
export function clipInset(percent: number): string {
  const clamped = Math.round(Math.max(0, Math.min(100, percent)));
  return `inset(0 0 0 ${clamped}%)`;
}

export function MediaLightbox({ actions, afterUrl, beforeUrl, media, variant }: MediaLightboxProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  if (variant === "comparison") {
    return (
      <div className="flex w-full flex-col gap-3">
        <ComparisonView afterUrl={afterUrl} beforeUrl={beforeUrl} />
        {actions ? <ActionsToolbar actions={actions} variant={variant} /> : null}
      </div>
    );
  }

  const urls = media?.urls?.length ? media.urls : media?.url ? [media.url] : [];
  const activeUrl = urls[selectedIndex] ?? media?.url;
  if (!activeUrl) return null;

  return (
    <div className="flex w-full flex-col gap-3">
      <MediaStage
        alt={media?.prompt ?? "Generated media"}
        mimeType={media?.mimeType}
        posterUrl={media?.posterUrl}
        url={activeUrl}
        variant={variant}
      />
      {urls.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {urls.map((url, index) => (
            <button
              aria-label={`View output ${index + 1}`}
              className={`overflow-hidden rounded-md border-2 transition-colors ${
                index === selectedIndex
                  ? "border-[var(--tri-brand-primary)]"
                  : "border-transparent opacity-70 hover:opacity-100"
              }`}
              key={url}
              onClick={() => setSelectedIndex(index)}
              type="button"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={`Thumbnail ${index + 1}`}
                className="size-14 object-cover"
                src={url}
              />
            </button>
          ))}
        </div>
      ) : null}
      {actions ? <ActionsToolbar actions={actions} variant={variant} /> : null}
    </div>
  );
}

function MediaStage({
  alt,
  mimeType,
  posterUrl,
  url,
  variant,
}: {
  alt: string;
  mimeType?: string;
  posterUrl?: string;
  url: string;
  variant: Exclude<MediaVariant, "comparison">;
}) {
  if (variant === "audio") {
    return (
      <div className="flex w-full flex-col items-center gap-3 rounded-2xl border border-[var(--tri-border-default)] bg-[var(--tri-bg-surface)] p-6">
        <span aria-hidden className="size-12 text-[var(--tri-brand-primary)]">
          <MusicIcon />
        </span>
        <p className="max-w-md text-center text-sm text-[var(--tri-text-secondary)]">
          {alt || "Untitled audio"}
        </p>
        {mimeType ? <span className="text-xs text-[var(--tri-text-tertiary)]">{mimeType}</span> : null}
        <audio className="mt-2 w-full max-w-md" controls src={url}>
          Your browser does not support audio playback.
        </audio>
      </div>
    );
  }
  if (variant === "video") {
    return (
      <div className="overflow-hidden rounded-2xl border border-[var(--tri-border-default)] bg-black">
        <video className="max-h-[60vh] w-full" controls muted poster={posterUrl} src={url}>
          Your browser does not support video playback.
        </video>
      </div>
    );
  }
  return (
    <div className="flex max-h-[60vh] items-center justify-center overflow-hidden rounded-2xl border border-[var(--tri-border-default)] bg-[var(--tri-bg-surface-alt)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={alt} className="max-h-[60vh] w-full object-contain" src={url} />
    </div>
  );
}

function ComparisonView({ afterUrl, beforeUrl }: { afterUrl?: string; beforeUrl?: string }) {
  const [slider, setSlider] = useState(50);
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="relative select-none overflow-hidden rounded-2xl border border-[var(--tri-border-default)] bg-[var(--tri-bg-surface-alt)]">
        <div className="relative aspect-video w-full">
          {beforeUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt="Before"
              className="absolute inset-0 size-full object-contain"
              src={beforeUrl}
            />
          ) : null}
          {afterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt="After"
              className="absolute inset-0 size-full object-contain"
              src={afterUrl}
              style={{ clipPath: clipInset(slider) }}
            />
          ) : null}
          <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
            Before
          </span>
          <span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
            After
          </span>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-white"
            style={{ left: `${slider}%` }}
          >
            <span className="absolute top-1/2 left-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-black/60 text-white">
              <CompareArrowsIcon />
            </span>
          </div>
        </div>
      </div>
      <label className="flex items-center gap-3 text-sm text-[var(--tri-text-secondary)]">
        <span>Comparison</span>
        <input
          aria-label="Before and after comparison slider"
          className="flex-1"
          max={100}
          min={0}
          onChange={(event) => setSlider(Number(event.target.value))}
          type="range"
          value={slider}
        />
      </label>
    </div>
  );
}

function ActionsToolbar({
  actions,
  variant,
}: {
  actions: MediaLightboxActions;
  variant: MediaVariant;
}) {
  const isVideo = variant === "video";
  // Order mirrors Angular media-lightbox.
  const entries: Array<{
    key: keyof MediaLightboxActions;
    label: string;
    icon: ReactNode;
    onClick?: () => void;
    submenu?: ReactNode;
  }> = [
    { key: "edit", label: "Edit this media", icon: <EditIcon />, onClick: actions.edit },
    {
      key: "generateVideo",
      label: "Generate video",
      icon: <VideoIcon />,
    },
    { key: "sendToVto", label: "Virtual Try-On", icon: <ShirtIcon />, onClick: actions.sendToVto },
    { key: "share", label: "Share", icon: <ShareIcon />, onClick: actions.share },
    { key: "download", label: "Download", icon: <DownloadIcon />, onClick: actions.download },
    { key: "seeMoreInfo", label: "See more info", icon: <InfoIcon />, onClick: actions.seeMoreInfo },
    { key: "assignTags", label: "Assign tags", icon: <TagIcon />, onClick: actions.assignTags },
    { key: "delete", label: "Delete", icon: <DeleteIcon />, onClick: actions.delete },
    {
      key: "editWithOmni",
      label: "Edit video with Omni",
      icon: <LayersIcon />,
      onClick: actions.editWithOmni,
    },
    { key: "extendWithAi", label: "Extend", icon: <SparklesIcon />, onClick: actions.extendWithAi },
    {
      key: "concatenate",
      label: "Concatenate Video",
      icon: <ConcatIcon />,
      onClick: actions.concatenate,
    },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-2" role="toolbar">
      {entries.map((entry) => {
        const handler = entry.onClick ?? (entry.key === "generateVideo" ? actions.generateVideo : undefined);
        if (entry.key === "generateVideo" && isVideo) return null;
        if (!handler && entry.key !== "generateVideo") return null;
        const button = (
          <span className="flex size-11 items-center justify-center rounded-full border border-[var(--tri-border-default)] bg-[var(--tri-bg-surface)] text-[var(--tri-text-secondary)] transition-colors hover:border-[var(--tri-brand-primary)] hover:text-[var(--tri-brand-primary)]">
            {entry.icon}
          </span>
        );
        if (entry.key === "generateVideo" && actions.generateVideo) {
          return (
            <Menu align="start" key={entry.key} label={entry.label} side="bottom" trigger={button}>
              <MenuItem onClick={() => actions.generateVideo?.("start")}>Use as Start Image</MenuItem>
              <MenuItem onClick={() => actions.generateVideo?.("end")}>Use as End Image</MenuItem>
            </Menu>
          );
        }
        return (
          <Tooltip content={entry.label} key={entry.key}>
            <button
              aria-label={entry.label}
              className="cursor-pointer"
              onClick={entry.onClick}
              type="button"
            >
              {button}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

/* Real (non-emoji) icons — Lucide-style stroke svgs. */
function svg(children: ReactNode) {
  return (
    <svg
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  );
}
const EditIcon = () => svg(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" /></>);
const VideoIcon = () => svg(<><path d="m22 8-6 4 6 4V8Z" /><rect width={14} height={12} x={2} y={6} rx={2} ry={2} /></>);
const ShirtIcon = () => svg(<><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" /></>);
const ShareIcon = () => svg(<><circle cx={18} cy={5} r={3} /><circle cx={6} cy={12} r={3} /><circle cx={18} cy={19} r={3} /><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" /></>);
const DownloadIcon = () => svg(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></>);
const InfoIcon = () => svg(<><circle cx={12} cy={12} r={10} /><path d="M12 16v-4M12 8h.01" /></>);
const TagIcon = () => svg(<><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" /><circle cx={7.5} cy={7.5} r={.5} fill="currentColor" /></>);
const DeleteIcon = () => svg(<><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" /></>);
const LayersIcon = () => svg(<><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" /><path d="m2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" /><path d="m2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" /></>);
const SparklesIcon = () => svg(<><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" /><path d="M5 3v4M19 17v4M3 5h4M17 19h4" /></>);
const ConcatIcon = () => svg(<><rect width={7} height={7} x={3} y={3} rx={1} /><rect width={7} height={7} x={14} y={14} rx={1} /></>);
const MusicIcon = () => svg(<><path d="M9 18V5l12-2v13" /><circle cx={6} cy={18} r={3} /><circle cx={18} cy={16} r={3} /></>);
const CompareArrowsIcon = () => svg(<><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></>);
