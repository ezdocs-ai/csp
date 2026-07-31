/** Copyright 2026 Google LLC — Apache-2.0 */

export type AudioModel = "lyria" | "chirp" | "gemini-tts";

export type AudioGenerationRequest = {
  workspaceId: number;
  model: AudioModel;
  prompt?: string;
  negativePrompt?: string;
  text?: string;
  voiceName?: string;
  languageCode?: string;
  sampleCount?: number;
  seed?: number;
};

export type AudioGenerationResponse = {
  mediaItemId: string;
};

/**
 * Labels mirror Angular's mat-button-toggle-group (audio.component.html):
 * "Lyria (Music)" / "Chirp TTS" / "Gemini TTS".
 */
export const AUDIO_MODELS: { value: AudioModel; label: string; description: string }[] = [
  { value: "lyria", label: "Lyria (Music)", description: "Music generation from prompt" },
  { value: "chirp", label: "Chirp TTS", description: "Speech generation" },
  { value: "gemini-tts", label: "Gemini TTS", description: "Text-to-speech" },
];

/**
 * Model → which config fields are visible. Mirrors the two *ngIf branches in
 * audio.component.html (Lyria vs Chirp/Gemini TTS). Pure + unit-tested.
 */
export function audioFieldsFor(model: AudioModel): {
  prompt: boolean;
  negativePrompt: boolean;
  seed: boolean;
  text: boolean;
  language: boolean;
  voice: boolean;
  sampleCount: boolean;
} {
  const isLyria = model === "lyria";
  return {
    prompt: isLyria,
    negativePrompt: isLyria,
    seed: isLyria,
    text: !isLyria,
    language: !isLyria,
    voice: !isLyria,
    sampleCount: true,
  };
}
