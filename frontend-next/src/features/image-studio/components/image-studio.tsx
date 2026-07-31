/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import { AssetPicker } from "@/src/components/media/asset-picker";
import { GenerationOverlay } from "@/src/components/studio/generation-overlay";
import { FlowPromptBox, type FlowOption } from "@/src/components/studio/flow-prompt-box";
import { JobPoller } from "@/src/components/studio/job-poller";
import { MediaLightbox } from "@/src/components/studio/media-lightbox";
import { OptionToolbar, type OptionToolbarItem } from "@/src/components/studio/option-toolbar";
import {
  ReferenceMediaStrip,
  type ReferenceSlot,
} from "@/src/components/studio/reference-media-strip";
import { StudioHero } from "@/src/components/studio/studio-hero";
import { useWorkspace } from "@/src/lib/workspace/context";

import { useImageState } from "../hooks/use-image-state";
import {
  formatRatioLabel,
  IMAGE_MODEL_OPTIONS,
  isGoogleSearchEligible,
  RATIO_LABELS,
  type ImageGenerationRequest,
  type ImageJob,
  type ImageMode,
  type ImageOptions,
  type ReferenceImage,
} from "../types";

type ImageStudioProps = { initialState?: Partial<ImageGenerationRequest> };

const IMAGE_MODES: { value: ImageMode; label: string }[] = [
  { value: "Text to Image", label: "Text to Image" },
  { value: "Ingredients to Image", label: "Ingredients to Image" },
];

const IMAGE_RESOLUTIONS: FlowOption[] = ["1K", "2K", "4K"].map((r) => ({
  value: r,
  label: r,
}));

// ponytail: Angular derives the Ingredients reference-slot count from model
// capabilities (`openImageSelector` maxRefs). Next has no capability registry
// for image, so use a fixed ceiling. Add when /api/images?options=1 exposes it.
const MAX_REFERENCE_IMAGES = 4;

