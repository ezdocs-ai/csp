/** Copyright 2026 Google LLC — Apache-2.0 */
import { ImageStudio, type ImageGenerationRequest } from "@/src/features/image-studio";
import { requireUser } from "@/src/lib/auth/server";

type SearchParams = Record<string, string | string[] | undefined>;

function stringValue(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default async function StudioHome({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireUser();
  const params = await searchParams;
  // Hydrate the image studio from template handoff URL params (UseTemplateButton)
  // and any workspace override. Only ImageGenerationRequest fields are mapped.
  const initialState: Partial<ImageGenerationRequest> = {};
  const prompt = stringValue(params.prompt);
  if (prompt) initialState.prompt = prompt;
  const workspaceId = Number(stringValue(params.workspaceId));
  if (Number.isInteger(workspaceId) && workspaceId > 0) initialState.workspaceId = workspaceId;
  const model = stringValue(params.model);
  if (model) initialState.generationModel = model;
  const aspectRatio = stringValue(params.aspectRatio);
  if (aspectRatio) initialState.aspectRatio = aspectRatio;
  const style = stringValue(params.style);
  if (style) initialState.style = style;
  const colorAndTone = stringValue(params.colorAndTone);
  if (colorAndTone) initialState.colorAndTone = colorAndTone;
  const lighting = stringValue(params.lighting);
  if (lighting) initialState.lighting = lighting;
  const composition = stringValue(params.composition);
  if (composition) initialState.composition = composition;
  const negativePrompt = stringValue(params.negativePrompt);
  if (negativePrompt) initialState.negativePrompt = negativePrompt;
  const sourceAssetIds = stringValue(params.sourceAssetIds)
    ?.split(",")
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);
  if (sourceAssetIds?.length) initialState.sourceAssetIds = sourceAssetIds;
  return <ImageStudio initialState={initialState} />;
}
