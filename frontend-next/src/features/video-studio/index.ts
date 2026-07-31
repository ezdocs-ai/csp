/** Copyright 2026 Google LLC — Apache-2.0 */

export { VideoStudio } from "./components/video-studio";
export { useVideoState } from "./hooks/use-video-state";
export { useVideoSubmit } from "./hooks/use-video-submit";
export {
  pickModel,
  safeAspectRatios,
  safeDurations,
  safeMaxOutputs,
  safeResolutions,
  useVideoCapabilities,
} from "./hooks/use-video-capabilities";
export type {
  ModelDefaults,
  VideoCapabilities,
  VideoGenerationOptions,
  VideoGenerationRequest,
  VideoGenerationResponse,
  VideoMode,
  VideoModelOption,
} from "./types";