export function ImageStudio({ initialState }: ImageStudioProps) {
  const router = useRouter();
  const { state, update } = useImageState(initialState);
  const { activeWorkspace } = useWorkspace();
  const [job, setJob] = useState<ImageJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ImageOptions | null>(null);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerIndex, setPickerIndex] = useState(0);

  // Carry over from generation-form.tsx: fetch option lists once.
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/images?options=1")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setOptions(data);
      })
      .catch(() => {
        if (!cancelled) setOptions(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Carry over from generation-form.tsx: sync active workspace into form state.
  useEffect(() => {
    if (activeWorkspace) update({ workspaceId: Number(activeWorkspace.id) });
  }, [activeWorkspace, update]);

  // --- submit / getStatus preserved verbatim from the prior implementation ---
  const submit = async (payload: ImageGenerationRequest) => {
    setLoading(true);
    try {
      const csrf = await fetch("/api/auth/csrf").then((response) =>
        response.json()
      );
      const response = await fetch("/api/images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf.csrfToken,
        },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok || !Number.isInteger(body.mediaItemId)) {
        throw new Error(body.error ?? "Image generation failed");
      }
      setJob({
        id: body.mediaItemId,
        status: body.status ?? "processing",
        gcsUris: body.gcsUris,
        presignedUrls: body.presignedUrls,
      });
    } finally {
      setLoading(false);
    }
  };

  const jobId = job?.id ?? null;
  const getStatus = useCallback(async () => {
    if (!jobId) return null;
    const response = await fetch(`/api/images/${jobId}`);
    if (!response.ok) throw new Error("Image status failed");
    const body = await response.json();
    setJob((current) =>
      current
        ? {
            ...current,
            status: body.status,
            gcsUris: body.gcsUris,
            presignedUrls: body.presignedUrls,
            errorMessage: body.errorMessage,
          }
        : current
    );
    return { status: body.status };
  }, [jobId]);

  const handleJobStatus = useCallback((status: ImageJob["status"]) => {
    setJob((current) =>
      current && current.status !== status ? { ...current, status } : current,
    );
  }, []);

  // Carry over from prompt-input.tsx: rewrite via the gemini rewrite endpoint.
  const handleRewrite = async () => {
    if (loading) return;
    const csrf = await fetch("/api/auth/csrf").then((response) => response.json());
    const response = await fetch("/api/gemini/rewrite-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf.csrfToken },
      body: JSON.stringify({ targetType: "image", userPrompt: state.prompt }),
    });
    const body = await response.json().catch(() => null);
    if (response.ok && typeof body?.prompt === "string") {
      update({ prompt: body.prompt });
    }
  };

  const handleGenerate = () => {
    const payload: ImageGenerationRequest = {
      ...state,
      referenceImages: referenceImages.length ? referenceImages : undefined,
    };
    if (!payload.workspaceId && activeWorkspace) {
      payload.workspaceId = Number(activeWorkspace.id);
    }
    void submit(payload);
  };

  // --- Cross-feature handoff (Angular uses router state; Next App Router has
  // no equivalent, so we stage the same `remixState` shape in sessionStorage
  // before navigating). Receivers in /video and /vto must read this key. ---
  const firstUrl = job?.presignedUrls?.[0];
  const firstGcs = job?.gcsUris?.[0];

  const handleGenerateVideo = (position: "start" | "end") => {
    if (!job) return;
    // ponytail: MediaLightbox keeps its active thumbnail index internal and
    // does not pass it to action callbacks, so the handoff uses output 0
    // (matches prior ResultPanel behaviour). Upgrade when primitive exposes
    // activeIndex to actions.
    const remixState = {
      prompt: state.prompt,
      sourceMediaItems: [
        {
          mediaItemId: job.id,
          mediaIndex: 0,
          role: position === "start" ? "start_frame" : "end_frame",
        },
      ],
      startImagePreviewUrl: position === "start" ? firstUrl : undefined,
      endImagePreviewUrl: position === "end" ? firstUrl : undefined,
    };
    try {
      sessionStorage.setItem("remixState", JSON.stringify(remixState));
    } catch {
      /* storage blocked */
    }
    router.push("/video");
  };

  const handleSendToVto = () => {
    if (!job) return;
    const remixState = {
      modelImageAssetId: job.id,
      modelImagePreviewUrl: firstUrl,
      modelImageMediaIndex: 0,
      modelImageGcsUri: firstGcs,
    };
    try {
      sessionStorage.setItem("remixState", JSON.stringify(remixState));
    } catch {
      /* storage blocked */
    }
    router.push("/vto");
  };

  const handleShare = async () => {
    if (!firstUrl) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Creative Studio image", url: firstUrl });
      } catch {
        /* user cancelled */
      }
      return;
    }
    try {
      await navigator.clipboard?.writeText(firstUrl);
    } catch {
      /* clipboard blocked */
    }
  };

  const handleDownload = () => {
    if (!firstUrl) return;
    const anchor = document.createElement("a");
    anchor.href = firstUrl;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const handleSeeMoreInfo = () => {
    if (job) router.push(`/gallery/${job.id}`);
  };

  // Preserved from prior ResultPanel wiring (edit is a stub pending an edit flow).
  const handleEdit = () => update({ prompt: state.prompt });
  const handleDelete = () => setJob(null);

  // --- Derived option data for the primitives ---
  const modelOptions: FlowOption[] = useMemo(() => {
    const availableModels = options?.generation_models
      ? new Set(options.generation_models)
      : null;
    const configuredModels = IMAGE_MODEL_OPTIONS.filter(
      (model) => !availableModels || availableModels.has(model.value),
    );
    return (configuredModels.length ? configuredModels : IMAGE_MODEL_OPTIONS).map(
      (model) => ({
        value: model.value,
        label: model.label,
        icon: <SparkIcon />,
      }),
    );
  }, [options]);

  const activeModel =
    modelOptions.find((model) => model.value === state.generationModel) ??
    modelOptions[0];

  useEffect(() => {
    if (
      activeModel &&
      !modelOptions.some((model) => model.value === state.generationModel)
    ) {
      update({ generationModel: activeModel.value });
    }
  }, [activeModel, modelOptions, state.generationModel, update]);

  const aspectOptions: FlowOption[] = useMemo(
    () =>
      (options?.aspect_ratios ?? Object.keys(RATIO_LABELS)).map((ratio) => ({
        value: ratio,
        label: formatRatioLabel(ratio),
      })),
    [options]
  );

  const maxOutputs = options?.numbers_of_images?.length
    ? Math.max(...options.numbers_of_images)
    : 4;

  const negativePhrases = useMemo(
    () =>
      state.negativePrompt
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [state.negativePrompt]
  );

  const toolbarItems: OptionToolbarItem[] = [
    {
      id: "style",
      icon: <StyleIcon />,
      label: state.style ?? "Style",
      tooltip: "Select Style",
      kind: "menu",
      options: (options?.styles ?? []).map((s) => ({
        value: s,
        label: s,
        selected: state.style === s,
      })),
      onSelect: (v) => update({ style: v }),
    },
    {
      id: "color",
      icon: <PaletteIcon />,
      label: state.colorAndTone ?? "Color & Tone",
      tooltip: "Select Color & Tone",
      kind: "menu",
      options: (options?.colors_and_tones ?? []).map((c) => ({
        value: c,
        label: c,
        selected: state.colorAndTone === c,
      })),
      onSelect: (v) => update({ colorAndTone: v }),
    },
    {
      id: "lighting",
      icon: <LightingIcon />,
      label: state.lighting ?? "Lighting",
      tooltip: "Select Lighting",
      kind: "menu",
      options: (options?.lightings ?? []).map((l) => ({
        value: l,
        label: l,
        selected: state.lighting === l,
      })),
      onSelect: (v) => update({ lighting: v }),
    },
    {
      id: "composition",
      icon: <CompositionIcon />,
      label: state.composition ?? "Composition",
      tooltip: "Select Composition",
      kind: "menu",
      options: (options?.composition ?? []).map((c) => ({
        value: c,
        label: c,
        selected: state.composition === c,
      })),
      onSelect: (v) => update({ composition: v }),
    },
    {
      id: "negative",
      icon: <BlockIcon />,
      label: `Negative Phrases (${negativePhrases.length})`,
      tooltip: "Select Negative Phrases",
      kind: "menu",
      customMenu: (
        <NegativePhrasesMenu
          onChange={(negativePrompt) => update({ negativePrompt })}
          value={state.negativePrompt}
        />
      ),
    },
    {
      id: "watermark",
      icon: <WatermarkIcon />,
      label: state.addWatermark ? "Yes" : "No",
      tooltip: "Select Watermark",
      kind: "menu",
      options: [
        { value: "true", label: "Yes", selected: state.addWatermark },
        { value: "false", label: "No", selected: !state.addWatermark },
      ],
      onSelect: (v) => update({ addWatermark: v === "true" }),
    },
    ...(isGoogleSearchEligible(state.generationModel)
      ? [
          {
            id: "googleSearch",
            icon: <SearchIcon />,
            label: "Google Search",
            tooltip: "Enable Google Search",
            kind: "toggle" as const,
            selected: state.googleSearch,
            onToggle: () => update({ googleSearch: !state.googleSearch }),
          },
        ]
      : []),
    {
      id: "brand",
      icon: <BrandIcon />,
      label: "Brand Guidelines",
      tooltip: "Enable Brand Guidelines",
      kind: "toggle",
      selected: state.useBrandGuidelines,
      onToggle: () =>
        update({ useBrandGuidelines: !state.useBrandGuidelines }),
    },
    {
      id: "enhance",
      icon: <EnhanceIcon />,
      label: "Enhance Prompt",
      tooltip: "Enhance Prompt with AI",
      kind: "toggle",
      selected: state.enhancePrompt,
      onToggle: () => update({ enhancePrompt: !state.enhancePrompt }),
    },
  ];

  // --- Reference media (Ingredients mode only) ---
  const refSlots: ReferenceSlot[] = Array.from(
    { length: MAX_REFERENCE_IMAGES },
    (_, i) => ({
      id: `ref-${i}`,
      kind: "image" as const,
      previewUrl: referenceImages[i]?.previewUrl,
      label: "Reference",
    })
  );
  const openPickerFor = (slot: ReferenceSlot) => {
    const index = Number(slot.id.split("-")[1]);
    if (Number.isInteger(index)) setPickerIndex(index);
    setPickerOpen(true);
  };
  const referenceSlots =
    state.mode === "Ingredients to Image" ? (
      <ReferenceMediaStrip
        max={MAX_REFERENCE_IMAGES}
        onClear={(slot) => {
          const index = Number(slot.id.split("-")[1]);
          if (Number.isInteger(index)) {
            setReferenceImages((cur) => cur.filter((_, idx) => idx !== index));
          }
        }}
        onEdit={openPickerFor}
        onOpen={openPickerFor}
        slots={refSlots}
      />
    ) : undefined;

  const hasResult = !!job && (job.presignedUrls?.length ?? 0) > 0;
  const overlayStatus: "processing" | "failed" | null =
    job?.status === "failed"
      ? "failed"
      : loading || job?.status === "processing"
        ? "processing"
        : null;

  return (
    <section aria-label="Image studio" className="flex w-full max-w-4xl mx-auto flex-col items-center gap-6">
      <div className="w-full">
        {hasResult ? (
          <MediaLightbox
            actions={{
              edit: handleEdit,
              generateVideo: handleGenerateVideo,
              sendToVto: handleSendToVto,
              share: handleShare,
              download: handleDownload,
              seeMoreInfo: handleSeeMoreInfo,
              delete: handleDelete,
            }}
            media={{
              prompt: state.prompt,
              url: job?.presignedUrls?.[0],
              urls: job?.presignedUrls,
            }}
            variant="image"
          />
        ) : (
          <StudioHero icon={<HeroSparkIcon />} title="Welcome to Creative Studio" />
        )}
      </div>

      <OptionToolbar items={toolbarItems} />

      <FlowPromptBox
        aspectRatio={state.aspectRatio}
        aspectRatioOptions={aspectOptions}
        onAspectRatioChange={(v) => update({ aspectRatio: v })}
        generateDisabled={!state.prompt.trim() || !state.workspaceId}
        isLoading={loading}
        mode={state.mode}
        modes={IMAGE_MODES}
        onModeChange={(m) => update({ mode: m as ImageMode })}
        model={activeModel}
        models={modelOptions}
        onModelChange={(v) => update({ generationModel: v })}
        onGenerate={handleGenerate}
        onOutputsChange={(n) => update({ numberOfMedia: n })}
        onPromptChange={(v) => update({ prompt: v })}
        onRewrite={handleRewrite}
        prompt={state.prompt}
        promptPlaceholder={
          state.mode === "Ingredients to Image"
            ? "Describe the image to create from your ingredients..."
            : "Generate an image with text..."
        }
        outputs={state.numberOfMedia}
        maxOutputs={maxOutputs}
        referenceSlots={referenceSlots}
        resolution={state.resolution}
        resolutions={IMAGE_RESOLUTIONS}
        onResolutionChange={(v) =>
          update({ resolution: v as "1K" | "2K" | "4K" })
        }
      />

      {pickerOpen ? (
        <AssetPicker
          onClose={() => setPickerOpen(false)}
          onselect={(assets) => {
            const asset = assets[0];
            if (asset) {
              setReferenceImages((cur) => {
                const next = [...cur];
                next[pickerIndex] = {
                  id: asset.id,
                  previewUrl: asset.thumbnailUrl ?? asset.url,
                  label: asset.name,
                };
                return next;
              });
            }
          }}
          type="image"
        />
      ) : null}

      <GenerationOverlay
        message={
          overlayStatus === "failed" ? job?.errorMessage ?? undefined : undefined
        }
        onDismiss={
          overlayStatus === "failed" ? () => setJob(null) : undefined
        }
        status={overlayStatus}
        title={
          overlayStatus === "failed"
            ? "Generation Failed"
            : "Generating Images..."
        }
      />

      {job ? (
        <JobPoller
          enabled={job.status === "processing"}
          getStatus={getStatus}
          onStatus={handleJobStatus}
        />
      ) : null}
    </section>
  );
}

