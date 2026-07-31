/** Copyright 2026 Google LLC — Apache-2.0 */

import { requireUser } from "@/src/lib/auth/server";

import { AudioStudio } from "@/src/features/audio-studio";

type SearchParams = Record<string, string | string[] | undefined>;

function stringValue(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default async function AudioPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireUser();
  const params = await searchParams;
  // Hydrate only the audio fields the studio state actually supports
  // (prompt + negativePrompt). Model is an AudioModel union and does not map to a
  // template's vendor model string, so it is intentionally not wired.
  const initialState: { prompt?: string; negativePrompt?: string } = {};
  const prompt = stringValue(params.prompt);
  if (prompt) initialState.prompt = prompt;
  const negativePrompt = stringValue(params.negativePrompt);
  if (negativePrompt) initialState.negativePrompt = negativePrompt;
  return <AudioStudio initialState={initialState} />;
}
