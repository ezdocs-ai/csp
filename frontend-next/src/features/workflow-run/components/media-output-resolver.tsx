/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useEffect, useState } from "react";
import { MediaCard, type MediaItem } from "@/src/components/media";

function mediaIds(value: unknown): string[] {
  if (typeof value === "string") return /^[\w-]+$/.test(value) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(mediaIds);
  if (value && typeof value === "object") return Object.entries(value).flatMap(([key, item]) => /media|asset|item/i.test(key) ? mediaIds(item) : []);
  return [];
}
export function MediaOutputResolver({ result }: { result: unknown }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  useEffect(() => {
    const ids = [...new Set(mediaIds(result))];
    if (!ids.length) return;
    void Promise.all(ids.map(async (id) => { const response = await fetch(`/api/gallery/item/${encodeURIComponent(id)}`); return response.ok ? response.json() as Promise<MediaItem> : null; })).then((resolved) => setItems(resolved.filter((item): item is MediaItem => item !== null))).catch(() => setItems([]));
  }, [result]);
  return items.length ? <section><h2 className="mb-2 text-lg font-bold">Media output</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <MediaCard key={item.id} media={item} />)}</div></section> : null;
}
