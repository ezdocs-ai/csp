/* Copyright 2026 Google LLC
 * Licensed under Apache-2.0 */
"use client";

import Link from "next/link";
import { Button, EmptyState } from "@/src/components/ui";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="grid min-h-[60dvh] place-items-center gap-[var(--tri-space-4)] p-[var(--tri-space-8)]">
      <EmptyState description="Workflow could not load. Retry the request, or go back to the workflow list." title="Workflow unavailable" />
      <div className="flex flex-wrap items-center justify-center gap-[var(--tri-space-3)]">
        <Button onClick={reset}>Retry</Button>
        <Link
          className="inline-flex min-h-[var(--tri-button-height)] items-center justify-center rounded-[var(--tri-button-radius)] border border-[var(--tri-button-secondary-border)] bg-[var(--tri-button-secondary-bg)] px-[var(--tri-button-padding-inline)] font-[var(--tri-font-weight-semibold)] text-[length:var(--tri-label-button-size)] text-[var(--tri-button-secondary-fg)] hover:bg-[var(--tri-button-secondary-hover)]"
          href="/workflows"
        >
          Back to workflows
        </Link>
      </div>
    </section>
  );
}
