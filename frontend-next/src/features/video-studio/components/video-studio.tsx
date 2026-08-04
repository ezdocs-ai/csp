/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AssetPicker } from "@/src/components/media";
import { FlowPromptBox, type FlowMode, type FlowOption } from "@/src/components/studio/flow-prompt-box";
import { GenerationOverlay } from "@/src/components/studio/generation-overlay";
import { MediaLightbox } from "@/src/components/studio/media-lightbox";
import { OptionToolbar, type OptionToolbarItem } from "@/src/components/studio/option-toolbar";
import { ReferenceMediaStrip, type ReferenceSlot } from "@/src/components/studio/reference-media-strip";
import { StudioHero } from "@/src/components/studio/studio-hero";
import type { SourceAsset } from "@/src/features/source-assets/types";
import { useMediaJob } from "@/src/lib/hooks/use-media-job";
import { useWorkspace } from "@/src/lib/workspace";

import { modeSlotConfig } from "./mode-slots";
import { pickModel, safeAspectRatios, safeMaxOutputs, useVideoCapabilities } from "../hooks/use-video-capabilities";
import { useVideoState } from "../hooks/use-video-state";
import { useVideoSubmit } from "../hooks/use-video-submit";
import { REMIX_STATE_KEY, parseVideoRemix, videoRemixPatch } from "../remix-handoff";
import type { VideoGenerationRequest, VideoMode } from "../types";

/** Angular display labels for the flow-prompt-box mode menu. */
const MODE_LABELS: Record<VideoMode, string> = {
  "text-to-video": "Text to Video",
  "frames-to-video": "Frames to Video",
  "ingredients-to-video": "Ingredients to Video",
  "extend-video": "Extend Video",
  "concatenate-video": "Concatenate Video",
  // legacy
  "first-frame": "First frame",
  "last-frame": "Last frame",
  reference: "Reference images",
};

const FLOW_MODES: VideoMode[] = [
  "text-to-video",
  "frames-to-video",
  "ingredients-to-video",
  "extend-video",
  "concatenate-video",
];

/** Hardcoded option lists mirrored from Angular `video.component.ts` (source of truth). */
const VIDEO_STYLES = ["Cinematic", "Fantasy", "Modern", "Monochrome", "Photorealistic", "Realistic", "Sketch", "Vintage"];
const LIGHTINGS = ["Ambient", "Backlighting", "Cinematic", "Dramatic", "Dramatic Light", "Exposure", "Golden Hour", "Low Lighting", "Multiexposure", "Natural", "Studio", "Studio Light"];
const COLORS_AND_TONES = ["Black & White", "Cool", "Golden", "Monochrome", "Muted", "Pastel", "Toned", "Vibrant", "Warm"];
const COMPOSITIONS = ["Closeup", "Knolling", "Landscape photography", "Photographed through window", "Shallow depth of field", "Shot from above", "Shot from below", "Surface detail", "Wide angle"];

/** Slot asset binding (id → selected asset). Previews are local-only; presigned URLs expire. */
type SlotAsset = { assetId?: string; previewUrl?: string; name?: string };

function legacyMode(next: VideoMode): VideoMode {
  // ponytail: migrate persisted pre-parity modes into the closest Angular mode.
  if (next === "first-frame") return "frames-to-video";
  if (next === "last-frame") return "frames-to-video";
  if (next === "reference") return "ingredients-to-video";
  return next;
}

