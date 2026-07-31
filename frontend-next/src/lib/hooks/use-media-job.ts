/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useEffect, useRef, useState } from "react";

export type JobStatus = "processing" | "completed" | "failed" | "stopped";

export function useMediaJob(getStatus: () => Promise<{ status: JobStatus } | null>, intervalMs = 5000, enabled = true) {
  const [status, setStatus] = useState<JobStatus>("processing");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    if (!enabled) return;
    let ignore = false;
    let first = true;
    const tick = async () => {
      if (first) {
        first = false;
        setStatus("processing");
      }
      if (document.hidden) return;
      try {
        const result = await getStatus();
        if (ignore || !result) return;
        setStatus(result.status);
        if (result.status !== "processing" && timer.current) clearInterval(timer.current);
      } catch (cause) {
        if (!ignore) setError(String(cause));
      }
    };
    void tick();
    timer.current = setInterval(() => void tick(), intervalMs);
    return () => {
      ignore = true;
      if (timer.current) clearInterval(timer.current);
    };
  }, [enabled, getStatus, intervalMs]);

  return { status, error };
}
