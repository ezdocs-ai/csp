/** Copyright 2026 Google LLC — Apache-2.0 */

import type { BadgeTone } from "@/src/components/ui";

export type GuidelineBadge = { label: string; tone: BadgeTone };

const TERMINAL: Record<string, GuidelineBadge> = {
  completed: { label: "✓ Ready", tone: "success" },
  failed: { label: "! Failed", tone: "danger" },
  stopped: { label: "! Stopped", tone: "warning" },
};

/** Maps a backend job status to a status badge. Matches Angular dialog labels. */
export function guidelineBadge(status: string | undefined, loading = false): GuidelineBadge {
  if (loading || !status || status === "processing") return { label: "○ Processing", tone: "info" };
  return TERMINAL[status] ?? { label: "○ Processing", tone: "info" };
}