export function VideoStudio({ initialState = {} }: { initialState?: Partial<VideoGenerationRequest> }) {
  const { activeWorkspace } = useWorkspace();
  const { error: capabilitiesError, options } = useVideoCapabilities();
  const { state, update } = useVideoState(initialState);
  const { submit, loading, error: submitError } = useVideoSubmit();

  const [pickerSlot, setPickerSlot] = useState<string | null>(null);
  const [pickerKind, setPickerKind] = useState<"image" | "video" | "audio">("image");
  const [slotAssets, setSlotAssets] = useState<Record<string, SlotAsset>>({});
  const [phrases, setPhrases] = useState<string[]>(state.negativePhrases ?? []);
  const [showError, setShowError] = useState(true);
  const [mediaItemId, setMediaItemId] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const selectedModel = useMemo(() => pickModel(options, state.generationModel || undefined), [options, state.generationModel]);

  // ponytail: persist selected modelKey once capabilities arrive; upgrade when registry supports live disable.
  useEffect(() => {
    if (selectedModel && state.generationModel !== selectedModel.modelKey) {
      update({ generationModel: selectedModel.modelKey });
    }
  }, [selectedModel, state.generationModel, update]);

  const capabilities = selectedModel?.capabilities ?? null;
  const vendorModelId = selectedModel?.vendorModelId ?? "";
  const isOmni = vendorModelId.includes("omni");
  // ponytail: capability registry exposes no audio flag; Veo 3+ and Gemini Omni advertise audio.
  const supportsAudio = vendorModelId.includes("veo-3") || isOmni;

  // Normalize legacy persisted mode into the Angular-parity mode set exactly once.
  useEffect(() => {
    const normalized = legacyMode(state.mode);
    if (!FLOW_MODES.includes(normalized)) {
      update({ mode: "text-to-video" });
    } else if (normalized !== state.mode) {
      update({ mode: normalized });
    }
  }, [state.mode, update]);

  const defaults = selectedModel?.defaults ?? null;
  useEffect(() => {
    if (!selectedModel) return;
    if (defaults?.resolution && state.resolution === undefined) update({ resolution: defaults.resolution ?? undefined });
    if (defaults?.durationSeconds && state.durationSeconds === undefined) update({ durationSeconds: defaults.durationSeconds ?? undefined });
    if (defaults?.aspectRatio && state.aspectRatio === undefined) update({ aspectRatio: defaults.aspectRatio ?? undefined });
  }, [defaults, selectedModel, state.aspectRatio, state.durationSeconds, state.resolution, update]);

  // --- Cross-feature remix handoff (gallery stages `remixState` in
  // sessionStorage before routing here). Consume ONCE on mount, deferred past
  // hydration via rAF to stay SSR-safe (mirrors useVideoState's restore
  // pattern). Only recognized fields hydrate; explicit template initialState
  // props always win. The staged key is removed after consumption. ---
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
      const intent = parseVideoRemix(raw);
      if (!intent) return;
      const { statePatch, slots } = videoRemixPatch(intent, initialState);
      if (Object.keys(statePatch).length > 0) update(statePatch);
      if (Object.keys(slots).length > 0) setSlotAssets((current) => ({ ...current, ...slots }));
    });
    return () => cancelAnimationFrame(frame);
    // Mount-only: consume the handoff exactly once. initialState/update/
    // setSlotAssets are stable or initial-render snapshots by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pollJob = useCallback(async () => {
    if (!mediaItemId) return null;
    const response = await fetch(`/api/video/${mediaItemId}`);
    if (!response.ok) return { status: "failed" as const };
    const data = await response.json();
    if (data.status === "completed" && data.presignedUrls?.[0]) setResultUrl(data.presignedUrls[0]);
    return { status: (data.status ?? "processing") as "processing" | "completed" | "failed" | "stopped" };
  }, [mediaItemId]);

  const pollStatus = useMediaJob(pollJob, 15000, !!mediaItemId);

  const isProcessing = !!mediaItemId && pollStatus.status === "processing";
  const isFailed = pollStatus.status === "failed" || (!!submitError && showError);
  const isCompleted = !!resultUrl && pollStatus.status === "completed";

  // Capability-driven gating: pass duration/resolution to FlowPromptBox ONLY when the
  // selected model's registry entry lists them (omitting hides the chip — that IS the gate).
  const rawDurations = capabilities?.durations;
  const rawResolutions = capabilities?.resolutions;
  const durationOptions: FlowOption[] | null =
    Array.isArray(rawDurations) && rawDurations.length > 0
      ? rawDurations.map((d) => ({ value: String(d), label: `${d}s` }))
      : null;
  const resolutionOptions: FlowOption[] | null =
    Array.isArray(rawResolutions) && rawResolutions.length > 0
      ? rawResolutions.map((r) => ({ value: r, label: r }))
      : null;

  const aspectRatioOptions: FlowOption[] = useMemo(
    () => safeAspectRatios(capabilities).map((ratio) => ({ value: ratio, label: ratio })),
    [capabilities],
  );
  const maxOutputs = safeMaxOutputs(capabilities);

  // FlowPromptBox selects via entry.value === mode and emits entry.value, so carry the
  // display label as the value (keeps trigger text + selection + onModeChange consistent).
  const modes: FlowMode[] = FLOW_MODES.map((value) => ({ value: MODE_LABELS[value], label: MODE_LABELS[value] }));
  const currentModeLabel = MODE_LABELS[state.mode as VideoMode] ?? state.mode;
  const isConcatenate = state.mode === "concatenate-video";

  const modelOption: FlowOption | null = selectedModel
    ? { value: selectedModel.modelKey, label: selectedModel.displayName }
    : null;
  const modelOptions: FlowOption[] = options?.models.map((model) => ({ value: model.modelKey, label: model.displayName })) ?? [];

  const slotConfig = modeSlotConfig(state.mode, { maxReferenceImages: 3, isOmni });
  const referenceSlots: ReferenceSlot[] = slotConfig.slots.map((cfg) => ({
    id: cfg.id,
    kind: cfg.kind,
    label: cfg.label,
    previewUrl: slotAssets[cfg.id]?.previewUrl,
  }));

  function openPickerForSlot(slotId: string) {
    const cfg = slotConfig.slots.find((entry) => entry.id === slotId);
    if (!cfg) return;
    setPickerKind(cfg.kind === "audio" ? "audio" : cfg.kind === "video" ? "video" : "image");
    setPickerSlot(slotId);
  }

  function onPickerSelect(assets: SourceAsset[]) {
    if (!pickerSlot) return;
    const asset = assets[0];
    if (!asset) {
      clearSlot(pickerSlot);
      return;
    }
    setSlotAssets((current) => ({
      ...current,
      [pickerSlot]: { assetId: asset.id, previewUrl: asset.thumbnailUrl ?? asset.url, name: asset.name },
    }));
  }

  function clearSlot(slotId: string) {
    setSlotAssets((current) => {
      const next = { ...current };
      delete next[slotId];
      return next;
    });
  }

  /** Slot ids → CreateVeoDto wire fields (toBackendPayload is preserved verbatim). */
  function buildAssetIds() {
    const start = slotAssets.start?.assetId ?? slotAssets.source?.assetId ?? slotAssets.first?.assetId;
    const end = slotAssets.end?.assetId;
    const referenceAssetIds = slotConfig.slots
      .filter((cfg) => cfg.id.startsWith("ref-") && cfg.kind === "image")
      .map((cfg) => slotAssets[cfg.id]?.assetId)
      .filter((id): id is string => !!id);
    return { firstFrameAssetId: start, lastFrameAssetId: end, referenceAssetIds };
  }

  async function handleSubmit() {
    if (!activeWorkspace || !selectedModel) return;
    if (!isConcatenate && !state.prompt.trim()) return;
    setMediaItemId(null);
    setResultUrl(null);
    setShowError(true);
    const ids = buildAssetIds();
    const request = {
      ...state,
      workspaceId: Number(activeWorkspace.id),
      generationModel: selectedModel.vendorModelId,
      prompt: state.prompt.trim(),
      negativePrompt: phrases.length ? phrases.join(", ") : state.negativePrompt ?? "",
      negativePhrases: phrases,
      ...ids,
    };
    const result = await submit(request);
    if (result?.mediaItemId) setMediaItemId(result.mediaItemId);
  }

  async function handleRewrite() {
    if (!state.prompt.trim()) return;
    try {
      const csrf = await fetch("/api/auth/csrf").then((response) => response.json());
      const response = await fetch("/api/gemini/rewrite-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf.csrfToken },
        body: JSON.stringify({ targetType: "video", userPrompt: state.prompt }),
      });
      if (!response.ok) throw new Error("Rewrite failed");
      const data = (await response.json()) as { prompt?: string };
      if (typeof data.prompt === "string") update({ prompt: data.prompt });
    } catch {
      // rewrite is best-effort; surfaced failures stay non-blocking.
    }
  }

  function addPhrase(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setPhrases((current) => (current.includes(trimmed) ? current : [...current, trimmed]));
  }
  function removePhrase(value: string) {
    setPhrases((current) => current.filter((phrase) => phrase !== value));
  }

  /** MediaLightbox actions: Angular sets remix state (mode + source) rather than calling APIs directly. */
  function handleExtendWithAi() {
    if (!mediaItemId) return;
    update({ mode: "extend-video", parentMediaItemId: mediaItemId });
    setSlotAssets((current) => ({ ...current, source: { assetId: mediaItemId, previewUrl: resultUrl ?? undefined } }));
    setMediaItemId(null);
    setResultUrl(null);
  }
  function handleEditWithOmni() {
    if (!mediaItemId) return;
    const omni = options?.models.find((model) => model.vendorModelId.includes("omni"));
    if (omni) update({ generationModel: omni.modelKey });
    update({ mode: "ingredients-to-video", parentMediaItemId: mediaItemId });
    setSlotAssets((current) => ({ ...current, "ref-0": { assetId: mediaItemId, previewUrl: resultUrl ?? undefined } }));
    setMediaItemId(null);
    setResultUrl(null);
  }
  function handleConcatenate() {
    if (!mediaItemId) return;
    update({ mode: "concatenate-video", parentMediaItemId: mediaItemId });
    setSlotAssets((current) => ({ ...current, first: { assetId: mediaItemId, previewUrl: resultUrl ?? undefined } }));
    setMediaItemId(null);
    setResultUrl(null);
  }
  function handleDelete() {
    // ponytail: full gallery delete needs integer id + item_type (BulkDeleteDto); clearing the
    // local result is the safe parity baseline. Wire /api/gallery/bulk-delete when id typing is settled.
    setMediaItemId(null);
    setResultUrl(null);
  }

  const toolbarItems: OptionToolbarItem[] = [
    {
      id: "style",
      icon: <StyleIcon />,
      label: state.style ?? "Style",
      tooltip: "Select Style",
      kind: "menu",
      selected: !!state.style,
      options: VIDEO_STYLES.map((value) => ({ value, label: value, selected: state.style === value })),
      onSelect: (value) => update({ style: value }),
    },
    {
      id: "color",
      icon: <PaletteIcon />,
      label: state.colorAndTone ?? "Color & Tone",
      tooltip: "Select Color & Tone",
      kind: "menu",
      selected: !!state.colorAndTone,
      options: COLORS_AND_TONES.map((value) => ({ value, label: value, selected: state.colorAndTone === value })),
      onSelect: (value) => update({ colorAndTone: value }),
    },
    {
      id: "lighting",
      icon: <LightingIcon />,
      label: state.lighting ?? "Lighting",
      tooltip: "Select Lighting",
      kind: "menu",
      selected: !!state.lighting,
      options: LIGHTINGS.map((value) => ({ value, label: value, selected: state.lighting === value })),
      onSelect: (value) => update({ lighting: value }),
    },
    {
      id: "composition",
      icon: <CompositionIcon />,
      label: state.composition ?? "Composition",
      tooltip: "Select Composition",
      kind: "menu",
      selected: !!state.composition,
      options: COMPOSITIONS.map((value) => ({ value, label: value, selected: state.composition === value })),
      onSelect: (value) => update({ composition: value }),
    },
    {
      id: "audio",
      icon: state.generateAudio ? <VolumeUpIcon /> : <VolumeOffIcon />,
      label: `Audio ${state.generateAudio ? "On" : "Off"}`,
      tooltip: supportsAudio ? "Toggle Audio Generation" : "Audio not supported for this model",
      kind: "toggle",
      selected: !!state.generateAudio,
      disabled: !supportsAudio,
      onToggle: () => update({ generateAudio: !state.generateAudio }),
    },
    {
      id: "negative",
      icon: <BlockIcon />,
      label: `Negative Phrases (${phrases.length})`,
      tooltip: "Select Negative Phrases",
      kind: "menu",
      selected: phrases.length > 0,
      customMenu: (
        <NegativePhrasesMenu phrases={phrases} onAdd={addPhrase} onRemove={removePhrase} />
      ),
    },
    {
      id: "brand",
      icon: <ToggleIcon active={!!state.useBrandGuidelines} />,
      label: "Brand Guidelines",
      tooltip: "Enable Brand Guidelines",
      kind: "toggle",
      selected: !!state.useBrandGuidelines,
      onToggle: () => update({ useBrandGuidelines: !state.useBrandGuidelines }),
    },
    {
      id: "enhance",
      icon: <ToggleIcon active={!!state.enhancePrompt} />,
      label: "Enhance Prompt",
      tooltip: "Enhance Prompt with AI",
      kind: "toggle",
      selected: !!state.enhancePrompt,
      onToggle: () => update({ enhancePrompt: !state.enhancePrompt }),
    },
  ];

  return (
    <section aria-label="Video studio" className="mx-auto flex w-full max-w-5xl flex-col items-center gap-[var(--tri-space-6)]">
      <GenerationOverlay
        status={isProcessing ? "processing" : isFailed ? "failed" : null}
        title={isFailed ? "Video Generation Failed" : "Your video is being generated..."}
        message={isFailed ? submitError ?? undefined : undefined}
        onDismiss={isFailed ? () => setShowError(false) : undefined}
      />

      {!isCompleted ? (
        <StudioHero title="Generate Video Ads" />
      ) : null}

      {capabilitiesError ? (
        <p className="text-[var(--tri-state-error)]" role="alert">Capability registry unavailable: {capabilitiesError}</p>
      ) : null}

      {isCompleted ? (
        <div className="flex w-full flex-col gap-4">
          <MediaLightbox
            variant="video"
            media={{ url: resultUrl ?? undefined, prompt: state.prompt }}
            actions={{
              extendWithAi: handleExtendWithAi,
              editWithOmni: handleEditWithOmni,
              concatenate: handleConcatenate,
              delete: handleDelete,
            }}
          />
        </div>
      ) : null}

      <OptionToolbar items={toolbarItems} />

      <FlowPromptBox
        mode={currentModeLabel}
        modes={modes}
        onModeChange={(label) => {
          const next = FLOW_MODES.find((value) => MODE_LABELS[value] === label);
          if (next) update({ mode: next });
        }}
        model={modelOption}
        models={modelOptions}
        onModelChange={(value) => update({ generationModel: value })}
        aspectRatio={state.aspectRatio ?? aspectRatioOptions[0]?.value ?? "16:9"}
        aspectRatioOptions={aspectRatioOptions}
        onAspectRatioChange={(value) => update({ aspectRatio: value })}
        outputs={state.outputCount ?? 1}
        maxOutputs={maxOutputs}
        onOutputsChange={(value) => update({ outputCount: value })}
        duration={state.durationSeconds}
        durations={durationOptions ?? undefined}
        onDurationChange={durationOptions ? (value) => update({ durationSeconds: value }) : undefined}
        resolution={state.resolution}
        resolutions={resolutionOptions ?? undefined}
        onResolutionChange={resolutionOptions ? (value) => update({ resolution: value }) : undefined}
        prompt={state.prompt}
        onPromptChange={(value) => update({ prompt: value })}
        promptDisabled={isConcatenate}
        promptPlaceholder={isConcatenate ? "Prompt not needed for concatenation" : "Generate a video with text..."}
        isLoading={loading}
        onGenerate={handleSubmit}
        onRewrite={handleRewrite}
        generateDisabled={!activeWorkspace || !selectedModel || (!isConcatenate && !state.prompt.trim())}
        referenceSlots={
          referenceSlots.length ? (
            <ReferenceMediaStrip
              slots={referenceSlots}
              max={slotConfig.max}
              showDivider={slotConfig.showDivider}
              onOpen={(slot) => openPickerForSlot(slot.id)}
              onClear={(slot) => clearSlot(slot.id)}
              onEdit={(slot) => openPickerForSlot(slot.id)}
            />
          ) : null
        }
      />

      {pickerSlot ? (
        <AssetPicker
          type={pickerKind}
          onselect={onPickerSelect}
          onClose={() => setPickerSlot(null)}
        />
      ) : null}
    </section>
  );
}

