/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { GenerationOverlay } from "@/src/components/studio/generation-overlay";
import { MediaLightbox } from "@/src/components/studio/media-lightbox";
import { StudioHero } from "@/src/components/studio/studio-hero";
import { useMediaJob, type JobStatus } from "@/src/lib/hooks/use-media-job";
import { useWorkspace } from "@/src/lib/workspace";
import { useVtoState } from "../hooks/use-vto-state";
import { REMIX_STATE_KEY, parseVtoRemix } from "../remix-handoff";
import { isStepOneValid, type Gender, type GarmentSlot, type PresetAsset, type VtoRequest } from "../types";

const GARMENT_SLOTS: GarmentSlot[] = ["top", "bottom", "dress", "shoes"];
const GARMENT_LABELS: Record<GarmentSlot, string> = { top: "Tops", bottom: "Bottoms", dress: "Dresses", shoes: "Shoes" };
const GARMENT_UPLOAD_LABELS: Record<GarmentSlot, string> = { top: "Upload Top", bottom: "Upload Bottom", dress: "Upload Dress", shoes: "Upload Shoes" };
const GARMENT_ASSET_TYPE: Record<GarmentSlot, string> = { top: "vto_top", bottom: "vto_bottom", dress: "vto_dress", shoes: "vto_shoe" };

type VtoAssetDto = { id?: number | null; originalFilename?: string; presignedUrl?: string; presignedThumbnailUrl?: string | null };
type PresetLibrary = Record<"female" | "male" | GarmentSlot, PresetAsset[]>;
type VtoMedia = { id: number; status?: string; errorMessage?: string; presignedUrls: string[]; mimeType?: string; metadata?: Record<string, unknown> };

const EMPTY_PRESETS: PresetLibrary = { female: [], male: [], top: [], bottom: [], dress: [], shoes: [] };
// ponytail: Angular ships upload-photo-1..4.png under frontend/src/assets/images/vto/ (absent on
// disk in either repo). Copy into frontend-next/public/images/vto/ to populate the Examples row.
const UPLOAD_EXAMPLES: { imageUrl: string; alt: string }[] = [];

function csrfToken(): string {
  return document.cookie.split("; ").find((c) => c.startsWith("csp_csrf="))?.split("=").slice(1).join("=") ?? "";
}

function mapAsset(a: VtoAssetDto): PresetAsset {
  return {
    id: a.id != null ? String(a.id) : "",
    name: a.originalFilename ?? "",
    imageUrl: a.presignedUrl ?? "",
    thumbnailUrl: a.presignedThumbnailUrl || undefined,
  };
}

async function uploadAsset(file: File, workspaceId: number, assetType: string): Promise<PresetAsset> {
  const form = new FormData();
  form.append("file", file);
  form.append("workspaceId", String(workspaceId));
  form.append("assetType", assetType);
  // Lead BFF POST /api/source-assets forwards to backend /api/source_assets/upload;
  // validates file + workspaceId (Form()), accepts optional assetType, CSRF-enforced.
  // Response normalized to {id, name, type, url, thumbnailUrl, ...} matching mapAsset.
  const res = await fetch("/api/source-assets", { method: "POST", headers: { "x-csrf-token": csrfToken() }, body: form });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Upload failed");
  return mapAsset(body as VtoAssetDto);
}

