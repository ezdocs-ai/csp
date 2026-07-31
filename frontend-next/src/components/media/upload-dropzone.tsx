/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useRef, useState } from "react";

type Props = { accept: string; maxSize: number; onFiles: (files: File[]) => void; multiple?: boolean };

export function UploadDropzone({ accept, maxSize, multiple = false, onFiles }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const allowed = (file: File) => accept.split(",").some((rule) => rule.trim() === file.type || (rule.trim().endsWith("/*") && file.type.startsWith(rule.trim().slice(0, -1))));
  const select = (files: FileList | null) => {
    const valid = Array.from(files ?? []).filter((file) => allowed(file) && file.size <= maxSize);
    if (valid.length) onFiles(multiple ? valid : valid.slice(0, 1));
  };
  return <div className={`rounded-[var(--tri-card-radius)] border-2 border-dashed p-[var(--tri-space-6)] text-center ${dragging ? "border-[var(--tri-a11y-focus-ring)] bg-[var(--tri-bg-surface-alt)]" : "border-[var(--tri-border-default)]"}`} onDragLeave={() => setDragging(false)} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDrop={(event) => { event.preventDefault(); setDragging(false); select(event.dataTransfer.files); }}><input ref={input} accept={accept} className="sr-only" multiple={multiple} onChange={(event) => select(event.target.files)} type="file" /><button className="min-h-11 rounded-[var(--tri-radius-md)] px-[var(--tri-space-4)] text-[var(--tri-text-primary)] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tri-a11y-focus-ring)]" onClick={() => input.current?.click()} type="button">Drop files here or browse</button><p className="mt-[var(--tri-space-2)] text-sm text-[var(--tri-text-secondary)]">Max {Math.round(maxSize / 1024 / 1024)} MB</p></div>;
}
