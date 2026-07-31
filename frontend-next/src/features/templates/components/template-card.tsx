/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";
import { Badge } from "@/src/components/ui/badge";
import { Card } from "@/src/components/ui/card";

import { previewUrlFor } from "../mappers";
import { UseTemplateButton } from "./use-template-button";
import type { MediaTemplateResponse } from "../types";

type TemplateCardProps = { template: MediaTemplateResponse };

export function TemplateCard({ template }: TemplateCardProps) {
  const isVideo = template.mimeType.startsWith("video/");
  const isAudio = template.mimeType.startsWith("audio/");
  const preview = previewUrlFor(template);
  const sourceAssets = template.enrichedSourceAssets ?? [];
  const model = template.generationParameters?.model;

  return (
    <Card className="flex h-full flex-col overflow-hidden bg-[var(--tri-bg-surface)] text-[var(--tri-text-primary)] transition-colors hover:bg-[var(--tri-bg-surface-hover)]">
      <a
        className="block min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tri-border-focus)]"
        href={`/fun-templates/${template.id}`}
      >
        {preview ? (
          isVideo ? (

            <video
              className="aspect-video w-full bg-black object-cover"
              controls={false}
              muted
              playsInline
              poster={preview}
              preload="metadata"
              src={template.presignedUrls?.[0] ?? preview}
            />
          ) : isAudio ? (
            <div aria-hidden className="grid aspect-video w-full place-items-center bg-[var(--tri-bg-subtle)] text-4xl">
              ♪
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={`${template.name} preview`}
              className="aspect-video w-full object-cover"
              src={preview}
            />
          )
        ) : (
          <div className="aspect-video bg-[var(--tri-bg-subtle)]" />
        )}
      </a>

      <div className="flex flex-1 flex-col gap-[var(--tri-space-3)] p-[var(--tri-space-4)]">
        <h2 className="text-lg font-semibold">{template.name}</h2>
        {template.description ? (
          <p className="line-clamp-2 text-sm text-[var(--tri-text-secondary)]">{template.description}</p>
        ) : null}

        <div className="flex flex-wrap gap-[var(--tri-space-2)]">
          {template.industry ? <Badge>{template.industry}</Badge> : null}
          {template.brand ? <Badge>{template.brand}</Badge> : null}
          {model ? <Badge>{model}</Badge> : null}
          {template.tags?.map((tag) => <Badge key={tag}>{tag}</Badge>)}
        </div>

        {sourceAssets.length ? (
          <div aria-label="Source assets" className="flex flex-wrap gap-[var(--tri-space-2)]">
            {sourceAssets.map((asset) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={asset.role}
                className="size-12 rounded-[var(--tri-radius-sm)] border border-[var(--tri-border-default)] object-cover"
                key={asset.assetId}
                src={asset.presignedThumbnailUrl || asset.presignedUrl}
                title={asset.role}
              />
            ))}
          </div>
        ) : null}

        <div className="mt-auto pt-[var(--tri-space-2)]">
          <UseTemplateButton template={template} />
        </div>
      </div>
    </Card>
  );
}