/**
 * Negative-phrases chip grid rendered inside the OptionToolbar `customMenu`
 * hatch. Phrases are stored canonically as a comma-joined `negativePrompt`
 * string (the request wire format), split here for chip display.
 */
function NegativePhrasesMenu({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const phrases = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const commit = (next: string[]) => onChange(next.join(", "));
  const add = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    commit([...phrases, trimmed]);
    setDraft("");
  };
  return (
    // Stop propagation so typing/clicking inside does not close the host Menu.
    <div
      className="w-72 p-2"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        {phrases.length === 0 ? (
          <span className="text-xs text-[var(--tri-text-tertiary)]">
            No phrases yet.
          </span>
        ) : (
          phrases.map((phrase) => (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-[var(--tri-bg-surface-alt)] px-2 py-0.5 text-xs text-[var(--tri-text-primary)]"
              key={phrase}
            >
              {phrase}
              <button
                aria-label={`Remove ${phrase}`}
                className="text-[var(--tri-text-tertiary)] hover:text-[var(--tri-brand-coral)]"
                onClick={() => commit(phrases.filter((p) => p !== phrase))}
                type="button"
              >
                <CloseXIcon />
              </button>
            </span>
          ))
        )}
      </div>
      <label className="sr-only" htmlFor="neg-phrase-input">
        New negative phrase
      </label>
      <input
        aria-label="New negative phrase"
        className="w-full rounded-[var(--tri-radius-sm)] border border-[var(--tri-border-default)] bg-[var(--tri-bg-surface)] px-2 py-1.5 text-sm text-[var(--tri-text-primary)] focus-visible:border-[var(--tri-brand-primary)] focus-visible:outline-none"
        id="neg-phrase-input"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            add();
          }
        }}
        placeholder="New phrase..."
        type="text"
        value={draft}
      />
    </div>
  );
}

