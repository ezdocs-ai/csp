/* Copyright 2026 Google LLC
 * Licensed under the Apache-2.0
 */
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge, Card } from "@/src/components/ui";
import { MediaPlayer } from "@/src/components/media";
import { ApiError } from "@/src/lib/api/errors";
import { getServerApiClient } from "@/src/lib/api/server";
import { requireUser } from "@/src/lib/auth/server";

/**
 * Minimal subset of the backend SourceAssetResponseDto that this detail page
 * renders. Kept local (not exported to a shared type) because no other surface
 * consumes it yet — widening the API barrel is out of scope for this fix.
 */
type SourceAssetDetail = {
  id?: number | null;
  workspaceId: number;
  originalFilename: string;
  mimeType: string;
  gcsUri: string;
  presignedUrl: string;
  presignedOriginalUrl?: string;
  presignedThumbnailUrl?: string;
  createdAt?: string;
  scope?: string;
  assetType?: string;
  aspectRatio?: string;
  tags?: Array<{ name?: string } | null> | null;
};

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Source asset ${id}` };
}

export default async function AssetDetailPage({ params }: Props) {
  await requireUser();
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const client = await getServerApiClient();
  if (!client) notFound();
  const asset = await getAsset(client, id);

  const src = asset.presignedUrl;
  const thumb = asset.presignedThumbnailUrl;
  const title = asset.originalFilename;
  const tags = (asset.tags ?? []).map((tag) => tag?.name).filter((name): name is string => Boolean(name));

  return (
    <section className="mx-auto max-w-[var(--tri-layout-wide)] px-[var(--tri-layout-gutter)] py-[var(--tri-space-8)]">
      <div className="flex justify-end">
        <Link
          className="inline-flex min-h-[var(--tri-button-height)] items-center rounded-[var(--tri-button-radius)] border border-[var(--tri-button-secondary-border)] bg-[var(--tri-button-secondary-bg)] px-[var(--tri-button-padding-inline)] font-[var(--tri-font-weight-semibold)] text-[var(--tri-button-secondary-fg)] hover:bg-[var(--tri-button-secondary-hover)]"
          href="/gallery"
        >
          ← Go to Gallery
        </Link>
      </div>

      <section className="mt-[var(--tri-space-6)] grid gap-[var(--tri-grid-gap)] lg:grid-cols-3">
        <div className="lg:col-span-2">
          {src ? (
            asset.mimeType.startsWith("image/") ? (
              <Image
                alt={title}
                className="mx-auto max-h-[80vh] w-full rounded-[var(--tri-radius-lg)] bg-[var(--tri-bg-surface-alt)] object-contain"
                height={1080}
                src={src}
                unoptimized
                width={1920}
              />
            ) : (
              <MediaPlayer poster={thumb} src={src} type={asset.mimeType} />
            )
          ) : (
            <Card className="grid min-h-[320px] place-items-center text-[var(--tri-text-secondary)]">
              Asset unavailable.
            </Card>
          )}
        </div>

        <aside className="grid content-start gap-[var(--tri-space-4)]">
          <div>
            <h1 className="font-[var(--tri-font-display)] text-[var(--tri-text-h3-size)] text-[var(--tri-text-primary)]">
              {title}
            </h1>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-[var(--tri-space-4)] gap-y-[var(--tri-space-1)]">
            {asset.mimeType ? (
              <div className="contents">
                <dt className="font-[var(--tri-font-weight-semibold)] text-[length:var(--tri-text-small-size)] text-[var(--tri-text-secondary)]">Type</dt>
                <dd className="break-words font-[var(--tri-font-code)] text-[length:var(--tri-text-small-size)] text-[var(--tri-text-primary)]">{asset.mimeType}</dd>
              </div>
            ) : null}
            {asset.aspectRatio ? (
              <div className="contents">
                <dt className="font-[var(--tri-font-weight-semibold)] text-[length:var(--tri-text-small-size)] text-[var(--tri-text-secondary)]">Aspect ratio</dt>
                <dd className="break-words font-[var(--tri-font-code)] text-[length:var(--tri-text-small-size)] text-[var(--tri-text-primary)]">{asset.aspectRatio}</dd>
              </div>
            ) : null}
            {asset.scope ? (
              <div className="contents">
                <dt className="font-[var(--tri-font-weight-semibold)] text-[length:var(--tri-text-small-size)] text-[var(--tri-text-secondary)]">Scope</dt>
                <dd className="break-words text-[length:var(--tri-text-small-size)] text-[var(--tri-text-primary)]">{asset.scope}</dd>
              </div>
            ) : null}
            {asset.assetType ? (
              <div className="contents">
                <dt className="font-[var(--tri-font-weight-semibold)] text-[length:var(--tri-text-small-size)] text-[var(--tri-text-secondary)]">Asset type</dt>
                <dd className="break-words text-[length:var(--tri-text-small-size)] text-[var(--tri-text-primary)]">{asset.assetType}</dd>
              </div>
            ) : null}
          </dl>
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-[var(--tri-space-2)]">
              {tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
            </div>
          ) : null}
        </aside>
      </section>
    </section>
  );
}

async function getAsset(
  client: NonNullable<Awaited<ReturnType<typeof getServerApiClient>>>,
  id: string,
): Promise<SourceAssetDetail> {
  try {
    return await client.get<SourceAssetDetail>(`/api/source_assets/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}
