/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useEffect } from "react";
import { useMediaJob, type JobStatus } from "@/src/lib/hooks/use-media-job";

type JobPollerProps = { getStatus: () => Promise<{ status: JobStatus } | null>; enabled?: boolean; onStatus?: (status: JobStatus) => void };

export function JobPoller({ getStatus, enabled = true, onStatus }: JobPollerProps) {
  const { status, error } = useMediaJob(getStatus, 5000, enabled);
  useEffect(() => { onStatus?.(status); }, [onStatus, status]);
  return <p aria-live="polite" className="text-sm text-[var(--tri-text-secondary)]">{error ?? `Generation ${status}`}</p>;
}
