/* Copyright 2026 Google LLC
 * Licensed under Apache-2.0
 */
"use client";

import { Button, EmptyState } from "@/src/components/ui";

export default function Error({ reset }: { error: Error; reset: () => void }) { return <section className="grid place-items-center gap-[var(--tri-space-4)] p-[var(--tri-space-8)]"><EmptyState description="Gallery could not load. Retry request." title="Gallery unavailable" /><Button onClick={reset}>Retry</Button></section>; }
