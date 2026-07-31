"use client";
/** Copyright 2026 Google LLC — Apache-2.0 */

import { useRef } from "react";
import { formatTime } from "@/src/features/workbench";
import type { Clip } from "@/src/features/workbench";

type Props = {
  clip: Clip;
  pixelsPerSecond: number;
  locked?: boolean;
  onMove: (offset: number) => void;
  onTrim: (edge: "start" | "end", time: number) => void;
  onSelect: () => void;
  selected: boolean;
};

// Angular renders 5 thumbnail repeats across a video clip. We mirror that only
// when an upstream asset already provided a thumbnail URL — we never fabricate
// one. Audio waveforms likewise render only when `clip.waveform` is supplied.
const THUMBNAIL_REPEAT = 5;

export function ClipBlock({ clip, pixelsPerSecond, locked = false, onMove, onTrim, onSelect, selected }: Props) {
  const dragRef = useRef<{ x: number; offset: number; edge?: "start" | "end" } | null>(null);
  const label = clip.assetId || (clip.type === "video" ? "Video clip" : "Audio clip");
  const pointerDown = (event: React.PointerEvent<HTMLElement>, edge?: "start" | "end") => {
    if (locked) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, offset: clip.offset, edge };
    onSelect();
  };
  const pointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const delta = (event.clientX - drag.x) / pixelsPerSecond;
    if (drag.edge === "start") onTrim("start", Math.max(0, clip.startTime + delta));
    else if (drag.edge === "end") onTrim("end", Math.max(clip.startTime, clip.startTime + clip.duration + delta));
    else onMove(Math.max(0, drag.offset + delta));
  };
  const pointerUp = () => { dragRef.current = null; };
  const tone = clip.type === "video" ? "bg-[var(--tri-button-primary-bg)]" : "bg-[var(--tri-status-info-bg)]";
  const icon = clip.type === "video" ? "Video" : "Audio";
  const widthPx = Math.max(44, clip.duration * pixelsPerSecond);
  const showThumbs = clip.type === "video" && clip.thumbnail;
  const showWave = clip.type === "audio" && clip.waveform && clip.waveform.length > 0;

  return (
    <div
      aria-label={`${icon}: ${label}, ${formatTime(clip.duration)}${locked ? ", locked" : ""}`}
      aria-disabled={locked || undefined}
      className={`absolute top-1 flex min-h-11 items-center overflow-hidden rounded border px-3 text-xs text-[var(--tri-text-inverse)] ${locked ? "cursor-not-allowed opacity-70" : "cursor-grab active:cursor-grabbing"} ${tone} ${selected ? "ring-2 ring-[var(--tri-input-focus-border)]" : ""}`}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      role="button"
      style={{ left: `${clip.offset * pixelsPerSecond}px`, width: `${widthPx}px` }}
      tabIndex={locked ? -1 : 0}
    >
      {showThumbs && (
        <div aria-hidden className="pointer-events-none absolute inset-0 flex">
          {Array.from({ length: THUMBNAIL_REPEAT }, (_, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={index} src={clip.thumbnail} alt="" className="h-full flex-1 object-cover opacity-60" />
          ))}
        </div>
      )}
      {showWave && (
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center gap-px px-1">
          {clip.waveform!.map((height, index) => (
            <span
              key={index}
              className="flex-1 bg-white/70"
              style={{ height: `${Math.max(2, Math.min(100, height))}%` }}
            />
          ))}
        </div>
      )}
      <span aria-hidden className="relative mr-1 font-semibold">{clip.type === "video" ? "▣" : "♪"}</span>
      <span className="relative min-w-0 truncate">{icon}: {label}</span>
      <span className="relative ml-2 shrink-0">{formatTime(clip.duration)}</span>
      {!locked && (
        <>
          <span aria-hidden className="absolute inset-y-0 left-0 w-2 cursor-ew-resize" onPointerDown={(event) => pointerDown(event, "start")} />
          <span aria-hidden className="absolute inset-y-0 right-0 w-2 cursor-ew-resize" onPointerDown={(event) => pointerDown(event, "end")} />
        </>
      )}
    </div>
  );
}
