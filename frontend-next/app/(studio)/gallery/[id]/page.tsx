/* Copyright 2026 Google LLC
 * Licensed under Apache-2.0
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GalleryDetail, type MediaDetail } from "@/src/features/gallery";
import { ApiError } from "@/src/lib/api/errors";
import { getServerApiClient } from "@/src/lib/api/server";
import { requireUser } from "@/src/lib/auth/server";

type Props = { params: Promise<{ id: string }>; };

export async function generateMetadata({ params }: Props): Promise<Metadata> { const { id } = await params; return { title: `Gallery media ${id}` }; }

export default async function GalleryDetailPage({ params }: Props) {
  await requireUser();
  const { id } = await params; if (!/^\d+$/.test(id)) notFound(); const client = await getServerApiClient(); if (!client) notFound();
  const media = await getMedia(client, id);
  return <section className="mx-auto max-w-[var(--tri-layout-wide)] px-[var(--tri-layout-gutter)] py-[var(--tri-space-8)]"><GalleryDetail media={media} /></section>;
}

async function getMedia(client: NonNullable<Awaited<ReturnType<typeof getServerApiClient>>>, id: string) {
  try { return await client.get<MediaDetail>(`/api/gallery/item/${id}`); } catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); throw error; }
}
