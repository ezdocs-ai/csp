/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useEffect, useState } from "react";

import { Dialog } from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { UploadDropzone } from "@/src/components/media/upload-dropzone";
import type { SourceAsset as Asset } from "@/src/features/source-assets/types";
import { useWorkspace } from "@/src/lib/workspace";

type Props = {
  type: "image" | "video" | "audio";
  multiple?: boolean;
  onselect: (assets: Asset[]) => void;
  onClose: () => void;
};

function CheckIcon() {
  return (
    <svg
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={3}
      viewBox="0 0 24 24"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function AssetPicker({
  type,
  multiple = false,
  onselect,
  onClose,
}: Props) {
  const { activeWorkspace } = useWorkspace();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selected, setSelected] = useState<Asset[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"browse" | "upload">("browse");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/source-assets?type=${type}`)
      .then(async (response) =>
        response.ok ? response.json() : Promise.reject(),
      )
      .then((data) => setAssets(data.data ?? data.items ?? []))
      .catch(() => setAssets([]));
  }, [type]);

  const filtered = assets.filter((asset) =>
    asset.name.toLowerCase().includes(search.toLowerCase()),
  );

  const toggle = (asset: Asset) =>
    setSelected((current) =>
      current.some(({ id }) => String(id) === String(asset.id))
        ? current.filter(({ id }) => String(id) !== String(asset.id))
        : multiple
          ? [...current, asset]
          : [asset],
    );

  const handleUpload = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    setUploadError(null);
    try {
      const newAssets: Asset[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        if (activeWorkspace?.id) {
          formData.append("workspaceId", String(activeWorkspace.id));
        }

        const res = await fetch("/api/source-assets", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Upload failed for ${file.name}`);
        }
        const created: Asset = await res.json();
        newAssets.push(created);
      }

      setAssets((prev) => [...newAssets, ...prev]);
      setSelected((prev) => (multiple ? [...prev, ...newAssets] : [newAssets[0]]));
      setActiveTab("browse");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog onClose={onClose} open size="lg" title={`Select ${type} asset`}>
      <div className="mt-[var(--tri-space-4)] space-y-[var(--tri-space-4)]">
        {/* Navigation Tabs */}
        <div className="flex border-b border-[var(--tri-border-default)]">
          <button
            className={`px-[var(--tri-space-4)] py-[var(--tri-space-2)] font-medium text-sm border-b-2 transition ${
              activeTab === "browse"
                ? "border-[var(--tri-brand-primary)] text-[var(--tri-text-primary)]"
                : "border-transparent text-[var(--tri-text-secondary)] hover:text-[var(--tri-text-primary)]"
            }`}
            onClick={() => setActiveTab("browse")}
            type="button"
          >
            Browse Assets ({filtered.length})
          </button>
          <button
            className={`px-[var(--tri-space-4)] py-[var(--tri-space-2)] font-medium text-sm border-b-2 transition ${
              activeTab === "upload"
                ? "border-[var(--tri-brand-primary)] text-[var(--tri-text-primary)]"
                : "border-transparent text-[var(--tri-text-secondary)] hover:text-[var(--tri-text-primary)]"
            }`}
            onClick={() => setActiveTab("upload")}
            type="button"
          >
            Upload New File
          </button>
        </div>

        {activeTab === "browse" ? (
          <>
            <Input
              aria-label="Search assets"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search assets..."
              value={search}
            />

            <div className="grid max-h-[360px] overflow-y-auto grid-cols-2 gap-[var(--tri-space-3)] md:grid-cols-3 p-1">
              {filtered.map((asset) => {
                const selectedAsset = selected.some(
                  ({ id }) => String(id) === String(asset.id),
                );
                const previewUrl = asset.thumbnailUrl || asset.url;
                return (
                  <button
                    aria-pressed={selectedAsset}
                    className={`group relative min-h-11 overflow-hidden rounded-[var(--tri-card-radius)] border text-left transition-all ${
                      selectedAsset
                        ? "border-[var(--tri-brand-primary)] ring-2 ring-[var(--tri-brand-primary)] bg-[var(--tri-bg-surface-raised)] shadow-md"
                        : "border-[var(--tri-border-default)] hover:border-[var(--tri-border-hover)]"
                    }`}
                    key={asset.id}
                    onClick={() => toggle(asset)}
                    type="button"
                  >
                    {/* Selected Badge Indicator */}
                    <span
                      className={`absolute left-2 top-2 z-20 grid size-6 place-items-center rounded-full border transition ${
                        selectedAsset
                          ? "border-white bg-[var(--tri-brand-primary)] text-white shadow-md"
                          : "border-white/60 bg-black/40 text-transparent group-hover:border-white group-hover:bg-black/60"
                      }`}
                    >
                      <CheckIcon />
                    </span>

                    {previewUrl ? (
                      // Signed URLs must bypass Next image optimization.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={asset.name}
                        className={`aspect-[4/3] w-full object-cover transition ${
                          selectedAsset ? "brightness-95" : ""
                        }`}
                        src={previewUrl}
                      />
                    ) : (
                      <div className="aspect-[4/3] bg-[var(--tri-bg-surface-alt)] grid place-items-center text-xs text-[var(--tri-text-tertiary)]">
                        {type.toUpperCase()}
                      </div>
                    )}
                    <span
                      className={`block truncate p-[var(--tri-space-2)] text-xs font-medium ${
                        selectedAsset
                          ? "text-[var(--tri-brand-primary)] font-semibold"
                          : "text-[var(--tri-text-primary)]"
                      }`}
                    >
                      {asset.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="space-y-[var(--tri-space-3)] py-[var(--tri-space-2)]">
            {uploading ? (
              <div className="grid place-items-center p-[var(--tri-space-8)]">
                <div className="size-8 animate-spin rounded-full border-4 border-[var(--tri-brand-primary)] border-t-transparent" />
                <p className="mt-2 text-sm text-[var(--tri-text-secondary)]">
                  Uploading asset...
                </p>
              </div>
            ) : (
              <UploadDropzone
                accept={`${type}/*`}
                maxSize={50 * 1024 * 1024}
                multiple={multiple}
                onFiles={handleUpload}
              />
            )}
            {uploadError ? (
              <p className="text-sm text-red-500">{uploadError}</p>
            ) : null}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-[var(--tri-border-default)] pt-[var(--tri-space-3)]">
          <span className="text-xs text-[var(--tri-text-secondary)]">
            {selected.length > 0
              ? `${selected.length} asset(s) selected`
              : "No asset selected"}
          </span>
          <div className="flex gap-[var(--tri-space-2)]">
            <button
              className="min-h-10 rounded-[var(--tri-radius-md)] border border-[var(--tri-button-secondary-border)] px-[var(--tri-space-4)] text-[var(--tri-text-primary)] text-sm"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="min-h-10 rounded-[var(--tri-radius-md)] bg-[var(--tri-button-primary-bg)] px-[var(--tri-space-4)] text-[var(--tri-button-primary-fg)] text-sm disabled:opacity-50"
              disabled={!selected.length}
              onClick={() => {
                onselect(selected);
                onClose();
              }}
              type="button"
            >
              {selected.length > 0 ? `Select (${selected.length})` : "Select"}
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
