/* Copyright 2026 Google LLC
 * Licensed under Apache-2.0 */
"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge, Card, ConfirmDialog } from "@/src/components/ui";
import { Lightbox, type MediaItem } from "@/src/components/media";
import {
  MediaLightbox,
  type MediaLightboxActions,
  type MediaLightboxMedia,
  type MediaVariant,
} from "@/src/components/studio/media-lightbox";
import {
  buildConcatenate,
  buildEditWithOmni,
  buildExtendWithAi,
  buildImageRemix,
  buildSendToVto,
  buildVideoEnd,
  buildVideoStart,
  isImageMedia,
  isVideoMedia,
  stageRemix,
  type RemixIntent,
} from "../gallery-actions";
import { useGalleryMutations } from "../hooks/use-gallery-mutations";
import { downloadZip } from "../mutations";
import { TagAssigner } from "./tag-assigner";
import type { MediaDetail } from "../types";

type TabKey = "details" | "technical" | "debug";
type SourceAssetLink = NonNullable<MediaDetail["enrichedSourceAssets"]>[number];

const PROMPT_PREVIEW_WORDS = 20;

/**
 * Gallery detail surface — ports Angular `media-detail.component.html`:
 * back-to-gallery header, left media stage, right tabbed details panel
 * (Details / Technical / Debug). Server fetch + 404 handling live in
 * `app/(studio)/gallery/[id]/page.tsx`.
 *
 * Stage + icon action toolbar delegate to the shared studio `MediaLightbox`
 * (output thumbnails when >1 url; toolbar auto-hides actions whose handler is
 * undefined). Cross-feature intents (image edit/remix, generate-video
 * start/end, send-to-vto for images; edit-with-Omni, extend, concatenate for
 * videos) stage the Angular-faithful `remixState` in sessionStorage then route
 * to the target studio (see `gallery-actions.ts`); share uses the native Web
 * Share API; delete/tags/download run their existing dialogs/mutations.
 * Referenced source-asset thumbnails open a local preview overlay (`Lightbox`).
 *
 * Deferred vs Angular (blocked, see parity memory):
 *  - Prompt Details + Lineage tabs — `promptJson` source + bodies unverified.
 *  - Admin "Create Template" — target route `/templates/edit/:id` is an orphan.
 *  - `searchEntryPoint` rendered HTML — skipped (XSS; needs a sanitizer).
 */
