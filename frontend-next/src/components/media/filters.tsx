/* Copyright 2026 Google LLC
 * Licensed under Apache-2.0 */
"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button, Field, Input } from "@/src/components/ui";
import {
  ASSET_TYPE_OPTIONS,
  MEDIA_TYPE_OPTIONS,
  filterModelOptions,
  isModelValidForType,
  parseTagsParam,
  serializeTagsParam,
  toggleTag,
} from "@/src/features/gallery/gallery-filters";

export interface FiltersProps {
  /** Current session email — drives "Only my media". */
  userEmail: string;
  /** Numeric user id — enables "My tags" client-side filtering. */
  userId?: number;
  /** Show the admin "Manage Tags" entry when true. */
  isAdmin?: boolean;
  /** Workspace tag catalogue: name + creator id. */
  tags: { name: string; userId?: number | null }[];
}

const SELECT_CLASS =
  "h-[var(--tri-input-height)] w-full rounded-[var(--tri-input-radius)] border border-[var(--tri-input-border)] bg-[var(--tri-input-bg)] px-[var(--tri-input-padding-inline)] text-[var(--tri-text-primary)]";

/**
 * Gallery filter panel — ports Angular `media-gallery.component.html` filter
 * anatomy: a permanent row (search + date range + Filters toggle) and a
 * collapsible advanced panel (media type + generation model + asset type +
 * searchable tags multi-select + "My tags" / "Only my media" toggles + admin
 * "Manage Tags" entry). All state is encoded in URL search params, which the
 * gallery list server page reads. Consumed as `<Filters {...} />`.
 */
