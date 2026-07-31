/** Copyright 2026 Google LLC — Apache-2.0 */

/**
 * Pure mode → reference-slot mapping for the video flow-prompt-box.
 * Mirrors Angular `flow-prompt-box.component.html` slot gating:
 *   Frames      → 2 image slots + compare divider
 *   Concatenate → 2 video slots + compare divider
 *   Extend      → 1 video slot
 *   Ingredients → N image ref slots (+ video/audio ref when model is Gemini Omni)
 *   Text        → none
 */
export type SlotKind = "image" | "video" | "audio";

export type SlotConfig = { id: string; kind: SlotKind; label: string };

export type ModeSlotResult = { slots: SlotConfig[]; showDivider: boolean; max?: number };

export function modeSlotConfig(
  mode: string,
  opts: { maxReferenceImages?: number; isOmni?: boolean } = {},
): ModeSlotResult {
  switch (mode) {
    case "frames-to-video":
      return {
        slots: [
          { id: "start", kind: "image", label: "Start frame" },
          { id: "end", kind: "image", label: "End frame" },
        ],
        showDivider: true,
      };
    case "concatenate-video":
      return {
        slots: [
          { id: "first", kind: "video", label: "First video" },
          { id: "second", kind: "video", label: "Second video" },
        ],
        showDivider: true,
      };
    case "extend-video":
      return { slots: [{ id: "source", kind: "video", label: "Source video" }], showDivider: false };
    case "ingredients-to-video": {
      // ponytail: registry lacks maxReferenceImages; CreateVeoDto caps referenceImages at 3.
      const max = Math.max(1, opts.maxReferenceImages ?? 3);
      const slots: SlotConfig[] = Array.from({ length: max }, (_, i) => ({
        id: `ref-${i}`,
        kind: "image",
        label: `Reference ${i + 1}`,
      }));
      if (opts.isOmni) {
        slots.push({ id: "ref-video", kind: "video", label: "Video reference" });
        slots.push({ id: "ref-audio", kind: "audio", label: "Audio reference" });
      }
      return { slots, showDivider: false, max };
    }
    default:
      return { slots: [], showDivider: false };
  }
}
