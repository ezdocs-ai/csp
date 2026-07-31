/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useCallback, useState, type KeyboardEvent } from "react";

import { GenerationOverlay } from "@/src/components/studio/generation-overlay";
import { MediaLightbox } from "@/src/components/studio/media-lightbox";
import { StudioHero } from "@/src/components/studio/studio-hero";
import { useMediaJob } from "@/src/lib/hooks/use-media-job";
import { useWorkspace } from "@/src/lib/workspace";

import { DEFAULT_LANGUAGE, DEFAULT_VOICE, LANGUAGES, VOICES } from "../audio-constants";
import { useAudioSubmit } from "../hooks/use-audio-submit";
import { audioFieldsFor, AUDIO_MODELS, type AudioGenerationRequest, type AudioModel } from "../types";

// ponytail: abstract-waves.mp4 is NOT present under public/assets/videos/ (only
// google-deepmind-veo3.mp4 lives there). Using the gradient StudioHero variant to
// avoid a 404. Add `public/assets/videos/abstract-waves.mp4` then pass
// `backgroundVideoSrc="/assets/videos/abstract-waves.mp4"` to StudioHero.

const CONTROL_CLASS =
  "min-h-[44px] w-full rounded-[var(--tri-radius-md)] border border-[var(--tri-border-default)] bg-[var(--tri-bg-surface)] px-[var(--tri-space-3)] text-[var(--tri-text-primary)]";

