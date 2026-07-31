/** Copyright 2026 Google LLC — Apache-2.0 */
export type UpscaleRequest = {
  workspaceId: number;
  sourceAssetId?: string;
  mediaItemId?: string;
  factor: 2 | 4;
  enhance_input_image?: boolean;
  image_preservation_factor?: number | null;
};
export type UpscaleResponse = { mediaItemId: string };

/**
 * Maps an UpscaleRequest to the multipart form expected by the backend
 * `/api/images/upload-upscale` endpoint (Form aliases: id, mediaItemId,
 * workspaceId, upscaleFactor, enhance_input_image, image_preservation_factor).
 * Factor 2|4 -> "x2"|"x4" to match the backend Literal["x2","x3","x4"].
 */
export function buildUpscaleFormData(request: UpscaleRequest): FormData {
  const form = new FormData();
  form.set("workspaceId", String(request.workspaceId));
  form.set("upscaleFactor", `x${request.factor}`);
  if (request.sourceAssetId) form.set("id", request.sourceAssetId);
  if (request.mediaItemId) form.set("mediaItemId", request.mediaItemId);
  if (typeof request.enhance_input_image === "boolean") {
    form.set("enhance_input_image", String(request.enhance_input_image));
  }
  if (request.image_preservation_factor !== null && request.image_preservation_factor !== undefined) {
    form.set("image_preservation_factor", String(request.image_preservation_factor));
  }
  return form;
}