/** Negative-phrases chip grid rendered inside OptionToolbar's `customMenu` escape hatch. */
function NegativePhrasesMenu({
  phrases,
  onAdd,
  onRemove,
}: {
  phrases: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  return (
    <div
      className="w-[20rem] p-2"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Negative phrases">
        {phrases.map((phrase) => (
          <li
            className="flex items-center gap-1 rounded-full bg-neutral-700 px-2 py-0.5 text-xs text-neutral-100"
            key={phrase}
          >
            <span>{phrase}</span>
            <button
              aria-label={`Remove ${phrase}`}
              className="text-neutral-300 hover:text-white"
              onClick={() => onRemove(phrase)}
              type="button"
            >
              <CloseIcon />
            </button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const input = event.currentTarget.elements.namedItem("phrase") as HTMLInputElement;
          onAdd(input.value);
          input.value = "";
        }}
      >
        <label className="sr-only" htmlFor="negative-phrase-input">New negative phrase</label>
        <input
          autoComplete="off"
          className="w-full rounded-md border border-white/10 bg-neutral-900 px-2 py-1 text-sm text-neutral-100 focus:outline-none"
          id="negative-phrase-input"
          name="phrase"
          placeholder="New phrase..."
        />
      </form>
    </div>
  );
}

/* Minimal 16px stroke icons — no new dependency, matches Angular mat-icon intent. */
function svgIcon(paths: React.ReactNode) {
  return (
    <svg
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      {paths}
    </svg>
  );
}
const StyleIcon = () => svgIcon(<><path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" /><path d="M9 20h6M12 4v16" /></>);
const PaletteIcon = () => svgIcon(<><circle cx={12} cy={12} r={9} /><circle cx={8.5} cy={9.5} r={1} fill="currentColor" /><circle cx={15.5} cy={9.5} r={1} fill="currentColor" /><circle cx={12} cy={15} r={1} fill="currentColor" /></>);
const LightingIcon = () => svgIcon(<><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" /></>);
const CompositionIcon = () => svgIcon(<><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx={12} cy={12} r={3} /></>);
const VolumeUpIcon = () => svgIcon(<><path d="M11 5 6 9H2v6h4l5 4V5Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" /></>);
const VolumeOffIcon = () => svgIcon(<><path d="M11 5 6 9H2v6h4l5 4V5Z" /><path d="m22 9-6 6M16 9l6 6" /></>);
const BlockIcon = () => svgIcon(<><circle cx={12} cy={12} r={9} /><path d="m5.6 5.6 12.8 12.8" /></>);
const CloseIcon = () => svgIcon(<><path d="M18 6 6 18M6 6l12 12" /></>);
function ToggleIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <rect height={12} rx={6} width={20} x={2} y={6} />
      <circle className={active ? "fill-current" : "fill-none"} cx={active ? 16 : 8} cy={12} r={3} />
    </svg>
  );
}
