/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";
import { useRouter } from "next/navigation";

import { Button } from "@/src/components/ui/button";

/** Subset of a template needed to build the studio handoff. */
type HandoffTemplate = {
  id: number;
  mimeType?: string;
  generationParameters?: {
    prompt?: string | null;
    model?: string | null;
    aspectRatio?: string | null;
    style?: string | null;
    lighting?: string | null;
    colorAndTone?: string | null;
    composition?: string | null;
    negativePrompt?: string | null;
  };
  sourceAssets?: { assetId: number }[] | null;
  enrichedSourceAssets?: { assetId: number }[] | null;
};

export type StudioRoute = "/video" | "/audio" | "/vto" | "/";
export type DerivedMediaType = "image" | "video" | "audio" | "vto" | undefined;

/** Derive the studio media type from a backend mimeType. */
export function deriveMediaType(mimeType?: string): DerivedMediaType {
  if (!mimeType) return undefined;
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "image";
}

/**
 * Resolve the studio route for a template. Matches Angular `useTemplate`:
 * video → /video, everything else → / (image home). Audio is routed to /audio
 * (Angular lumps audio into "/", but the audio mime has a dedicated studio whose
 * state types support prompt/negativePrompt, so we hydrate it directly).
 */
export function studioRouteFor(mimeType?: string): StudioRoute {
  const type = deriveMediaType(mimeType);
  if (type === "video") return "/video";
  if (type === "audio") return "/audio";
  if (type === "vto") return "/vto";
  return "/";
}

/**
 * Build the URL params that hydrate a target studio from a template. Settings live
 * under `generationParameters` (the real MediaTemplate shape); only fields a
 * studio consumes are forwarded. Source-asset ids come from `enrichedSourceAssets`
 * (list) or fall back to `sourceAssets` (detail).
 */
export function buildTemplateParams(template: HandoffTemplate): URLSearchParams {
  const gen = template.generationParameters ?? {};
  const params = new URLSearchParams();
  params.set("templateId", String(template.id));
  if (gen.prompt) params.set("prompt", gen.prompt);
  if (gen.model) params.set("model", gen.model);
  if (gen.aspectRatio) params.set("aspectRatio", gen.aspectRatio);
  if (gen.style) params.set("style", gen.style);
  if (gen.lighting) params.set("lighting", gen.lighting);
  if (gen.colorAndTone) params.set("colorAndTone", gen.colorAndTone);
  if (gen.composition) params.set("composition", gen.composition);
  if (gen.negativePrompt) params.set("negativePrompt", gen.negativePrompt);
  const assetIds = (template.enrichedSourceAssets ?? template.sourceAssets ?? [])
    .map((asset) => asset.assetId)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .map(String);
  if (assetIds.length) params.set("sourceAssetIds", assetIds.join(","));
  return params;
}

export function UseTemplateButton({ template }: { template: HandoffTemplate }) {
  const router = useRouter();
  function useTemplate() {
    router.push(`${studioRouteFor(template.mimeType)}?${buildTemplateParams(template)}`);
  }
  return (
    <Button className="min-h-11" onClick={useTemplate} type="button">
      Use template
    </Button>
  );
}
