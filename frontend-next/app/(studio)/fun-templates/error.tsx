"use client";
/** Copyright 2026 Google LLC — Apache-2.0 */
import { Button } from "@/src/components/ui/button";

type ErrorPageProps = { error: Error; reset: () => void };

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return <div className="space-y-[var(--tri-space-4)] text-[var(--tri-text-primary)]"><h1 className="text-2xl font-semibold">Templates unavailable</h1><p className="text-[var(--tri-text-secondary)]">{error.message}</p><Button className="min-h-11" onClick={reset}>Try again</Button></div>;
}
