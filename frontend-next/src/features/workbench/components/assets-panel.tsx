"use client";
/** Copyright 2026 Google LLC — Apache-2.0 */

import { useRef, useState } from "react";
import { useToast } from "@/src/components/ui/toast-provider";
import type { Clip } from "../types";

export interface WorkbenchAsset { id: string; name: string; type: "video" | "audio"; url: string; thumbnail?: string; duration: number; }

// Blob/signed thumbnail URLs cannot go through next/image without remote-pattern config.
function AssetThumbnail({ asset }: { asset: WorkbenchAsset }) {
  if (!asset.thumbnail) {
    return <span aria-hidden="true" className="text-[var(--tri-brand-primary)]">{asset.type === "video" ? "▶" : "♪"}</span>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt="" className="size-full object-cover opacity-80 group-hover:opacity-100" src={asset.thumbnail} />;
}

export function AssetsPanel({ onAddToTimeline }: { onAddToTimeline: (clip: Clip) => void }) {
  const { show } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<WorkbenchAsset[]>([]);
  const [activeTab, setActiveTab] = useState<"video" | "audio">("video");
  const filtered = assets.filter((asset) => asset.type === activeTab);

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files).map((file) => {
      const type: "video" | "audio" = file.type.startsWith("audio") ? "audio" : "video";
      return { id: crypto.randomUUID(), name: file.name, type, url: URL.createObjectURL(file), duration: 0 };
    });
    setAssets((current) => [...current, ...next]);
    show(`${next.length} asset${next.length === 1 ? "" : "s"} added.`, "success");
  };

  const addToTimeline = (asset: WorkbenchAsset) => {
    onAddToTimeline({ id: crypto.randomUUID(), assetId: asset.id, url: asset.url, startTime: 0, duration: asset.duration || 5, offset: 0, trackIndex: 0, type: asset.type, thumbnail: asset.thumbnail });
    show(`Added "${asset.name}" to timeline.`, "success");
  };

  const deleteAsset = (id: string, event: React.MouseEvent) => { event.stopPropagation(); setAssets((current) => current.filter((asset) => asset.id !== id)); };

  return (
    <section aria-label="Assets" className="grid content-start gap-[var(--tri-space-4)]">
      <h2 className="text-[length:var(--tri-text-h4-size)] font-[var(--tri-font-weight-semibold)]">Assets</h2>
      <input accept="video/*,audio/*" aria-label="Upload media" className="sr-only" multiple onChange={(event) => onFiles(event.target.files)} ref={inputRef} type="file" />
      <div className="grid grid-cols-2 gap-[var(--tri-space-3)]">
        <button className="grid aspect-square place-items-center gap-[var(--tri-space-1)] rounded-[var(--tri-radius-lg)] border-2 border-dashed border-[var(--tri-border-default)] text-[length:var(--tri-text-small-size)] text-[var(--tri-text-secondary)] transition-[var(--tri-button-transition)] hover:border-[var(--tri-brand-primary)] hover:text-[var(--tri-brand-primary)]" onClick={() => inputRef.current?.click()} type="button">
          <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-[var(--tri-bg-surface-alt)] group-hover:bg-[var(--tri-brand-primary)]">☁</span>
          Add from Cloud
        </button>
        {filtered.map((asset) => (
          <button className="group relative grid aspect-square place-items-center overflow-hidden rounded-[var(--tri-radius-lg)] border border-[var(--tri-border-subtle)] bg-black text-left transition-[var(--tri-button-transition)] hover:ring-2 hover:ring-[var(--tri-brand-primary)]" key={asset.id} onClick={() => addToTimeline(asset)} type="button">
            <AssetThumbnail asset={asset} />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-[var(--tri-space-2)] text-[length:var(--tri-text-small-size)] text-white"><span className="block truncate">{asset.name}</span></span>
            <button aria-label={`Delete ${asset.name}`} className="absolute right-[var(--tri-space-2)] top-[var(--tri-space-2)] grid size-6 place-items-center rounded-full bg-[var(--tri-state-error)] opacity-0 group-hover:opacity-100" onClick={(event) => deleteAsset(asset.id, event)} type="button">×</button>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-center gap-[var(--tri-space-2)]" role="tablist">
        <button aria-selected={activeTab === "video"} className={`inline-flex min-h-[var(--tri-control-height-md)] items-center gap-[var(--tri-space-1)] rounded-full px-[var(--tri-space-3)] text-[length:var(--tri-text-small-size)] ${activeTab === "video" ? "bg-[var(--tri-brand-primary)] text-[var(--tri-brand-on-primary)]" : "border border-[var(--tri-border-default)]"}`} onClick={() => setActiveTab("video")} role="tab" type="button">▶ Videos</button>
        <button aria-selected={activeTab === "audio"} className={`inline-flex min-h-[var(--tri-control-height-md)] items-center gap-[var(--tri-space-1)] rounded-full px-[var(--tri-space-3)] text-[length:var(--tri-text-small-size)] ${activeTab === "audio" ? "bg-[var(--tri-brand-primary)] text-[var(--tri-brand-on-primary)]" : "border border-[var(--tri-border-default)]"}`} onClick={() => setActiveTab("audio")} role="tab" type="button">♪ Audio</button>
        <span className="inline-flex min-h-[var(--tri-control-height-md)] items-center rounded-full px-[var(--tri-space-3)] opacity-50" title="Drive coming soon!" >⬡</span>
        <button aria-label="Upload media" className="inline-flex min-h-[var(--tri-control-height-md)] items-center rounded-full bg-[var(--tri-brand-primary)] px-[var(--tri-space-3)] text-[var(--tri-brand-on-primary)]" onClick={() => inputRef.current?.click()} title="Upload Media" type="button">↑</button>
      </div>
    </section>
  );
}
