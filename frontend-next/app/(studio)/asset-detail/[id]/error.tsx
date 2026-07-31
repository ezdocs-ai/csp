/* Copyright 2026 Google LLC
 * Licensed under the Apache-2.0 */
"use client";

import { Button, EmptyState } from "@/src/components/ui";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <section aria-label="Asset unavailable" className="grid place-items-center gap-[var(--tri-space-4)] p-[var(--tri-space-8)]">
      <EmptyState description="This source asset could not load. Retry request." title="Asset unavailable" />
      <Button onClick={reset}>Retry</Button>
    </section>
  );
}
