"use client";
/** Copyright 2026 Google LLC — Apache-2.0 */

import { Button } from "@/src/components/ui";
import { formatTime } from "@/src/features/workbench";

type Props = { currentTime: number; duration: number; isPlaying: boolean; play: () => void; pause: () => void; seek: (time: number) => void };
export function TransportControls({ currentTime, duration, isPlaying, play, pause, seek }: Props) {
  return <div className="flex min-h-11 items-center gap-2" aria-label="Playback controls"><Button aria-label="Skip to start" variant="ghost" onClick={() => seek(0)}>Start</Button><Button aria-label={isPlaying ? "Pause" : "Play"} onClick={isPlaying ? pause : play}>{isPlaying ? "Pause" : "Play"}</Button><Button aria-label="Skip to end" variant="ghost" onClick={() => seek(duration)}>End</Button><output className="ml-auto font-mono text-sm text-[var(--tri-text-secondary)]">{formatTime(currentTime)} / {formatTime(duration)}</output></div>;
}