function PlusIcon() {
  return (
    <svg aria-hidden className="size-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

/** Native file-input dropzone (click + drag-drop + keyboard). Upload-only affordance. */
function VtoDropzone({
  label,
  uploading,
  previewUrl,
  compact,
  onFile,
  onClear,
}: {
  label: string;
  uploading: boolean;
  previewUrl?: string;
  compact?: boolean;
  onFile: (file: File) => void;
  onClear?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const open = () => inputRef.current?.click();
  const base = "flex cursor-pointer flex-col items-center justify-center text-center transition-colors hover:border-[var(--tri-brand-primary)]";
  const size = compact
    ? `${base} size-28 shrink-0 gap-1 rounded-xl border-2 border-dashed border-[var(--tri-border-default)] p-2 text-xs text-[var(--tri-text-secondary)]`
    : `${base} min-h-44 gap-2 rounded-2xl border-2 border-dashed border-[var(--tri-border-default)] p-4`;
  return (
    <div
      aria-label={label}
      className={previewUrl ? "relative" : size}
      onClick={previewUrl ? undefined : open}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <input
        accept="image/*"
        className="hidden"
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
        ref={inputRef}
        type="file"
      />
      {previewUrl ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={label} className="max-h-64 w-full rounded-xl object-contain" src={previewUrl} />
          {onClear ? (
            <button
              aria-label={`Clear ${label}`}
              className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-full bg-black/60 text-lg text-white hover:bg-black/80"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              type="button"
            >
              ×
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <span aria-hidden={true}><PlusIcon /></span>
          <span className={compact ? "" : "text-sm text-[var(--tri-text-secondary)]"}>{uploading ? "Uploading…" : label}</span>
        </>
      )}
    </div>
  );
}

function PresetCard({ asset, selected, onSelect }: { asset: PresetAsset; selected: boolean; onSelect: () => void }) {
  return (
    <button
      aria-checked={selected}
      className={`shrink-0 overflow-hidden rounded-xl border-2 transition-colors ${selected ? "border-[var(--tri-brand-primary)]" : "border-transparent hover:border-[var(--tri-border-default)]"}`}
      onClick={onSelect}
      role="radio"
      type="button"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={asset.name} className="size-24 object-cover md:size-28" src={asset.thumbnailUrl || asset.imageUrl} />
    </button>
  );
}

export function VtoStudio() {
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();
  const { state, setPersonAsset, setGarment } = useVtoState();

  const [gender, setGender] = useState<Gender>("female");
  const [activeStep, setActiveStep] = useState(0);
  const [presets, setPresets] = useState<PresetLibrary>(EMPTY_PRESETS);
  const [loadingPresets, setLoadingPresets] = useState(true);
  const [personPreviewUrl, setPersonPreviewUrl] = useState("");
  const [personIsUpload, setPersonIsUpload] = useState(false);
  const [uploading, setUploading] = useState<"person" | GarmentSlot | null>(null);
  const [media, setMedia] = useState<VtoMedia | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showErrorOverlay, setShowErrorOverlay] = useState(true);

  // --- Cross-feature remix handoff (gallery stages `remixState` in
  // sessionStorage before routing here). Consume ONCE on mount, deferred past
  // hydration via rAF to stay SSR-safe. Hydrates the model person source from
  // a gallery media item (treated like a preset selection, not an upload). ---
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      let raw: unknown = null;
      try {
        const stored = sessionStorage.getItem(REMIX_STATE_KEY);
        if (stored != null) raw = JSON.parse(stored);
      } catch {
        raw = null;
      }
      try {
        sessionStorage.removeItem(REMIX_STATE_KEY);
      } catch {
        /* storage blocked */
      }
      const intent = parseVtoRemix(raw);
      if (!intent) return;
      setPersonAsset(String(intent.modelImageAssetId));
      setPersonPreviewUrl(intent.modelImagePreviewUrl ?? "");
      setPersonIsUpload(false);
    });
    return () => cancelAnimationFrame(frame);
    // Mount-only: consume the handoff exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ponytail: preset models + garments come from /api/vto/assets (BFF forward to backend
  // /api/source_assets/vto-assets). female_models/male_models/tops/bottoms/dresses/shoes.
  // Grids stay empty until the backend system assets are seeded; the upload path works
  // independently of this.
  useEffect(() => {
    let ignore = false;
    fetch("/api/vto/assets")
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load VTO assets"))))
      .then((data: { female_models?: VtoAssetDto[]; male_models?: VtoAssetDto[]; tops?: VtoAssetDto[]; bottoms?: VtoAssetDto[]; dresses?: VtoAssetDto[]; shoes?: VtoAssetDto[] }) => {
        if (ignore) return;
        setPresets({
          female: (data.female_models ?? []).map(mapAsset),
          male: (data.male_models ?? []).map(mapAsset),
          top: (data.tops ?? []).map(mapAsset),
          bottom: (data.bottoms ?? []).map(mapAsset),
          dress: (data.dresses ?? []).map(mapAsset),
          shoes: (data.shoes ?? []).map(mapAsset),
        });
      })
      .catch(() => {
        if (!ignore) setPresets(EMPTY_PRESETS);
      })
      .finally(() => {
        if (!ignore) setLoadingPresets(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  // --- PRESERVED: poll /api/vto/{id} ---
  const getStatus = useCallback(async () => {
    if (!jobId) return null;
    const response = await fetch(`/api/vto/${encodeURIComponent(jobId)}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "VTO status failed");
    setMedia(body);
    return { status: body.status as JobStatus };
  }, [jobId]);
  const { status, error: pollError } = useMediaJob(getStatus, 15_000, Boolean(jobId));

  // --- PRESERVED: POST /api/vto (csrf from cookie) ---
  async function submit() {
    if (!activeWorkspace || !state.personAssetId) return;
    const garments = GARMENT_SLOTS.flatMap((slot) =>
      state.garments[slot] ? [{ slot, assetId: state.garments[slot] as string }] : [],
    );
    if (!garments.length) {
      setError("Select at least one garment.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const payload: VtoRequest = { workspaceId: Number(activeWorkspace.id), personAssetId: state.personAssetId, garments };
      const response = await fetch("/api/vto", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken() },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok || !body.mediaItemId) throw new Error(body.error ?? "VTO generation failed");
      setJobId(String(body.mediaItemId));
      setMedia(body);
      setShowErrorOverlay(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "VTO generation failed");
    } finally {
      setLoading(false);
    }
  }

  function selectPresetModel(asset: PresetAsset) {
    setPersonAsset(asset.id);
    setPersonPreviewUrl(asset.imageUrl);
    setPersonIsUpload(false);
  }

  function clearPerson() {
    setPersonAsset("");
    setPersonPreviewUrl("");
    setPersonIsUpload(false);
  }

  function onGenderChange(g: Gender) {
    setGender(g);
    // Angular resets the preset model (not an uploaded one) when gender flips.
    if (!personIsUpload) clearPerson();
  }

  async function handleUpload(file: File, target: "person" | GarmentSlot) {
    if (!activeWorkspace) {
      setError("Select a workspace before uploading.");
      return;
    }
    const assetType = target === "person" ? (gender === "female" ? "vto_person_female" : "vto_person_male") : GARMENT_ASSET_TYPE[target];
    setUploading(target);
    setError("");
    try {
      const asset = await uploadAsset(file, Number(activeWorkspace.id), assetType);
      if (target === "person") {
        setPersonAsset(asset.id);
        setPersonPreviewUrl(asset.imageUrl);
        setPersonIsUpload(true);
      } else {
        setGarment(target, asset.id);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  const stepOneValid = isStepOneValid(gender, state.personAssetId);
  const modelsToShow = gender === "female" ? presets.female : presets.male;
  const hasResult = Boolean(media && jobId && status === "completed");
  const lightboxMedia = media
    ? {
        urls: media.presignedUrls,
        prompt: media.metadata?.prompt ? String(media.metadata.prompt) : "",
        mimeType: media.mimeType ? String(media.mimeType) : undefined,
      }
    : null;
  const overlayStatus: "processing" | "failed" | null =
    status === "processing" && jobId
      ? "processing"
      : status === "failed" && jobId && showErrorOverlay
        ? "failed"
        : null;

  return (
    <section aria-label="Virtual try-on studio" className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <StudioHero subtitle="A showcase of Virtual Try-On for your clothes and more ✨" title="Creative Studio Virtual Try-On" />

      <GenerationOverlay
        message={overlayStatus === "failed" ? media?.errorMessage || error || "An error occurred" : undefined}
        onDismiss={overlayStatus === "failed" ? () => setShowErrorOverlay(false) : undefined}
        status={overlayStatus}
        title={overlayStatus === "failed" ? "VTO Generation Failed" : "Your virtual try-on is being generated..."}
      />

      <ol aria-label="Virtual try-on steps" className="flex items-center gap-3 text-sm">
        {["Choose your model", "Choose your clothes"].map((label, i) => (
          <li className="flex items-center gap-3" key={label}>
            <span
              aria-current={activeStep === i ? "step" : undefined}
              className={`flex size-8 items-center justify-center rounded-full border ${
                activeStep === i
                  ? "border-[var(--tri-brand-primary)] bg-[var(--tri-brand-primary)] font-semibold text-white"
                  : "border-[var(--tri-border-default)] text-[var(--tri-text-secondary)]"
              }`}
            >
              {i + 1}
            </span>
            <span className={activeStep === i ? "font-semibold text-[var(--tri-text-primary)]" : "text-[var(--tri-text-secondary)]"}>{label}</span>
            {i === 0 ? <span aria-hidden className="text-[var(--tri-text-tertiary)]">→</span> : null}
          </li>
        ))}
      </ol>

      {activeStep === 0 ? (
        <fieldset className="grid gap-6">
          <legend className="sr-only">Choose your model</legend>
          <div aria-label="Select a model type" className="flex items-center gap-6" role="radiogroup">
            {(["female", "male"] as const).map((g) => (
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm" key={g}>
                <input
                  aria-checked={gender === g}
                  checked={gender === g}
                  className="size-5"
                  name="vto-gender"
                  onChange={() => onGenderChange(g)}
                  type="radio"
                  value={g}
                />
                {g === "female" ? "Female" : "Male"}
              </label>
            ))}
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <div className="grid gap-3">
              <h2 className="text-lg font-semibold">Select a model</h2>
              {loadingPresets ? (
                <span aria-label="Loading models" className="size-8 animate-spin rounded-full border-2 border-[var(--tri-border-default)] border-t-[var(--tri-brand-primary)]" />
              ) : null}
              {!loadingPresets && modelsToShow.length === 0 ? (
                <p className="text-sm text-[var(--tri-text-secondary)]">No preset models available — upload your own instead.</p>
              ) : null}
              <div aria-label="Select a preset model" className="flex flex-wrap gap-3" role="radiogroup">
                {modelsToShow.map((m) => (
                  <PresetCard asset={m} key={m.id} onSelect={() => selectPresetModel(m)} selected={state.personAssetId === m.id} />
                ))}
              </div>
              <div className="mt-2">
                <button
                  className="min-h-11 rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-red-400 px-6 font-semibold text-white disabled:opacity-50"
                  disabled={!stepOneValid}
                  onClick={() => setActiveStep(1)}
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>

            <div className="grid gap-3">
              <h2 className="text-lg font-semibold">Or upload your own</h2>
              <p className="text-sm text-[var(--tri-text-secondary)]">For best results, upload a well lit, full body length picture of yourself.</p>
              <VtoDropzone
                label="Drop your photo or click to select"
                onClear={clearPerson}
                onFile={(f) => void handleUpload(f, "person")}
                previewUrl={personPreviewUrl || undefined}
                uploading={uploading === "person"}
              />
              {UPLOAD_EXAMPLES.length > 0 ? (
                <>
                  <h3 className="mt-2 text-base font-semibold">Examples</h3>
                  <div className="flex flex-wrap gap-3">
                    {UPLOAD_EXAMPLES.map((ex) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt={ex.alt} className="size-20 rounded-lg border border-[var(--tri-border-default)] object-cover" key={ex.alt} src={ex.imageUrl} />
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </fieldset>
      ) : (
        <div className="grid gap-6">
          {jobId && status === "processing" ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <span aria-label="Generating" className="size-12 animate-spin rounded-full border-2 border-[var(--tri-border-default)] border-t-[var(--tri-brand-primary)]" />
              <p className="text-lg">Generating your virtual try-on…</p>
              <p className="text-sm text-[var(--tri-text-secondary)]">This may take a few moments.</p>
            </div>
          ) : null}

          {hasResult && lightboxMedia ? (
            <MediaLightbox
              actions={{
                delete: () => {
                  setMedia(null);
                  setJobId(null);
                  setShowErrorOverlay(true);
                },
                seeMoreInfo: () => {
                  if (media) router.push(`/gallery/${media.id}`);
                },
              }}
              media={lightboxMedia}
              variant="image"
            />
          ) : null}

          {jobId && status === "failed" ? (
            <div className="flex flex-col items-center gap-1 py-8 text-center">
              <p className="text-lg text-[var(--tri-error)]">Generation Failed</p>
              <p className="text-sm text-[var(--tri-text-secondary)]">{media?.errorMessage || error || "An error occurred"}</p>
            </div>
          ) : null}

          <div className="grid gap-6 md:grid-cols-4">
            <div className="grid gap-3 md:col-span-1">
              <h2 className="text-base font-semibold">Selected Model</h2>
              {personPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="Selected Model" className="w-full rounded-xl border border-[var(--tri-border-default)] object-contain" src={personPreviewUrl} />
              ) : (
                <div className="aspect-[3/4] rounded-xl border border-dashed border-[var(--tri-border-default)]" />
              )}
              <button className="min-h-11 rounded-full border border-[var(--tri-border-default)] px-4 text-sm" onClick={() => setActiveStep(0)} type="button">
                Back to Model Selection
              </button>
              <button
                className="min-h-11 rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-red-400 px-6 font-bold text-white disabled:opacity-50"
                disabled={!stepOneValid || loading}
                onClick={() => void submit()}
                type="button"
              >
                {loading ? "Starting…" : "Try on!"}
              </button>
              {!activeWorkspace ? <p className="text-sm text-[var(--tri-text-secondary)]">Select a workspace before generation.</p> : null}
              {error || pollError ? (
                <p aria-live="polite" className="text-sm text-[var(--tri-error)]">{error || pollError}</p>
              ) : null}
              {jobId ? <p aria-live="polite" className="text-sm text-[var(--tri-text-secondary)]">Generation {status}.</p> : null}
            </div>

            <div className="grid gap-6 md:col-span-3">
              {loadingPresets ? (
                <span aria-label="Loading garments" className="size-8 animate-spin rounded-full border-2 border-[var(--tri-border-default)] border-t-[var(--tri-brand-primary)]" />
              ) : null}
              {GARMENT_SLOTS.map((slot) => (
                <section className="grid gap-2" key={slot}>
                  <h3 className="text-base font-semibold">{GARMENT_LABELS[slot]}</h3>
                  <div className="flex flex-wrap items-start gap-3">
                    <VtoDropzone
                      compact
                      label={GARMENT_UPLOAD_LABELS[slot]}
                      onFile={(f) => void handleUpload(f, slot)}
                      uploading={uploading === slot}
                    />
                    {presets[slot].length > 0 ? (
                      <div aria-label={`${GARMENT_LABELS[slot]} presets`} className="[display:contents]" role="radiogroup">
                        {presets[slot].map((g) => (
                          <PresetCard asset={g} key={g.id} onSelect={() => setGarment(slot, g.id)} selected={state.garments[slot] === g.id} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
