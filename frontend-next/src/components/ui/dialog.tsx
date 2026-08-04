/* Copyright 2025 Google LLC
 * Licensed under Apache-2.0
 */
"use client";
import { useEffect, useId, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
export type DialogSize = "sm" | "md" | "lg";
export interface DialogProps { open: boolean; onClose: () => void; title: string; children: ReactNode; size?: DialogSize; description?: ReactNode; panelClassName?: string; maxWidth?: string; }
const widths: Record<DialogSize, string> = { sm: "var(--tri-dialog-width-sm)", md: "var(--tri-dialog-width-md)", lg: "var(--tri-dialog-width-lg)" };
export function Dialog({ children, description, maxWidth = "90vw", onClose, open, panelClassName = "", size = "md", title }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => { const dialog = ref.current; if (!dialog) return; if (open && !dialog.open) dialog.showModal(); if (!open && dialog.open) dialog.close(); }, [open]);
  return <dialog ref={ref} aria-describedby={description ? descriptionId : undefined} aria-labelledby={titleId} aria-modal="true" className={`m-auto w-[min(var(--dialog-max-width),var(--dialog-width))] border-0 bg-[var(--tri-bg-surface)] text-[var(--tri-text-primary)] rounded-[var(--tri-dialog-radius)] p-[var(--tri-dialog-padding)] shadow-[var(--tri-dialog-shadow)] backdrop:bg-[var(--tri-dialog-scrim)] ${panelClassName}`} style={{ "--dialog-width": widths[size], "--dialog-max-width": maxWidth } as CSSProperties} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === ref.current) onClose(); }}><section role="dialog" aria-modal="true"><h2 id={titleId} className="font-[var(--tri-font-display)] text-[var(--tri-text-h3-size)] leading-[var(--tri-text-h3-line-height)] tracking-[var(--tri-text-h3-tracking)]">{title}</h2>{description ? <p className="mt-[var(--tri-space-2)] text-[length:var(--tri-text-small-size)] text-[var(--tri-text-secondary)]" id={descriptionId}>{description}</p> : null}{children}</section></dialog>;
}