export function Filters({ userEmail, userId, isAdmin, tags }: FiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [expanded, setExpanded] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  // "My tags" defaults to true when the numeric user id is resolvable (Angular
  // parity); otherwise it is a no-op showing all tags.
  const [onlyMyTags, setOnlyMyTags] = useState(userId != null);

  // Apply one or more param changes atomically (avoids stale-snapshot races).
  const apply = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    router.replace(`?${params.toString()}`);
  };

  // Angular parity: a search term containing "@" targets a user email.
  const updateSearch = (value: string) => {
    const target = value.includes("@") ? "owner" : "query";
    const other = target === "owner" ? "query" : "owner";
    apply(value ? { [target]: value, [other]: null } : { query: null, owner: null });
  };

  const update = (key: string, value: string) => apply({ [key]: value });

  // Angular `onMediaTypeChange`: reset the model filter if it is no longer valid
  // for the newly selected media type.
  const onMediaTypeChange = (value: string) => {
    const currentModel = searchParams.get("model");
    const model = currentModel && !isModelValidForType(currentModel, value) ? null : currentModel;
    apply({ type: value, model });
  };

  const selectedTags = parseTagsParam(searchParams.get("tags"));
  const setTags = (next: string[]) => apply({ tags: serializeTagsParam(next) });

  const onlyMyMedia = searchParams.get("mine") === "1";
  const toggleOnlyMyMedia = () => apply({ mine: onlyMyMedia ? null : "1" });

  const mediaType = searchParams.get("type") ?? "";
  const modelOptions = useMemo(() => filterModelOptions(mediaType), [mediaType]);

  const visibleTags = useMemo(() => {
    const pool = onlyMyTags && userId != null ? tags.filter((t) => t.userId === userId) : tags;
    const q = tagSearch.trim().toLowerCase();
    const names = q ? pool.filter((t) => t.name.toLowerCase().includes(q)) : pool;
    return [...new Set(names.map((t) => t.name))].sort((a, b) => a.localeCompare(b));
  }, [onlyMyTags, userId, tags, tagSearch]);

  const myTagsCount = userId != null ? tags.filter((t) => t.userId === userId).length : 0;

  return (
    <div className="flex w-full flex-col gap-[var(--tri-space-3)]">
      <div className="flex flex-wrap items-end gap-[var(--tri-space-3)]">
        <div className="w-full md:w-96">
          <Field htmlFor="gallery-search" label="Search">
            <Input
              defaultValue={searchParams.get("query") ?? searchParams.get("owner") ?? ""}
              id="gallery-search"
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search prompt, model or email..."
              type="search"
            />
          </Field>
        </div>
        <Field htmlFor="gallery-startDate" label="From">
          <input
            className={SELECT_CLASS}
            defaultValue={searchParams.get("startDate") ?? ""}
            id="gallery-startDate"
            onChange={(event) => update("startDate", event.target.value)}
            type="date"
          />
        </Field>
        <Field htmlFor="gallery-endDate" label="To">
          <input
            className={SELECT_CLASS}
            defaultValue={searchParams.get("endDate") ?? ""}
            id="gallery-endDate"
            onChange={(event) => update("endDate", event.target.value)}
            type="date"
          />
        </Field>
        <Button
          aria-controls="gallery-advanced-filters"
          aria-expanded={expanded}
          className="shrink-0"
          onClick={() => setExpanded((value) => !value)}
          variant="secondary"
        >
          {expanded ? "Hide filters" : "Filters"}
        </Button>
      </div>

      {expanded ? (
        <div
          className="grid gap-[var(--tri-space-3)] rounded-[var(--tri-radius-md)] border border-[var(--tri-border-subtle)] bg-[var(--tri-bg-surface-alt)] p-[var(--tri-space-4)] sm:grid-cols-2 xl:grid-cols-3"
          id="gallery-advanced-filters"
        >
          <Field htmlFor="gallery-type" label="Media Type">
            <select
              className={SELECT_CLASS}
              defaultValue={mediaType}
              id="gallery-type"
              onChange={(event) => onMediaTypeChange(event.target.value)}
            >
              {MEDIA_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field htmlFor="gallery-model" label="Generation Model">
            {/* key forces remount when media-type change resets the model, so the
              uncontrolled defaultValue stays in sync with the URL. */}
            <select
              className={SELECT_CLASS}
              defaultValue={searchParams.get("model") ?? ""}
              id="gallery-model"
              key={`gallery-model-${searchParams.get("model") ?? ""}`}
              onChange={(event) => update("model", event.target.value)}
            >
              {modelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field htmlFor="gallery-itemType" label="Asset Type">
            <select
              className={SELECT_CLASS}
              defaultValue={searchParams.get("itemType") ?? ""}
              id="gallery-itemType"
              onChange={(event) => update("itemType", event.target.value)}
            >
              {ASSET_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          {/* Tags: searchable multi-select spanning the full panel width. */}
          <div className="sm:col-span-2 xl:col-span-3">
            <div className="grid gap-[var(--tri-space-2)]">
              <label
                className="text-[var(--tri-text-small-size)] font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-secondary)]"
                htmlFor="gallery-tag-search"
              >
                Tags
              </label>
              <Input
                id="gallery-tag-search"
                onChange={(event) => setTagSearch(event.target.value)}
                placeholder="Search tags..."
                type="search"
                value={tagSearch}
              />
              {selectedTags.length > 0 ? (
                <div className="flex flex-wrap gap-[var(--tri-space-2)]">
                  {selectedTags.map((name) => (
                    <button
                      className="inline-flex min-h-[var(--tri-badge-height)] items-center gap-[var(--tri-space-1)] rounded-[var(--tri-badge-radius)] bg-[var(--tri-badge-info)] px-[var(--tri-badge-padding-inline)] text-[var(--tri-brand-on-primary)]"
                      key={name}
                      onClick={() => setTags(toggleTag(selectedTags, name))}
                      title={`Remove ${name}`}
                      type="button"
                    >
                      <span>{name}</span>
                      <span aria-hidden="true">✕</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <ul className="grid max-h-44 gap-[var(--tri-space-1)] overflow-y-auto">
                {visibleTags.length === 0 ? (
                  <li className="px-[var(--tri-space-1)] py-[var(--tri-space-2)] text-[var(--tri-text-tertiary)]">
                    {tags.length === 0 ? "No tags in this workspace." : "No matching tags."}
                  </li>
                ) : (
                  visibleTags.map((name) => {
                    const checked = selectedTags.includes(name);
                    return (
                      <li key={name}>
                        <label className="flex min-h-[var(--tri-input-height)] cursor-pointer items-center gap-[var(--tri-space-2)] rounded-[var(--tri-input-radius)] px-[var(--tri-space-2)] hover:bg-[var(--tri-button-ghost-hover)]">
                          <input
                            checked={checked}
                            onChange={() => setTags(toggleTag(selectedTags, name))}
                            type="checkbox"
                          />
                          <span className="text-[var(--tri-text-primary)]">{name}</span>
                        </label>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          </div>

          {/* Toggle row + admin entry. */}
          <div className="flex flex-wrap items-center gap-[var(--tri-space-5)] sm:col-span-2 xl:col-span-3">
            <label className="flex min-h-[var(--tri-input-height)] cursor-pointer items-center gap-[var(--tri-space-2)]">
              <input
                checked={onlyMyTags}
                disabled={userId == null}
                onChange={(event) => setOnlyMyTags(event.target.checked)}
                type="checkbox"
              />
              <span className="text-[var(--tri-text-secondary)]">
                My tags{userId == null ? "" : ` (${myTagsCount})`}
              </span>
            </label>
            <label className="flex min-h-[var(--tri-input-height)] cursor-pointer items-center gap-[var(--tri-space-2)]">
              <input checked={onlyMyMedia} onChange={toggleOnlyMyMedia} type="checkbox" />
              <span className="text-[var(--tri-text-secondary)]">Only my media{userEmail ? ` (${userEmail})` : ""}</span>
            </label>
            {isAdmin ? (
              <Button
                className="ml-auto shrink-0"
                onClick={() => router.push("/admin/tags")}
                title="Manage Tags"
                variant="ghost"
              >
                Manage Tags
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
