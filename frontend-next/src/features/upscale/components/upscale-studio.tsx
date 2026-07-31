"use client";

/** Copyright 2026 Google LLC — Apache-2.0 */

import { AssetPicker } from "@/src/components/media/asset-picker";
import { GenerationOverlay } from "@/src/components/studio/generation-overlay";
import { MediaLightbox } from "@/src/components/studio/media-lightbox";
import { StudioHero } from "@/src/components/studio/studio-hero";
import { useMediaJob, type JobStatus } from "@/src/lib/hooks/use-media-job";
import { useWorkspace } from "@/src/lib/workspace";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useUpscale } from "../hooks/use-upscale";

const FACTORS = [2, 4] as const;

// ponytail: /api/upscale/{id} is not in openapi.json; shape mirrors Angular's
// MediaItem (presignedUrls / originalPresignedUrls). Adjust if backend differs.
type UpscaleJob = {
  status?: JobStatus;
  presignedUrls?: string[];
  originalPresignedUrls?: string[] | null;
  errorMessage?: string | null;
};

export function UpscaleStudio() {
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();
  const { error, isSubmitting, mediaItemId, submit } = useUpscale();

  const [factor, setFactor] = useState<2 | 4>(2);
  const [enhanceInputImage, setEnhanceInputImage] = useState(false);
  const [imagePreservationFactor, setImagePreservationFactor] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sourceAssetId, setSourceAssetId] = useState<string>();
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [job, setJob] = useState<UpscaleJob | null>(null);
  const [errorDismissed, setErrorDismissed] = useState(false);

  // PRESERVED: poll /api/upscale/{id}. Extended to stash the job body so the
  // comparison view can read before/after URLs (useMediaJob surfaces only status).
  const getStatus = useCallback(async () => {
    if (!mediaItemId) return null;
    const response = await fetch(`/api/upscale/${mediaItemId}`);
    if (!response.ok) throw new Error("Could not read upscale status");
    const data = (await response.json()) as UpscaleJob;
    setJob(data);
    return { status: (data.status ?? "processing") satisfies JobStatus };
  }, [mediaItemId]);
  const { error: jobError, status } = useMediaJob(getStatus, 5000, Boolean(mediaItemId));

  const workspaceId = Number(activeWorkspace?.id);
  const canSubmit = Number.isInteger(workspaceId) && workspaceId > 0 && Boolean(sourceAssetId);

  const isProcessing = isSubmitting || (Boolean(mediaItemId) && status === "processing");
  const hasFailed = status === "failed";
  const hasResult = status === "completed" && Boolean(job);
  const beforeUrl = job?.originalPresignedUrls?.[0];
  const afterUrl = job?.presignedUrls?.[0];

  const overlayStatus: "processing" | "failed" | null = errorDismissed
    ? null
    : isProcessing
      ? "processing"
      : hasFailed
        ? "failed"
        : null;

  const onPick = (assets: { id?: string; thumbnailUrl?: string; url?: string }[]) => {
    const asset = assets[0];
    if (!asset) return;
    setSourceAssetId(String(asset.id ?? ""));
    setPreviewUrl(asset.thumbnailUrl ?? asset.url);
  };
  const clearImage = () => {
    setSourceAssetId(undefined);
    setPreviewUrl(undefined);
    setJob(null);
  };
  const onSubmit = () => {
    if (!canSubmit || isProcessing) return;
    setErrorDismissed(false);
    void submit({
      enhance_input_image: enhanceInputImage,
      factor,
      image_preservation_factor: imagePreservationFactor,
      sourceAssetId,
      workspaceId,
    });
  };
  // PRESERVED: download via /api/gallery/download?ids=.
  const onDownload = () => {
    if (!mediaItemId) return;
    const href = `/api/gallery/download?ids=${encodeURIComponent(mediaItemId)}`;
    const a = document.createElement("a");
    a.href = href;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  const onSeeMoreInfo = () => {
    if (mediaItemId) router.push(`/gallery/${mediaItemId}`);
  };

  return (
    <section aria-label="Upscale studio" className="mx-auto max-w-5xl space-y-[var(--tri-space-6)] p-[var(--tri-space-6)]">
      <StudioHero
        subtitle="An AI tool for generating high-quality image ✨"
        title="Creative Studio Imagen Upscale"
      />

      <GenerationOverlay
        message={hasFailed ? (job?.errorMessage ?? undefined) : undefined}
        onDismiss={hasFailed ? () => setErrorDismissed(true) : undefined}
        status={overlayStatus}
        title={isProcessing ? "Your upscaled image is being generated..." : undefined}
      />

      <div className="space-y-[var(--tri-space-4)]">
        {/* Step-progress header: 1 Upload → 2 Result */}
        <div className="flex items-center gap-[var(--tri-space-3)]">
          <StepBadge active>1</StepBadge>
          <h2 className="m-0 text-sm font-semibold text-[var(--tri-text-primary)]">
            Upload Image to Upscale
          </h2>
          <div
            className={`h-0.5 flex-1 rounded ${
              hasResult || isProcessing
                ? "bg-[var(--tri-brand-primary)]"
                : "bg-[var(--tri-border-default)]"
            }`}
          />
          <StepBadge active={isProcessing} completed={hasResult}>
            2
          </StepBadge>
          <h2 className="m-0 text-sm font-semibold text-[var(--tri-text-primary)]">
            Upscaled Result
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-[var(--tri-space-6)] md:grid-cols-4">
          {/* Upload + settings panel */}
          <div className="col-span-1 flex flex-col gap-[var(--tri-space-5)]">
            <div
              className="relative flex min-h-[200px] items-center justify-center rounded-[var(--tri-card-radius)] border-2 border-dashed border-[var(--tri-border-default)] p-[var(--tri-space-4)]"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                setPickerOpen(true);
              }}
            >
              {isProcessing ? (
                <div className="flex flex-col items-center gap-[var(--tri-space-3)] text-[var(--tri-text-secondary)]">
                  <span
                    aria-hidden
                    className="size-8 animate-spin rounded-full border-2 border-[var(--tri-border-default)] border-t-[var(--tri-brand-primary)]"
                  />
                  <span>Processing…</span>
                </div>
              ) : previewUrl ? (
                <div className="group relative flex size-full items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="Selected source"
                    className="max-h-[350px] max-w-full object-contain"
                    src={previewUrl}
                  />
                  <div className="absolute inset-0 flex items-center justify-center gap-[var(--tri-space-3)] bg-black/50 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <button
                      className="min-h-11 rounded-full bg-white px-[var(--tri-space-4)] text-sm font-bold text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--tri-a11y-focus-ring)]"
                      onClick={() => setPickerOpen(true)}
                      type="button"
                    >
                      Change
                    </button>
                    <button
                      aria-label="Delete selected image"
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-red-600 px-[var(--tri-space-3)] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--tri-a11y-focus-ring)]"
                      onClick={clearImage}
                      type="button"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="flex min-h-[180px] w-full flex-col items-center gap-[var(--tri-space-3)] rounded-[var(--tri-radius-md)] text-[var(--tri-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--tri-a11y-focus-ring)]"
                  onClick={() => setPickerOpen(true)}
                  type="button"
                >
                  <AddPhotoIcon />
                  <span>Drop your photo or click to select</span>
                </button>
              )}
            </div>

            {/* Settings box */}
            <div className="space-y-[var(--tri-space-5)] rounded-[var(--tri-card-radius)] border border-[var(--tri-border-default)] p-[var(--tri-space-4)]">
              <div>
                <h3 className="mb-[var(--tri-space-2)] text-sm font-semibold text-[var(--tri-text-primary)]">
                  Upscale Factor
                </h3>
                <div aria-label="Upscale factor" className="flex gap-[var(--tri-space-2)]" role="radiogroup">
                  {FACTORS.map((value) => (
                    <button
                      aria-checked={factor === value}
                      className={`min-h-11 rounded-[var(--tri-radius-md)] px-[var(--tri-space-3)] text-sm ${
                        factor === value
                          ? "bg-[var(--tri-brand-primary)] text-white"
                          : "bg-[var(--tri-bg-surface-alt)] text-[var(--tri-text-secondary)]"
                      }`}
                      key={value}
                      onClick={() => setFactor(value)}
                      role="radio"
                      type="button"
                    >
                      {value}x
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-[var(--tri-space-2)] text-sm font-semibold text-[var(--tri-text-primary)]">
                  Enhance Input Image
                </h3>
                <label className="flex min-h-11 items-center gap-[var(--tri-space-2)] text-sm text-[var(--tri-text-primary)]">
                  <input
                    checked={enhanceInputImage}
                    className="size-4"
                    onChange={(event) => setEnhanceInputImage(event.target.checked)}
                    type="checkbox"
                  />
                  Enable Enhancement
                </label>
              </div>

              <div>
                <h3 className="mb-[var(--tri-space-2)] text-sm font-semibold text-[var(--tri-text-primary)]">
                  Image Preservation Factor
                </h3>
                <div className="flex items-center gap-[var(--tri-space-3)]">
                  <input
                    aria-label="Image preservation factor"
                    aria-valuetext={
                      imagePreservationFactor === null
                        ? "Auto"
                        : String(imagePreservationFactor)
                    }
                    className="min-h-11 flex-1"
                    id="preservation-factor"
                    max={1}
                    min={0}
                    onChange={(event) => setImagePreservationFactor(Number(event.target.value))}
                    step={0.1}
                    type="range"
                    value={imagePreservationFactor ?? 0}
                  />
                  <span className="w-12 text-right text-sm text-[var(--tri-text-primary)]">
                    {imagePreservationFactor === null ? "Auto" : imagePreservationFactor}
                  </span>
                </div>
                <p className="mt-[var(--tri-space-2)] text-xs text-[var(--tri-text-tertiary)]">
                  Higher values respect original pixels more. Lower values allow more detail
                  generation.
                </p>
              </div>

              <button
                className="flex min-h-12 w-full items-center justify-center gap-[var(--tri-space-2)] rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-red-400 px-[var(--tri-space-4)] font-bold text-white disabled:opacity-50"
                disabled={!canSubmit || isProcessing}
                onClick={onSubmit}
                type="button"
              >
                <SparkleIcon />
                {isProcessing ? "Upscaling…" : "Upscale"}
              </button>

              {error || jobError ? (
                <p aria-live="polite" className="text-sm text-red-600">
                  {error ?? jobError}
                </p>
              ) : null}
            </div>
          </div>

          {/* Result panel */}
          <div className="col-span-3">
            {isProcessing && !hasResult ? (
              <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-[var(--tri-card-radius)] border border-[var(--tri-border-default)] text-[var(--tri-text-secondary)]">
                <span className="text-3xl">…</span>
                <p className="mt-[var(--tri-space-3)]">Upscaling initiated…</p>
              </div>
            ) : hasResult && beforeUrl && afterUrl ? (
              <MediaLightbox
                actions={{ download: onDownload, seeMoreInfo: onSeeMoreInfo }}
                afterUrl={afterUrl}
                beforeUrl={beforeUrl}
                media={null}
                variant="comparison"
              />
            ) : (
              <div className="flex h-full min-h-[200px] items-center justify-center rounded-[var(--tri-card-radius)] border border-[var(--tri-border-default)] text-[var(--tri-text-secondary)]">
                <p>Comparison results will appear here.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {pickerOpen ? (
        <AssetPicker
          onClose={() => setPickerOpen(false)}
          onselect={(assets) =>
            onPick(
              assets.map((asset) => ({
                id: asset.id,
                thumbnailUrl: asset.thumbnailUrl,
                url: asset.url,
              })),
            )
          }
          type="image"
        />
      ) : null}
    </section>
  );
}

function StepBadge({
  active,
  children,
  completed,
}: {
  active?: boolean;
  children: React.ReactNode;
  completed?: boolean;
}) {
  const tone = completed
    ? "bg-[var(--tri-brand-primary)] text-white"
    : active
      ? "bg-[var(--tri-brand-primary)]/50 text-white"
      : "bg-[var(--tri-bg-surface-alt)] text-[var(--tri-text-secondary)]";
  return (
    <span
      aria-current={completed || active ? "step" : undefined}
      className={`flex size-7 items-center justify-center rounded-full text-sm font-bold ${tone}`}
    >
      {children}
    </span>
  );
}

/* Minimal inline SVGs (no icon dependency). */
function svg(children: React.ReactNode) {
  return (
    <svg
      aria-hidden
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  );
}
const AddPhotoIcon = () =>
  svg(
    <>
      <path d="M12 3v18M3 12h18" opacity={0} />
      <rect width={18} height={18} x={3} y={3} rx={2} />
      <circle cx={8.5} cy={8.5} r={1.5} />
      <path d="m21 15-5-5L5 21" />
    </>,
  );
const TrashIcon = () =>
  svg(
    <>
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>,
  );
const SparkleIcon = () =>
  svg(
    <>
      <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z" />
    </>,
  );

