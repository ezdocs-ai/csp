/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";
export * from "./hooks/use-gallery-mutations";

export async function downloadZip(ids: string[]) {
  window.location.href = `/api/gallery/download?ids=${encodeURIComponent(ids.join(","))}`;
}
