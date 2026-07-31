"use client";
/** Copyright 2026 Google LLC — Apache-2.0 */

import { useEffect, useRef } from "react";
import { clipsAtTime } from "@/src/features/workbench";
import type { Clip } from "@/src/features/workbench";

type Props = { clips: Clip[]; currentTime: number };
export function PreviewCanvas({ clips, currentTime }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const clip = clipsAtTime(clips.filter((item) => item.type === "video"), currentTime)[0];
  const sourceTime = clip ? clip.startTime + currentTime - clip.offset : 0;
  useEffect(() => { if (videoRef.current && Math.abs(videoRef.current.currentTime - sourceTime) > 0.1) videoRef.current.currentTime = sourceTime; }, [sourceTime]);
  return <section aria-label="Video preview" className="aspect-video overflow-hidden rounded-[var(--tri-card-radius)] bg-[var(--tri-surface-raised)]"><video className="h-full w-full object-contain" controls={false} key={clip?.id} muted ref={videoRef} src={clip?.url} />{!clip && <div className="grid h-full place-items-center text-sm text-[var(--tri-text-secondary)]">No video at playhead</div>}</section>;
}
