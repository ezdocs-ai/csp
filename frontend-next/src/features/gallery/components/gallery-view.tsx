/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { useRouter } from "next/navigation";

import { Button, EmptyState, useToast } from "@/src/components/ui";
import { Filters, MediaCard, Pagination } from "@/src/components/media";
import {
  compositeKey,
  getShortPrompt,
  groupMediaByDate,
  isWideMedia,
  parseAspectRatio,
  selectionRange,
  type GalleryItem,
} from "../gallery-utils";
import { BulkActions } from "./bulk-actions";

const HINT_SEEN_KEY = "gallery_features_hint_seen";
const HINT_MESSAGE = "Click to select. Shift+click selects a range. Esc clears selection.";

export interface GalleryViewProps {
  media: GalleryItem[];
  currentPage: number;
  totalPages: number;
  /** Session email — drives the "Only my media" toggle. */
  userEmail: string;
  /** Numeric user id — drives the "My tags" toggle. */
  userId?: number;
  /** Show admin-only entries (e.g. Manage Tags). */
  isAdmin?: boolean;
  /** Workspace tag catalogue passed to the filter panel. */
  tags?: { name: string; userId?: number | null }[];
}

function mimeType(item: GalleryItem): string {
  return typeof item.metadata?.mimeType === "string" ? item.metadata.mimeType : "";
}

/** Gradient hero header — gallery-local approximation of Angular's "goo" gradient. */
function GalleryHero() {
  return (
    <header
      aria-label="Creative Studio Media Gallery"
      className="relative grid min-h-[260px] place-items-center overflow-hidden rounded-[var(--tri-radius-lg)] bg-[var(--tri-bg-surface-alt)] md:min-h-[320px]"
    >
      {/* Gradient blobs (decorative) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ filter: "blur(40px)" }}
      >
        <div className="absolute left-[8%] top-[10%] size-[45%] rounded-full bg-[var(--tri-brand-primary)] opacity-70" />
        <div className="absolute right-[10%] top-[5%] size-[35%] rounded-full bg-[var(--tri-brand-violet)] opacity-60" />
        <div className="absolute bottom-[5%] left-[35%] size-[40%] rounded-full bg-[var(--tri-brand-luminous)] opacity-50" />
      </div>
      <div className="relative z-[5] px-[var(--tri-space-6)] text-center text-white">
        <h1 className="!m-0 font-[var(--tri-font-display)] text-[var(--tri-text-h1-size)] font-[var(--tri-font-weight-bold)]">
          Creative Studio Media Gallery
        </h1>
        <p className="mt-[var(--tri-space-3)] text-[length:var(--tri-text-h5-size)]">
          A showcase of generated images, videos, audio and more ✨
        </p>
      </div>
    </header>
  );
}

/**
 * Gallery list client surface. Replaces the flat `<GalleryGrid/>` with
 * Angular-faithful date-grouped masonry + selection model + bulk bar.
 * Server fetch + workspace redirect live in `app/(studio)/gallery/page.tsx`.
 */
export function GalleryView({ media, currentPage, totalPages, userEmail, userId, isAdmin, tags = [] }: GalleryViewProps) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastIndex, setLastIndex] = useState<number | null>(null);

  // One-time features hint snackbar (Angular: localStorage "gallery_features_hint_seen").
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(HINT_SEEN_KEY)) return;
    window.localStorage.setItem(HINT_SEEN_KEY, "1");
    toast.show(HINT_MESSAGE, "info", "bottom-center");
  }, [toast]);

  // Esc clears selection (Angular @HostListener keydown.escape).
  useEffect(() => {
    if (selected.size === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setSelected(new Set());
        setLastIndex(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected.size]);

  const handleSelect = useCallback(
    (item: GalleryItem, event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const currentIndex = media.findIndex((m) => m.id === item.id && m.itemType === item.itemType);
      if (currentIndex === -1) return;
      const key = compositeKey(item);
      setSelected((prev) => {
        const next = new Set(prev);
        const range = event.shiftKey ? selectionRange(lastIndex, currentIndex) : null;
        if (range) {
          for (let i = range[0]; i <= range[1]; i++) {
            const r = media[i];
            if (r) next.add(compositeKey(r));
          }
        } else if (event.metaKey || event.ctrlKey) {
          if (next.has(key)) next.delete(key);
          else next.add(key);
        } else {
          if (next.has(key)) next.delete(key);
          else next.add(key);
        }
        return next;
      });
      setLastIndex(currentIndex);
    },
    [lastIndex, media],
  );

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setLastIndex(null);
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (media.length > 0 && selected.size === media.length) clearSelection();
    else {
      setSelected(new Set(media.map(compositeKey)));
      setLastIndex(null);
    }
  }, [clearSelection, media, selected.size]);

  const groups = useMemo(() => groupMediaByDate(media), [media]);
  const selectionArray = useMemo(() => Array.from(selected), [selected]);
  const reload = useCallback(() => router.refresh(), [router]);
  const anySelected = selected.size > 0;

  return (
    <section
      aria-label="Gallery"
      className="mx-auto grid max-w-[var(--tri-layout-wide)] gap-[var(--tri-space-6)] px-[var(--tri-layout-gutter)] py-[var(--tri-space-8)]"
    >
      <GalleryHero />

      <div className="flex flex-wrap items-center justify-between gap-[var(--tri-space-4)]">
        <Filters isAdmin={isAdmin} tags={tags} userEmail={userEmail} userId={userId} />
        {media.length > 0 ? (
          <Button
            aria-pressed={selected.size === media.length && media.length > 0}
            className="shrink-0"
            onClick={toggleSelectAll}
            variant="secondary"
          >
            {selected.size === media.length ? "Deselect all" : "Select all"}
          </Button>
        ) : null}
      </div>

      {groups.length > 0 ? (
        <div className="grid gap-[var(--tri-space-8)]">
          {groups.map((group) => (
            <section aria-label={`Media from ${group.title}`} key={group.title}>
              <h2 className="mb-[var(--tri-space-4)] px-[var(--tri-space-2)] font-[var(--tri-font-display)] text-[var(--tri-text-h4-size)] text-[var(--tri-text-primary)]">
                {group.title}
              </h2>
              <div className="grid grid-flow-dense grid-cols-2 gap-[var(--tri-grid-gap)] md:grid-cols-4">
                {group.items.map((item) => {
                  const ratio = parseAspectRatio(
                    typeof item.metadata?.aspectRatio === "string" ? item.metadata.aspectRatio : null,
                  );
                  const wide = isWideMedia(ratio, mimeType(item).startsWith("audio/"));
                  return (
                    <div className={wide ? "col-span-2" : undefined} key={compositeKey(item)}>
                      <MediaCard
                        anySelected={anySelected}
                        href={anySelected ? undefined : `/gallery/${item.id}`}
                        media={item}
                        onSelect={handleSelect}
                        selected={selected.has(compositeKey(item))}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          description="Change filters or create media in a studio."
          title="No media found"
        />
      )}

      <Pagination currentPage={currentPage} totalPages={totalPages} />

      {selectionArray.length > 0 ? (
        <BulkActions clear={clearSelection} onSuccess={reload} selection={selectionArray} />
      ) : null}
    </section>
  );
}

// Re-exported for callers that render media outside the gallery (e.g. VTO).
export { getShortPrompt };
