/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useEffect, useState } from "react";

import { Dialog } from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import type { SourceAsset as Asset } from "@/src/features/source-assets/types";

type Props = {
  type: "image" | "video" | "audio";
  multiple?: boolean;
  onselect: (assets: Asset[]) => void;
  onClose: () => void;
};

export function AssetPicker({
  type,
  multiple = false,
  onselect,
  onClose,
}: Props) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selected, setSelected] = useState<Asset[]>([]);
  const [search, setSearch] = useState("");

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
      current.some(({ id }) => id === asset.id)
        ? current.filter(({ id }) => id !== asset.id)
        : multiple
          ? [...current, asset]
          : [asset],
    );

  return (
    <Dialog onClose={onClose} open title="Select asset" size="lg">
      <div className="mt-[var(--tri-space-4)] space-y-[var(--tri-space-4)]">
        <Input
          aria-label="Search assets"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search assets"
          value={search}
        />
        <div className="grid grid-cols-2 gap-[var(--tri-space-3)] md:grid-cols-3">
          {filtered.map((asset) => {
            const selectedAsset = selected.some(({ id }) => id === asset.id);
            const previewUrl = asset.thumbnailUrl || asset.url;
            return (
              <button
                aria-pressed={selectedAsset}
                className={`min-h-11 overflow-hidden rounded-[var(--tri-card-radius)] border text-left ${selectedAsset ? "border-[var(--tri-a11y-focus-ring)]" : "border-[var(--tri-border-default)]"}`}
                key={asset.id}
                onClick={() => toggle(asset)}
                type="button"
              >
                {previewUrl ? (
                  // Signed URLs must bypass Next image optimization.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt=""
                    className="aspect-[4/3] w-full object-cover"
                    src={previewUrl}
                  />
                ) : (
                  <div className="aspect-[4/3] bg-[var(--tri-bg-surface-alt)]" />
                )}
                <span className="block truncate p-[var(--tri-space-2)]">
                  {asset.name}
                </span>
              </button>
            );
          })}
        </div>
        <button
          className="min-h-11 rounded-[var(--tri-radius-md)] bg-[var(--tri-button-primary-bg)] px-[var(--tri-space-4)] text-[var(--tri-button-primary-fg)]"
          disabled={!selected.length}
          onClick={() => {
            onselect(selected);
            onClose();
          }}
          type="button"
        >
          Select
        </button>
      </div>
    </Dialog>
  );
}
