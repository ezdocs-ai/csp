/* Copyright 2026 Google LLC
 * Licensed under Apache-2.0
 */
"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function useGallery() {
  const router = useRouter(); const searchParams = useSearchParams();
  const setParam = (name: string, value?: string) => { const params = new URLSearchParams(searchParams); if (value) params.set(name, value); else params.delete(name); if (name !== "page") params.delete("page"); router.replace(`?${params.toString()}`); };
  return { page: Number(searchParams.get("page") ?? 1), searchParams, setParam };
}
