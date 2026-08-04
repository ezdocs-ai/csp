/* Copyright 2026 Google LLC
 * Licensed under Apache-2.0
 */
import { LoadingState } from "@/src/components/ui/loading";

export default function Loading() {
  return (
    <LoadingState label="Loading gallery">
      <div className="grid w-full max-w-[var(--tri-layout-wide)] grid-flow-dense grid-cols-2 gap-[var(--tri-grid-gap)] px-[var(--tri-layout-gutter)] md:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div className="aspect-[4/3] animate-pulse rounded-[var(--tri-card-radius)] bg-[var(--tri-bg-surface-alt)]" key={index} />
        ))}
      </div>
    </LoadingState>
  );
}