export function GalleryDetail({ media }: { media: MediaDetail }) {
  const [tab, setTab] = useState<TabKey>("details");
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);

  const router = useRouter();
  const { deleteMedia } = useGalleryMutations(() => router.push("/gallery"));
  const itemId = media.id == null ? null : String(media.id);
  const src = media.presignedUrls[0];
  const mimeType = media.mimeType;
  const isImage = isImageMedia(mimeType);
  const isVideo = isVideoMedia(mimeType);
  // Stage the remix payload in sessionStorage then route to the target studio
  // (Next App Router has no router.state; matches image-studio handoff).
  const runRemix = (intent: RemixIntent) => router.push(stageRemix(intent));
  const variant: MediaVariant = isVideo ? "video" : mimeType.startsWith("audio/") ? "audio" : "image";
  const stageMedia: MediaLightboxMedia = {
    url: media.presignedUrls[0],
    urls: media.presignedUrls.length > 1 ? media.presignedUrls : undefined,
    prompt: media.prompt ?? undefined,
    mimeType,
    posterUrl: media.presignedThumbnailUrls?.[0],
  };
  // Delegate the stage + icon action toolbar to the shared studio MediaLightbox
  // (output thumbnails when >1 url; toolbar auto-hides actions whose handler is
  // undefined). Plain preview/buttons removed to avoid duplicates. Closes R3.
  const actions: MediaLightboxActions | undefined = itemId
    ? {
        edit: isImage ? () => runRemix(buildImageRemix(media)) : undefined,
        generateVideo: isImage
          ? (position) => runRemix(position === "start" ? buildVideoStart(media) : buildVideoEnd(media))
          : undefined,
        sendToVto: isImage ? () => runRemix(buildSendToVto(media)) : undefined,
        editWithOmni: isVideo ? () => runRemix(buildEditWithOmni(media)) : undefined,
        extendWithAi: isVideo ? () => runRemix(buildExtendWithAi(media)) : undefined,
        concatenate: isVideo ? () => runRemix(buildConcatenate(media)) : undefined,
        download: () => downloadZip([itemId]),
        assignTags: () => setTagOpen(true),
        delete: () => setConfirmDelete(true),
        // Web Share API where available (browser native; graceful no-op otherwise).
        share: () => void navigator.share?.({ url: window.location.href }),
      }
    : undefined;
  const title = media.prompt || `Media ${media.id ?? ""}`;
  const hasDebug = Boolean(media.rawData || media.audioAnalysis || media.errorMessage);
  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "details", label: "Details" },
    { key: "technical", label: "Technical" },
    ...(hasDebug ? [{ key: "debug" as const, label: "Debug" }] : []),
  ];

  const promptWords = media.prompt?.split(/\s+/) ?? [];
  const showPromptToggle = promptWords.length > PROMPT_PREVIEW_WORDS;
  const promptText = promptExpanded || !showPromptToggle
    ? media.prompt ?? ""
    : `${promptWords.slice(0, PROMPT_PREVIEW_WORDS).join(" ")}...`;

  return (
    <div className="grid gap-[var(--tri-space-6)]">
      <div className="flex justify-end">
        <Link
          className="inline-flex min-h-[var(--tri-button-height)] items-center rounded-[var(--tri-button-radius)] border border-[var(--tri-button-secondary-border)] bg-[var(--tri-button-secondary-bg)] px-[var(--tri-button-padding-inline)] font-[var(--tri-font-weight-semibold)] text-[var(--tri-button-secondary-fg)] hover:bg-[var(--tri-button-secondary-hover)]"
          href="/gallery"
        >
          ← Go to Gallery
        </Link>
      </div>

      <section className="grid gap-[var(--tri-layout-grid-gap)] lg:grid-cols-3">
        <div className="lg:col-span-2">
          {src ? (
            <MediaLightbox actions={actions} media={stageMedia} variant={variant} />
          ) : (
            <Card className="grid min-h-[320px] place-items-center text-[var(--tri-text-secondary)]">
              Media unavailable.
            </Card>
          )}
        </div>

        <aside className="grid content-start gap-[var(--tri-space-4)]">
          <div>
            <Badge tone={media.status === "completed" ? "success" : media.status === "failed" ? "danger" : "info"}>
              {media.status}
            </Badge>
            <h1 className="mt-[var(--tri-space-3)] font-[var(--tri-font-display)] text-[var(--tri-text-h3-size)] text-[var(--tri-text-primary)]">
              {title}
            </h1>
          </div>

          <div role="tablist" className="flex gap-[var(--tri-space-2)] border-b border-[var(--tri-border-subtle)]">
            {tabs.map((entry) => (
              <button
                aria-selected={tab === entry.key}
                className={`min-h-[44px] border-b-2 px-[var(--tri-space-3)] font-[var(--tri-font-weight-semibold)] transition-[var(--tri-button-transition)] ${
                  tab === entry.key
                    ? "border-[var(--tri-brand-primary)] text-[var(--tri-text-primary)]"
                    : "border-transparent text-[var(--tri-text-secondary)] hover:text-[var(--tri-text-primary)]"
                }`}
                key={entry.key}
                onClick={() => setTab(entry.key)}
                role="tab"
                type="button"
              >
                {entry.label}
              </button>
            ))}
          </div>

          {tab === "details" ? (
            <DetailsPanel
              media={media}
              promptExpanded={promptExpanded}
              promptText={promptText}
              showPromptToggle={showPromptToggle}
              togglePrompt={() => setPromptExpanded((value) => !value)}
            />
          ) : null}
          {tab === "technical" ? <TechnicalPanel media={media} /> : null}
          {tab === "debug" ? <DebugPanel media={media} /> : null}
        </aside>
      </section>

      <ConfirmDialog
        confirmLabel="Delete"
        message="Delete this media? This cannot be undone here."
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => itemId && deleteMedia([itemId])}
        open={confirmDelete}
        title="Delete media"
        tone="danger"
      />
      {itemId ? (
        <TagAssigner mediaIds={[itemId]} onClose={() => setTagOpen(false)} onSuccess={() => router.refresh()} open={tagOpen} />
      ) : null}
    </div>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="border-b border-[var(--tri-border-subtle)] pb-[var(--tri-space-2)] font-[var(--tri-font-display)] text-[var(--tri-text-h5-size)] text-[var(--tri-text-primary)]">
      {children}
    </h3>
  );
}

