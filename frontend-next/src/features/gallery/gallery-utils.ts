/** Copyright 2026 Google LLC — Apache-2.0 */
/**
 * Pure helpers for gallery composition. Tested in
 * `__tests__/gallery-utils.test.ts`. No DOM/React imports.
 */
import type { components } from "@/src/lib/api/types";

export type GalleryItem = components["schemas"]["UnifiedGalleryItemResponse"];

export interface MediaGroup {
  title: string;
  items: GalleryItem[];
}

/**
 * Composite selection key. Angular uses `${itemType}:${id}` so media items and
 * source assets with the same numeric id never collide.
 */
export function compositeKey(item: { itemType: string; id: number | string }): string {
  return `${item.itemType}:${item.id}`;
}

/**
 * Group items by date, matching Angular `MediaGalleryComponent.updateGroups()`:
 * Today / Yesterday / "Mon D - D" (≤60d, weekly) / "Month YYYY" (>60d).
 * Items without createdAt are dropped (parity with Angular).
 */
export function groupMediaByDate(items: GalleryItem[], now: Date = new Date()): MediaGroup[] {
  const groupsMap = new Map<string, GalleryItem[]>();
  const groupOrder: string[] = [];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const getStartOfWeek = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day;
    return new Date(date.setDate(diff));
  };

  for (const item of items) {
    if (!item.createdAt) continue;
    const date = new Date(item.createdAt);
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    let groupName = "";
    const diffDays = (today.getTime() - dateOnly.getTime()) / (1000 * 3600 * 24);

    if (dateOnly.getTime() === today.getTime()) {
      groupName = "Today";
    } else if (dateOnly.getTime() === yesterday.getTime()) {
      groupName = "Yesterday";
    } else if (diffDays <= 60) {
      const startOfWeek = getStartOfWeek(dateOnly);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      const startOption: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
      const endOption: Intl.DateTimeFormatOptions = { day: "numeric" };
      groupName =
        startOfWeek.getMonth() !== endOfWeek.getMonth()
          ? `${startOfWeek.toLocaleDateString("en-US", startOption)} - ${endOfWeek.toLocaleDateString("en-US", startOption)}`
          : `${startOfWeek.toLocaleDateString("en-US", startOption)} - ${endOfWeek.toLocaleDateString("en-US", endOption)}`;
    } else {
      groupName = dateOnly.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }

    if (!groupsMap.has(groupName)) {
      groupsMap.set(groupName, []);
      groupOrder.push(groupName);
    }
    groupsMap.get(groupName)!.push(item);
  }

  return groupOrder.map((title) => ({ title, items: groupsMap.get(title)! }));
}

/** Parse "W:H" → number, or null if missing/invalid. */
export function parseAspectRatio(raw?: string | null): number | null {
  if (!raw) return null;
  const parts = raw.split(":").map(Number);
  if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1]) || parts[1] === 0) {
    return null;
  }
  return parts[0] / parts[1];
}

/** Angular `isWide()`: ratio ≥ 2, or audio fallback when ratio missing. */
export function isWideMedia(ratio: number | null, isAudio: boolean): boolean {
  if (ratio === null) return isAudio;
  return ratio >= 2;
}

/** Angular `isTall()`: ratio ≤ 0.5. */
export function isTallMedia(ratio: number | null): boolean {
  return ratio !== null && ratio <= 0.5;
}

/**
 * Shift+click range selection math. Returns inclusive `[start, end]` indices,
 * or null when there is no anchor (first click). Mirrors Angular's
 * `toggleSelection()` shift branch.
 */
export function selectionRange(anchorIndex: number | null, currentIndex: number): [number, number] | null {
  if (anchorIndex === null) return null;
  return [Math.min(anchorIndex, currentIndex), Math.max(anchorIndex, currentIndex)];
}

/**
 * Parse a JSON-encoded prompt and return a short word-limited label.
 * Mirrors Angular `GalleryCardComponent.getShortPrompt()`.
 */
export function getShortPrompt(prompt?: string | null, wordLimit = 20): string {
  if (!prompt) return "Generated media";
  let text = prompt;
  try {
    const parsed = JSON.parse(prompt);
    if (parsed && typeof parsed === "object" && parsed.prompt_name) {
      text = parsed.prompt_name as string;
    }
  } catch {
    // Not JSON — use raw prompt.
  }
  const words = text.split(/\s+/);
  return words.length > wordLimit ? `${words.slice(0, wordLimit).join(" ")}...` : text;
}
