"use client";
/** Copyright 2026 Google LLC — Apache-2.0 */

import { useCallback, useEffect, useRef, useState } from "react";
import { clamp } from "@/src/features/workbench";

export function usePlayback(duration: number) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const frameRef = useRef<number | null>(null);
  const displayTime = clamp(currentTime, 0, duration);
  const pause = useCallback(() => setIsPlaying(false), []);
  const play = useCallback(() => { if (duration > 0) setIsPlaying(true); }, [duration]);
  const seek = useCallback((time: number) => setCurrentTime(clamp(time, 0, duration)), [duration]);

  useEffect(() => {
    if (!isPlaying) return;
    const startedAt = performance.now();
    const startedTime = displayTime;
    const tick = (now: number) => {
      const nextTime = Math.min(startedTime + (now - startedAt) / 1000, duration);
      setCurrentTime(nextTime);
      if (nextTime >= duration) setIsPlaying(false);
      else frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current); };
  }, [displayTime, duration, isPlaying]);

  return { currentTime: displayTime, isPlaying, play, pause, seek, duration };
}