/* --- Icon helpers (stroke svgs, no emoji) --- */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="size-6"
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

const StyleIcon = () => (
  <Icon>
    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.7255 3.09032 17.1962 4.85857 19" />
    <path d="M12 6c.5523 0 1-.44772 1-1s-.5523-1-1-1-1 .44772-1 1 .44772 1 1 1Z" />
    <path d="M8 8c.55228 0 1-.44772 1-1s-.55228-1-1-1-1 .44772-1 1 .44772 1 1 1Z" />
    <path d="M6 12c.55228 0 1-.44772 1-1s-.55228-1-1-1-1 .44772-1 1 .44772 1 1 1Z" />
    <path d="M16 8c.5523 0 1-.44772 1-1s-.5523-1-1-1-1 .44772-1 1 .44772 1 1 1Z" />
    <path d="M19 11c.5523 0 1-.44772 1-1s-.5523-1-1-1-1 .44772-1 1 .44772 1 1 1Z" />
    <path d="M9.5 14c0 1.3807-1.11929 2.5-2.5 2.5S4.5 15.3807 4.5 14s1.11929-2.5 2.5-2.5 2.5 1.1193 2.5 2.5Z" />
  </Icon>
);
const PaletteIcon = () => (
  <Icon>
    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
    <path d="M12 2v20" />
    <path d="M12 12h10" />
    <path d="m12 12 7.07 7.07" />
    <path d="m12 12 7.07-7.07" />
  </Icon>
);
const LightingIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </Icon>
);
const CompositionIcon = () => (
  <Icon>
    <rect height="18" rx="2" width="18" x="3" y="3" />
    <path d="M21 9H3M21 15H3M12 3v18" />
  </Icon>
);
const BlockIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="10" />
    <path d="m4.93 4.93 14.14 14.14" />
  </Icon>
);
const WatermarkIcon = () => (
  <Icon>
    <rect height="18" rx="2" width="18" x="3" y="3" />
    <path d="M7 7h3v3H7zM7 14h10M7 17h6" />
  </Icon>
);
const SearchIcon = () => (
  <Icon>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </Icon>
);
const BrandIcon = () => (
  <Icon>
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </Icon>
);
const EnhanceIcon = () => (
  <Icon>
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    <path d="M5 3v4M19 17v4M3 5h4M17 19h4" />
  </Icon>
);
const SparkIcon = () => (
  <svg className="size-4 fill-violet-500 text-violet-500" viewBox="0 0 24 24">
    <path d="M12 2a1 1 0 011 1v3.17c2.11.45 3.82 2.16 4.27 4.27H20.5a1 1 0 110 2h-3.23c-.45 2.11-2.16 3.82-4.27 4.27V21a1 1 0 11-2 0v-3.17c-2.11-.45-3.82-2.16-4.27-4.27H3.5a1 1 0 110-2h3.23c.45-2.11 2.16-3.82 4.27-4.27V3a1 1 0 011-1z" />
  </svg>
);
const HeroSparkIcon = () => (
  <svg
    className="size-12 text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.6)]"
    fill="currentColor"
    viewBox="0 0 24 24"
  >
    <path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4z" />
  </svg>
);
const CloseXIcon = () => (
  <svg
    className="size-3"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