export function AudioStudio({ initialState = {} }: { initialState?: { prompt?: string; negativePrompt?: string } }) {
  const { activeWorkspace } = useWorkspace();
  const [model, setModel] = useState<AudioModel>("lyria");
  const [prompt, setPrompt] = useState(initialState.prompt ?? "");
  const [negativePrompt, setNegativePrompt] = useState(initialState.negativePrompt ?? "");
  const [seed, setSeed] = useState("");
  const [sampleCount, setSampleCount] = useState(4);
  const [voiceName, setVoiceName] = useState<string>(DEFAULT_VOICE);
  const [languageCode, setLanguageCode] = useState<string>(DEFAULT_LANGUAGE);
  const [mediaItemId, setMediaItemId] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [dismissError, setDismissError] = useState(false);

  const { submit, loading, error } = useAudioSubmit();
  const fields = audioFieldsFor(model);

  const getStatus = useCallback(async () => {
    if (!mediaItemId) return null;
    const res = await fetch(`/api/audio/${mediaItemId}`);
    if (!res.ok) return { status: "failed" as const };
    const data = await res.json();
    if (data.status === "completed" && data.presignedUrls?.[0]) setResultUrl(data.presignedUrls[0]);
    return { status: (data.status ?? "processing") as "processing" | "completed" | "failed" | "stopped" };
  }, [mediaItemId]);

  const pollStatus = useMediaJob(getStatus, 15000, !!mediaItemId);

  const isProcessing = !!mediaItemId && pollStatus.status === "processing";
  const isFailed = pollStatus.status === "failed";

  async function handleSubmit() {
    if (!activeWorkspace) return;
    setDismissError(false);
    setMediaItemId(null);
    setResultUrl(null);
    // Angular uses a single `prompt` field for both music description and TTS
    // text; CreateAudioDto also exposes a single `prompt`. TTS text lives here too.
    const req: AudioGenerationRequest = {
      workspaceId: Number(activeWorkspace.id),
      model,
      prompt,
      negativePrompt: fields.negativePrompt ? negativePrompt || undefined : undefined,
      seed: fields.seed ? (seed ? Number(seed) : undefined) : undefined,
      sampleCount,
      voiceName: fields.voice ? voiceName || undefined : undefined,
      languageCode: fields.language ? languageCode : undefined,
    };
    const result = await submit(req);
    if (result?.mediaItemId) setMediaItemId(result.mediaItemId);
  }

  function onKeyDownGenerate(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSubmit();
    }
  }

  const promptLabel = fields.text ? "Text to Speech" : "Prompt";
  const promptPlaceholder = fields.text ? "Enter text to speak…" : "Describe the music…";

  return (
    <div className="flex flex-col gap-[var(--tri-space-8)]">
      <StudioHero icon={<SparkIcon />} title="Describe Your Sound" />

      <GenerationOverlay
        message={isFailed && error ? error : undefined}
        onDismiss={isFailed ? () => setDismissError(true) : undefined}
        status={isProcessing ? "processing" : isFailed && !dismissError ? "failed" : null}
        title={isFailed ? "Audio Generation Failed" : "Your audio is being generated…"}
      />

      {resultUrl && pollStatus.status === "completed" ? (
        <MediaLightbox
          media={{ prompt, url: resultUrl }}
          variant="audio"
        />
      ) : null}

      <div className="rounded-[var(--tri-radius-lg)] border border-[var(--tri-border-default)] bg-neutral-900/60 p-[var(--tri-space-5)] backdrop-blur-md">
        <fieldset
          aria-label="Select Model"
          className="grid grid-cols-3 gap-1 rounded-full border border-[var(--tri-border-default)] bg-[var(--tri-bg-surface)] p-1"
          role="radiogroup"
        >
          {AUDIO_MODELS.map((m) => (
            <label
              className={`flex min-h-[44px] cursor-pointer items-center justify-center rounded-full text-sm font-[var(--tri-font-weight-semibold)] transition-colors ${model === m.value ? "bg-[var(--tri-brand-primary)] text-[var(--tri-button-primary-fg)]" : "text-[var(--tri-text-secondary)] hover:bg-[var(--tri-bg-surface-alt)]"}`}
              data-checked={model === m.value}
              key={m.value}
            >
              <input
                aria-label={m.label}
                checked={model === m.value}
                className="sr-only"
                name="audio-model"
                onChange={() => setModel(m.value)}
                type="radio"
                value={m.value}
              />
              {m.label}
            </label>
          ))}
        </fieldset>

        <hr aria-hidden className="my-[var(--tri-space-5)] border-[var(--tri-border-default)]" />

        <div className="grid gap-[var(--tri-space-4)]">
          <label className="grid gap-[var(--tri-space-2)]">
            <span className="text-[var(--tri-text-small-size)] font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-secondary)]">
              {promptLabel}
            </span>
            <textarea
              aria-label={promptLabel}
              className="min-h-[120px] w-full rounded-[var(--tri-radius-md)] border border-[var(--tri-border-default)] bg-[var(--tri-bg-surface)] p-[var(--tri-space-3)] text-[var(--tri-text-primary)]"
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={onKeyDownGenerate}
              placeholder={promptPlaceholder}
              value={prompt}
            />
            <span className="text-[var(--tri-text-small-size)] text-[var(--tri-text-tertiary)]">
              Press Ctrl/Cmd + Enter to generate
            </span>
          </label>

          {fields.negativePrompt ? (
            <label className="grid gap-[var(--tri-space-2)]">
              <span className="text-[var(--tri-text-small-size)] font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-secondary)]">
                Negative Prompt
              </span>
              <input
                aria-label="Negative prompt"
                className={CONTROL_CLASS}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="What to avoid"
                value={negativePrompt}
              />
            </label>
          ) : null}

          {fields.seed ? (
            <label className="grid gap-[var(--tri-space-2)]">
              <span className="text-[var(--tri-text-small-size)] font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-secondary)]">
                Seed
              </span>
              <input
                aria-label="Seed"
                className={CONTROL_CLASS}
                min={0}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="Random"
                type="number"
                value={seed}
              />
            </label>
          ) : null}

          {fields.language ? (
            <label className="grid gap-[var(--tri-space-2)]">
              <span className="text-[var(--tri-text-small-size)] font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-secondary)]">
                Language
              </span>
              <select
                aria-label="Language"
                className={CONTROL_CLASS}
                onChange={(e) => setLanguageCode(e.target.value)}
                value={languageCode}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
            </label>
          ) : null}

          {fields.voice ? (
            <label className="grid gap-[var(--tri-space-2)]">
              <span className="text-[var(--tri-text-small-size)] font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-secondary)]">
                Voice
              </span>
              {/* ponytail: no voice-clone endpoint in openapi.json (only
                  /api/audios/generate + /api/audios/transcribe). Angular's
                  AddVoiceDialogComponent has no backend. "Add your voice" is
                  rendered disabled; wire when POST /api/audios/clone lands. */}
              <select
                aria-label="Voice"
                className={CONTROL_CLASS}
                onChange={(e) => setVoiceName(e.target.value)}
                title="Custom voice cloning is not yet available"
                value={voiceName}
              >
                <option disabled value="__add_voice__">Add your voice (coming soon)</option>
                {VOICES.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="grid gap-[var(--tri-space-2)]">
            <span className="text-[var(--tri-text-small-size)] font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-secondary)]">
              Results
            </span>
            <select
              aria-label="Number of results"
              className={CONTROL_CLASS}
              onChange={(e) => setSampleCount(Number(e.target.value))}
              value={sampleCount}
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-[var(--tri-space-5)]">
          <button
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-[var(--tri-space-2)] rounded-[var(--tri-button-radius)] bg-[var(--tri-button-primary-bg)] px-[var(--tri-button-padding-inline)] text-[var(--tri-button-primary-fg)] font-[var(--tri-font-weight-semibold)] transition-[var(--tri-button-transition)] hover:bg-[var(--tri-button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-[var(--tri-opacity-disabled)]"
            disabled={loading || isProcessing || !activeWorkspace || !prompt.trim()}
            onClick={() => void handleSubmit()}
            type="button"
          >
            {loading || isProcessing ? <Spinner /> : null}
            {loading || isProcessing ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white"
    />
  );
}

function SparkIcon() {
  return (
    <svg
      aria-hidden
      className="size-12 text-white"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3Z" />
      <path d="M5 3v4M19 17v4M3 5h4M17 19h4" />
    </svg>
  );
}
