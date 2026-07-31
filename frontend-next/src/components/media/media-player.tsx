/* Copyright 2026 Google LLC
 * Licensed under Apache-2.0
 */
"use client";

import { useEffect, useRef, useState } from "react";

export interface MediaPlayerProps {
  src: string;
  type: string;
  poster?: string;
}

export function MediaPlayer({ poster, src, type }: MediaPlayerProps) {
  if (type.startsWith("audio/")) return <AudioPlayer src={src} />;
  return (
    <video
      aria-label="Video player"
      className="w-full rounded-[var(--tri-radius-lg)] bg-[var(--tri-bg-surface-alt)]"
      controls
      poster={poster}
      src={src}
    />
  );
}

/** Custom audio UI mirroring Angular media-lightbox: hidden <audio> + play/pause
 * circle, current/total time, native range seek; resets on ended. */
function AudioPlayer({ src }: { src: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    const onTime = () => setCurrent(audio.currentTime);
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onEnd = () => {
      setPlaying(false);
      setCurrent(0);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, []);

  const toggle = async () => {
    const audio = ref.current;
    if (!audio) return;
    try {
      if (audio.paused) await audio.play();
      else audio.pause();
    } catch {
      /* autoplay/permission rejection — state stays synced via play/pause events */
    }
  };

  const seek = (value: number) => {
    const audio = ref.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrent(value);
  };

  const dur = duration || 0;
  const seekValue = dur ? Math.min(current, dur) : 0;

  return (
    <div className="flex w-full items-center gap-[var(--tri-space-3)] rounded-[var(--tri-radius-lg)] bg-[var(--tri-bg-surface)] p-[var(--tri-space-3)]">
      <button
        aria-label={playing ? "Pause audio" : "Play audio"}
        className="grid size-[44px] shrink-0 place-items-center rounded-full bg-[var(--tri-accent-primary)] text-black"
        onClick={() => void toggle()}
        type="button"
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <span className="font-[var(--tri-font-code)] text-[length:var(--tri-text-small-size)] tabular-nums text-[var(--tri-text-secondary)]">
        {formatTime(current)}
      </span>
      <input
        aria-label="Seek"
        className="h-[44px] flex-1 cursor-pointer accent-[var(--tri-accent-primary)]"
        disabled={!dur}
        max={dur}
        min={0}
        onChange={(event) => seek(Number(event.target.value))}
        step={0.1}
        type="range"
        value={seekValue}
      />
      <span className="font-[var(--tri-font-code)] text-[length:var(--tri-text-small-size)] tabular-nums text-[var(--tri-text-secondary)]">
        {formatTime(dur)}
      </span>
      <audio ref={ref} src={src} />
    </div>
  );
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function PlayIcon() {
  return (
    <svg className="size-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="size-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}
