"use client";
/** Copyright 2026 Google LLC — Apache-2.0 */

import { useMemo, useRef, useState } from "react";
import { Track } from "./track";
import { canSplitAt, formatTime, trackKey } from "@/src/features/workbench";
import type { Clip } from "@/src/features/workbench";

type Props = {
  clips: Clip[];
  duration: number;
  currentTime: number;
  hiddenTracks: ReadonlySet<string>;
  lockedTracks: ReadonlySet<string>;
  onSeek: (time: number) => void;
  onMove: (id: string, offset: number) => void;
  onTrim: (id: string, edge: "start" | "end", time: number) => void;
  onSplit: (id: string, atTime: number) => void;
  onDelete: (id: string) => void;
  onToggleHidden: (key: string) => void;
  onToggleLocked: (key: string) => void;
};

// Angular `studio-slider` config: min 10, max 100, step 5. Default kept at the
// prior hardcoded value to avoid a layout shift on first paint.
const DEFAULT_PPS = 72;
const MIN_PPS = 10;
const MAX_PPS = 100;
const PPS_STEP = 5;

export function TimelineEditor({ clips, duration, currentTime, hiddenTracks, lockedTracks, onSeek, onMove, onTrim, onSplit, onDelete, onToggleHidden, onToggleLocked }: Props) {
  const [selectedId, setSelectedId] = useState<string>();
  const [pixelsPerSecond, setPixelsPerSecond] = useState(DEFAULT_PPS);
  const timelineRef = useRef<HTMLDivElement>(null);
  const tracks = useMemo(
    () =>
      (["video", "audio"] as const).flatMap((type) =>
        Array.from(
          { length: Math.max(1, ...clips.filter((clip) => clip.type === type).map((clip) => clip.trackIndex + 1)) },
          (_, trackIndex) => ({ type, trackIndex }),
        ),
      ),
    [clips],
  );
  const seekFromEvent = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (rect) onSeek(Math.max(0, Math.min(duration, (event.clientX - rect.left - 96) / pixelsPerSecond)));
  };
  const markers = Array.from({ length: Math.ceil(duration) + 1 }, (_, second) => second);
  const canSplit = canSplitAt(clips, selectedId ?? "", currentTime);

  return (
    <section aria-label="Timeline editor" className="grid gap-[var(--tri-space-2)] rounded-[var(--tri-card-radius)] border border-[var(--tri-border-subtle)] bg-[var(--tri-surface-base)] p-[var(--tri-space-2)]">
      <div className="flex flex-wrap items-center justify-end gap-[var(--tri-space-3)] pr-1 text-xs text-[var(--tri-text-secondary)]">
        <label className="inline-flex items-center gap-[var(--tri-space-1)]" title="Zoom timeline">
          <span aria-hidden>⌖</span>
          <input
            aria-label="Timeline zoom"
            max={MAX_PPS}
            min={MIN_PPS}
            onChange={(event) => setPixelsPerSecond(Number(event.target.value))}
            step={PPS_STEP}
            type="range"
            value={pixelsPerSecond}
          />
          <span aria-hidden>＋</span>
        </label>
        <button
          aria-label="Split selected clip at playhead"
          className={`inline-flex min-h-[var(--tri-control-height-md)] min-w-[var(--tri-control-height-md)] items-center justify-center rounded-full px-[var(--tri-space-2)] ${canSplit ? "bg-[var(--tri-brand-primary)] text-[var(--tri-brand-on-primary)]" : "border border-[var(--tri-border-default)] opacity-50"} `}
          disabled={!canSplit}
          onClick={() => selectedId && onSplit(selectedId, currentTime)}
          title="Split clip (Razor)"
          type="button"
        >
          ✂
        </button>
        <button
          aria-label="Delete selected clip"
          className={`inline-flex min-h-[var(--tri-control-height-md)] min-w-[var(--tri-control-height-md)] items-center justify-center rounded-full px-[var(--tri-space-2)] ${selectedId ? "bg-[var(--tri-state-error)] text-white" : "border border-[var(--tri-border-default)] opacity-50"}`}
          disabled={!selectedId}
          onClick={() => {
            if (selectedId) {
              onDelete(selectedId);
              setSelectedId(undefined);
            }
          }}
          title="Delete clip"
          type="button"
        >
          ⌫
        </button>
      </div>
      <div className="overflow-x-auto">
        <div
          ref={timelineRef}
          className="relative min-w-max"
          onPointerDown={seekFromEvent}
          style={{ width: `${96 + Math.max(1, duration) * pixelsPerSecond}px` }}
        >
          <div className="grid h-8 grid-cols-[6rem_1fr] border-b border-[var(--tri-border-subtle)]">
            <span />
            <div className="relative">
              {markers.map((second) => (
                <span className="absolute top-1 text-[10px] text-[var(--tri-text-tertiary)]" key={second} style={{ left: `${second * pixelsPerSecond}px` }}>
                  {formatTime(second)}
                </span>
              ))}
            </div>
          </div>
          {tracks.map(({ type, trackIndex }) => {
            const key = trackKey(type, trackIndex);
            return (
              <Track
                clips={clips.filter((clip) => clip.type === type && clip.trackIndex === trackIndex)}
                hidden={hiddenTracks.has(key)}
                key={key}
                locked={lockedTracks.has(key)}
                onMove={onMove}
                onSelect={setSelectedId}
                onToggleHidden={onToggleHidden}
                onToggleLocked={onToggleLocked}
                onTrim={onTrim}
                pixelsPerSecond={pixelsPerSecond}
                selectedId={selectedId}
                trackIndex={trackIndex}
                type={type}
              />
            );
          })}
          <div
            aria-label={`Playhead at ${formatTime(currentTime)}`}
            className="pointer-events-none absolute bottom-0 top-0 w-px bg-[var(--tri-input-focus-border)]"
            style={{ left: `${96 + currentTime * pixelsPerSecond}px` }}
          />
        </div>
      </div>
    </section>
  );
}