function MetaGrid({ rows }: { rows: Array<[string, string | null]> }) {
  const visible = rows.filter(([, value]) => value !== null && value !== undefined && value !== "");
  if (visible.length === 0) return null;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-[var(--tri-space-4)] gap-y-[var(--tri-space-1)]">
      {visible.map(([label, value]) => (
        <div className="contents" key={label}>
          <dt className="font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-small-size)] text-[var(--tri-text-secondary)]">{label}</dt>
          <dd className="break-words text-right font-[var(--tri-font-code)] text-[var(--tri-text-small-size)] text-[var(--tri-text-primary)]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Adapt an enriched source asset to the gallery-card `MediaItem` the modal
 *  shell expects, so referenced-asset thumbnails can open a local preview
 *  overlay (image/video/audio stage, no action toolbar). Mirrors Angular
 *  `openSourceAssetInLightbox`'s GalleryItem construction. */
function sourceAssetToMediaItem(asset: SourceAssetLink): MediaItem {
  const thumb = asset.presignedThumbnailUrl ?? asset.presignedUrl;
  return {
    id: asset.assetId,
    workspaceId: 0,
    createdAt: new Date(0).toISOString(),
    itemType: "media_item",
    gcsUris: [asset.gcsUri],
    thumbnailUris: [thumb],
    tags: [],
    metadata: { mimeType: asset.mimeType ?? "image/*", prompt: `Input: ${asset.role}` },
    presignedUrls: [asset.presignedUrl],
    presignedThumbnailUrls: [thumb],
  };
}

interface DetailsPanelProps {
  media: MediaDetail;
  promptExpanded: boolean;
  promptText: string;
  showPromptToggle: boolean;
  togglePrompt: () => void;
}

function DetailsPanel({ media, promptExpanded, promptText, showPromptToggle, togglePrompt }: DetailsPanelProps) {
  const tags = media.tags?.filter((tag) => tag.name) ?? [];
  const grounding = media.groundingMetadata as {
    webSearchQueries?: string[];
    groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
  } | null;
  const queries = grounding?.webSearchQueries ?? [];
  const chunks = grounding?.groundingChunks ?? [];
  const sourceAssets = media.enrichedSourceAssets ?? [];
  const sourceMedia = media.enrichedSourceMediaItems ?? [];
  const hasStyle = Boolean(media.style || media.lighting || media.colorAndTone || media.composition);
  const hasReferenced = sourceAssets.length > 0 || sourceMedia.length > 0;
  const [assetOverlay, setAssetOverlay] = useState<SourceAssetLink | null>(null);

  const parameters: Array<[string, string | null]> = [
    ["Model", media.model ?? null],
    ["Created At", media.createdAt ? new Date(media.createdAt).toLocaleString() : null],
    ["Generation Time", media.generationTime != null ? `${media.generationTime}s` : null],
    ["Voice", media.voiceName ?? null],
    ["Language", media.languageCode ?? null],
    ["Seed", media.seed != null ? String(media.seed) : null],
    ["Number of Media", media.numMedia != null ? String(media.numMedia) : null],
    ["Duration", media.durationSeconds != null ? `${media.durationSeconds}s` : null],
    ["Aspect Ratio", media.aspectRatio ?? null],
    ["Resolution", media.resolution ?? null],
    ["Google Search", media.googleSearch != null ? (media.googleSearch ? "Enabled" : "Disabled") : null],
  ];

  return (
    <div className="grid gap-[var(--tri-space-5)]">
      <section className="grid gap-[var(--tri-space-3)]">
        <SubHeading>Parameters</SubHeading>
        <div className="flex items-center gap-[var(--tri-space-3)]">
          {media.userPicture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              className="size-8 shrink-0 rounded-full object-cover"
              src={media.userPicture}
            />
          ) : (
            <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--tri-bg-surface-alt)] text-[var(--tri-text-secondary)]">●</span>
          )}
          <span className="break-all font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-primary)]">{media.userEmail || "N/A"}</span>
        </div>
        <MetaGrid rows={parameters} />
      </section>

      {tags.length > 0 ? (
        <section className="grid gap-[var(--tri-space-3)]">
          <SubHeading>Tags</SubHeading>
          <ul className="flex flex-wrap gap-[var(--tri-space-2)]">
            {tags.map((tag) => (
              <li className="rounded-full bg-[var(--tri-bg-surface-alt)] px-[var(--tri-space-3)] py-[var(--tri-space-1)] text-[var(--tri-text-small-size)] text-[var(--tri-text-primary)]" key={tag.id ?? tag.name}>
                {tag.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {grounding ? (
        <section className="grid gap-[var(--tri-space-3)]">
          <SubHeading>Grounding Information</SubHeading>
          {queries.length > 0 ? (
            <div className="flex flex-wrap gap-[var(--tri-space-2)]">
              {queries.map((query) => (
                <span className="rounded-[var(--tri-radius-sm)] bg-[var(--tri-bg-surface-alt)] px-[var(--tri-space-2)] py-[var(--tri-space-1)] text-[var(--tri-text-small-size)] text-[var(--tri-text-secondary)]" key={query}>
                  {query}
                </span>
              ))}
            </div>
          ) : null}
          {chunks.length > 0 ? (
            <ul className="grid gap-[var(--tri-space-1)]">
              {chunks.map((chunk) =>
                chunk.web?.uri ? (
                  <li key={chunk.web.uri}>
                    <a className="break-all text-[var(--tri-text-link,#4f9cff)] hover:underline" href={chunk.web.uri} rel="noopener noreferrer" target="_blank">
                      {chunk.web.title || chunk.web.uri}
                    </a>
                  </li>
                ) : null,
              )}
            </ul>
          ) : null}
        </section>
      ) : null}

      {media.prompt ? (
        <section className="grid gap-[var(--tri-space-3)]">
          <SubHeading>Prompt</SubHeading>
          <p className={`whitespace-pre-wrap rounded-[var(--tri-radius-md)] bg-[var(--tri-bg-surface-alt)] p-[var(--tri-space-3)] text-[var(--tri-text-small-size)] text-[var(--tri-text-secondary)] ${promptExpanded ? "" : "line-clamp-3"}`}>
            {promptText}
          </p>
          {showPromptToggle ? (
            <button className="self-start text-[var(--tri-text-small-size)] text-[var(--tri-text-link,#4f9cff)] hover:underline" onClick={togglePrompt} type="button">
              {promptExpanded ? "Show less" : "Show more"}
            </button>
          ) : null}
        </section>
      ) : null}

      {hasReferenced ? (
        <section className="grid gap-[var(--tri-space-3)]">
          <SubHeading>Referenced Assets</SubHeading>
          <div className="flex flex-wrap gap-[var(--tri-space-2)]">
            {sourceMedia.map((source) => (
              <Link
                className="block size-20 overflow-hidden rounded-[var(--tri-radius-md)] border border-[var(--tri-border-subtle)] bg-[var(--tri-bg-surface-alt)] hover:opacity-80"
                href={`/gallery/${source.mediaItemId}?img_index=${source.mediaIndex}`}
                key={`media-${source.mediaItemId}-${source.mediaIndex}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="Source media item"
                  className="size-full object-cover"
                  src={source.presignedThumbnailUrl || source.presignedUrl}
                />
              </Link>
            ))}
            {sourceAssets.map((asset) => (
              <button
                className="block size-20 cursor-pointer overflow-hidden rounded-[var(--tri-radius-md)] border border-[var(--tri-border-subtle)] bg-[var(--tri-bg-surface-alt)] transition-opacity hover:opacity-80"
                key={`asset-${asset.assetId}`}
                onClick={() => setAssetOverlay(asset)}
                type="button"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="Source asset"
                  className="size-full object-cover"
                  src={asset.presignedThumbnailUrl || asset.presignedUrl}
                />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {hasStyle ? (
        <section className="grid gap-[var(--tri-space-3)]">
          <SubHeading>Style</SubHeading>
          <MetaGrid
            rows={[
              ["Image Style", media.style ?? null],
              ["Lighting", media.lighting ?? null],
              ["Color & Tone", media.colorAndTone ?? null],
              ["Composition", media.composition ?? null],
            ]}
          />
        </section>
      ) : null}
      {assetOverlay ? (
        <Lightbox media={sourceAssetToMediaItem(assetOverlay)} onClose={() => setAssetOverlay(null)} />
      ) : null}
    </div>
  );
}

function TechnicalPanel({ media }: { media: MediaDetail }) {
  return (
    <div className="grid gap-[var(--tri-space-5)]">
      <section className="grid gap-[var(--tri-space-3)]">
        <SubHeading>File Info</SubHeading>
        <MetaGrid
          rows={[
            ["Mime Type", media.mimeType ?? null],
            ["Watermark", media.addWatermark != null ? String(media.addWatermark) : null],
          ]}
        />
      </section>
      <section className="grid gap-[var(--tri-space-3)]">
        <SubHeading>Storage</SubHeading>
        {media.gcsUris.length > 0 ? (
          <ul className="grid gap-[var(--tri-space-1)]">
            {media.gcsUris.map((uri) => (
              <li key={uri}>
                <a className="block break-all rounded-[var(--tri-radius-md)] bg-[var(--tri-bg-surface-alt)] p-[var(--tri-space-3)] text-[var(--tri-text-small-size)] text-[var(--tri-text-secondary)] hover:bg-[var(--tri-bg-surface)]" href={uri} rel="noopener noreferrer" target="_blank">
                  {uri}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[var(--tri-text-small-size)] text-[var(--tri-text-secondary)]">N/A</p>
        )}
      </section>
      <section className="grid gap-[var(--tri-space-3)]">
        <SubHeading>Other</SubHeading>
        {media.comment ? (
          <div>
            <p className="mb-[var(--tri-space-1)] font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-small-size)] text-[var(--tri-text-secondary)]">Comment</p>
            <p className="whitespace-pre-wrap rounded-[var(--tri-radius-md)] bg-[var(--tri-bg-surface-alt)] p-[var(--tri-space-3)] text-[var(--tri-text-small-size)] text-[var(--tri-text-secondary)]">{media.comment}</p>
          </div>
        ) : null}
        {media.critique ? (
          <div>
            <p className="mb-[var(--tri-space-1)] font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-small-size)] text-[var(--tri-text-secondary)]">Critique</p>
            <p className="whitespace-pre-wrap rounded-[var(--tri-radius-md)] bg-[var(--tri-bg-surface-alt)] p-[var(--tri-space-3)] text-[var(--tri-text-small-size)] text-[var(--tri-text-secondary)]">{media.critique}</p>
          </div>
        ) : null}
        {!media.comment && !media.critique ? <p className="text-[var(--tri-text-small-size)] text-[var(--tri-text-secondary)]">N/A</p> : null}
      </section>
    </div>
  );
}

function DebugPanel({ media }: { media: MediaDetail }) {
  return (
    <div className="grid gap-[var(--tri-space-4)]">
      {media.errorMessage ? (
        <div>
          <p className="mb-[var(--tri-space-1)] font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-small-size)] text-[var(--tri-text-danger,#ef4444)]">Error Message</p>
          <p className="whitespace-pre-wrap break-words rounded-[var(--tri-radius-md)] bg-[var(--tri-bg-danger-subtle,#fee2e2)] p-[var(--tri-space-3)] text-[var(--tri-text-small-size)] text-[var(--tri-text-danger,#ef4444)]">{media.errorMessage}</p>
        </div>
      ) : null}
      {media.rawData ? (
        <div>
          <p className="mb-[var(--tri-space-1)] font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-small-size)] text-[var(--tri-text-secondary)]">Raw Data</p>
          <pre className="overflow-auto break-words rounded-[var(--tri-radius-md)] bg-[var(--tri-bg-surface-alt)] p-[var(--tri-space-3)] font-[var(--tri-font-code)] text-[var(--tri-text-small-size)] text-[var(--tri-text-secondary)]">{JSON.stringify(media.rawData, null, 2)}</pre>
        </div>
      ) : null}
      {media.audioAnalysis ? (
        <div>
          <p className="mb-[var(--tri-space-1)] font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-small-size)] text-[var(--tri-text-secondary)]">Audio Analysis</p>
          <pre className="overflow-auto break-words rounded-[var(--tri-radius-md)] bg-[var(--tri-bg-surface-alt)] p-[var(--tri-space-3)] font-[var(--tri-font-code)] text-[var(--tri-text-small-size)] text-[var(--tri-text-secondary)]">{JSON.stringify(media.audioAnalysis, null, 2)}</pre>
        </div>
      ) : null}
    </div>
  );
}
