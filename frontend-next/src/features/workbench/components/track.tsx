"use client";
/** Copyright 2026 Google LLC — Apache-2.0 */

import { ClipBlock } from "./clip-block";
import { trackKey } from "@/src/features/workbench";
import type { Clip, ClipType } from "@/src/features/workbench";

type Props = {
  type: ClipType;
  trackIndex: number;
  clips: Clip[];
  pixelsPerSecond: number;
  selectedId?: string;
  hidden: boolean;
  locked: boolean;
  onSelect: (id?: string) => void;
  onMove: (id: string, offset: number) => void;
  onTrim: (id: string, edge: "start" | "end", time: number) => void;
  onToggleHidden: (key: string) => void;
  onToggleLocked: (key: string) => void;
};

export function Track({ type, trackIndex, clips, pixelsPerSecond, selectedId, hidden, locked, onSelect, onMove, onTrim, onToggleHidden, onToggleLocked }: Props) {
  const key = trackKey(type, trackIndex);
  return (
    <div className="grid grid-cols-[6rem_1fr] border-t border-[var(--tri-border-subtle)]">
      <div className="flex min-h-14 items-center justify-between gap-1 px-2 text-xs font-semibold text-[var(--tri-text-secondary)]">
        <span className="truncate">{type === "video" ? "Video" : "Audio"} {trackIndex + 1}</span>
        <span className="flex items-center gap-1">
          <button
            aria-label={`${hidden ? "Show" : "Hide"} ${type} track ${trackIndex + 1}`}
            aria-pressed={hidden}
            className={`grid size-6 place-items-center rounded-full border text-[10px] ${hidden ? "border-[var(--tri-border-default)] opacity-50" : "border-[var(--tri-border-subtle)]"}`}
            onClick={() => onToggleHidden(key)}
            title={hidden ? "Show track" : "Hide track"}
            type="button"
          >
            {hidden ? "⦻" : "◉"}
          </button>
          <button
            aria-label={`${locked ? "Unlock" : "Lock"} ${type} track ${trackIndex + 1}`}
            aria-pressed={locked}
            className={`grid size-6 place-items-center rounded-full border text-[10px] ${locked ? "border-[var(--tri-border-default)] opacity-50" : "border-[var(--tri-border-subtle)]"}`}
            onClick={() => onToggleLocked(key)}
            title={locked ? "Unlock track" : "Lock track"}
            type="button"
          >
            {locked ? "🔒" : "🔓"}
          </button>
        </span>
      </div>
      <div
        className={`relative min-h-14 bg-[var(--tri-surface-raised)] ${hidden ? "opacity-40" : ""}`}
        onClick={() => onSelect()}
      >
        {clips.map((clip) => (
          <ClipBlock
            clip={clip}
            key={clip.id}
            locked={locked}
            onMove={(offset) => onMove(clip.id, offset)}
            onSelect={() => onSelect(clip.id)}
            onTrim={(edge, time) => onTrim(clip.id, edge, time)}
            pixelsPerSecond={pixelsPerSecond}
            selected={selectedId === clip.id}
          />
        ))}
      </div>
    </div>
  );
}
