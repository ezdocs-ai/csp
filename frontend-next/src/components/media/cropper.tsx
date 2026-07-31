/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useEffect, useRef, useState } from "react";

type Props = { src: string; aspect?: number; onCrop: (blob: Blob) => void; onCancel: () => void };
type Rect = { x: number; y: number; width: number; height: number };

export function Cropper({ src, aspect, onCrop, onCancel }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const image = useRef<HTMLImageElement | null>(null);
  const start = useRef<{ x: number; y: number; rect: Rect } | null>(null);
  const [rect, setRect] = useState<Rect>({ x: 0, y: 0, width: 0, height: 0 });
  const draw = () => {
    const target = canvas.current; const source = image.current; if (!target || !source) return;
    const ctx = target.getContext("2d"); if (!ctx) return;
    ctx.drawImage(source, 0, 0, target.width, target.height);
    ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.fillRect(0, 0, target.width, target.height); ctx.clearRect(rect.x, rect.y, rect.width, rect.height); ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  };
  useEffect(() => { const source = new Image(); source.onload = () => { image.current = source; const target = canvas.current; if (!target) return; target.width = source.naturalWidth; target.height = source.naturalHeight; const width = source.naturalWidth * .8; const height = aspect ? width / aspect : source.naturalHeight * .8; setRect({ x: (source.naturalWidth - width) / 2, y: (source.naturalHeight - height) / 2, width, height }); }; source.src = src; }, [src, aspect]);
  useEffect(draw, [rect]);
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => { const box = event.currentTarget.getBoundingClientRect(); return { x: (event.clientX - box.left) * event.currentTarget.width / box.width, y: (event.clientY - box.top) * event.currentTarget.height / box.height }; };
  const crop = () => { const source = image.current; if (!source) return; const output = document.createElement("canvas"); output.width = rect.width; output.height = rect.height; output.getContext("2d")?.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height); output.toBlob((blob) => { if (blob) onCrop(blob); }, "image/jpeg", .92); };
  return <div className="space-y-[var(--tri-space-4)]"><canvas className="max-h-[60dvh] w-full touch-none" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); const p = point(event); start.current = { x: p.x, y: p.y, rect }; }} onPointerMove={(event) => { if (!start.current) return; const p = point(event); const x = Math.max(0, Math.min(canvas.current!.width - rect.width, start.current.rect.x + p.x - start.current.x)); const y = Math.max(0, Math.min(canvas.current!.height - rect.height, start.current.rect.y + p.y - start.current.y)); setRect({ ...start.current.rect, x, y }); }} onPointerUp={() => { start.current = null; }} ref={canvas} /><div className="flex gap-[var(--tri-space-3)]"><button className="min-h-11 px-[var(--tri-space-4)]" onClick={onCancel} type="button">Cancel</button><button className="min-h-11 rounded-[var(--tri-radius-md)] bg-[var(--tri-button-primary-bg)] px-[var(--tri-space-4)] text-[var(--tri-button-primary-fg)]" onClick={crop} type="button">Crop</button></div></div>;
}
