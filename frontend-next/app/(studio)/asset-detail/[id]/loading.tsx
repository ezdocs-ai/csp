/* Copyright 2026 Google LLC
 * Licensed under the Apache-2.0 */
import { LoadingState } from "@/src/components/ui/loading";

export default function Loading() {
  return (
    <LoadingState label="Loading asset details">
      <div className="grid w-full max-w-[var(--tri-layout-wide)] gap-[var(--tri-grid-gap)] px-[var(--tri-layout-gutter)] lg:grid-cols-3">
        <div className="aspect-video animate-pulse rounded-[var(--tri-radius-lg)] bg-[var(--tri-bg-surface-alt)] lg:col-span-2" />
        <div className="grid gap-[var(--tri-space-3)]">
          <div className="h-8 w-3/4 animate-pulse rounded-[var(--tri-radius-md)] bg-[var(--tri-bg-surface-alt)]" />
          <div className="h-32 animate-pulse rounded-[var(--tri-radius-md)] bg-[var(--tri-bg-surface-alt)]" />
        </div>
      </div>
    </LoadingState>
  );
}
