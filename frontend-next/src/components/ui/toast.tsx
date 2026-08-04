/* Copyright 2025 Google LLC
 * Licensed under Apache-2.0
 */
"use client";

import type { ReactNode } from "react";
export type ToastTone = "neutral" | "success" | "info" | "danger" | "warning";
export type ToastPlacement = "top-right" | "bottom-center";
export interface ToastProps { id: string; message: ReactNode; tone: ToastTone; onDismiss: (id: string) => void; }
// Angular fills green/red snackbars rather than tinting a left border only.
const tones: Record<ToastTone, string> = {
  neutral: "border-[var(--tri-border-default)] bg-[var(--tri-bg-surface-raised)]",
  success: "border-[var(--tri-state-success)] bg-[var(--tri-state-success)] text-[var(--tri-text-inverse)]",
  info: "border-[var(--tri-state-info)] bg-[var(--tri-bg-surface-raised)]",
  danger: "border-[var(--tri-state-error)] bg-[var(--tri-state-error)] text-[var(--tri-text-inverse)]",
  warning: "border-[var(--tri-state-warning)] bg-[var(--tri-bg-surface-raised)]",
};
export function Toast({ id, message, onDismiss, tone }: ToastProps) { return <div className={`flex items-start gap-[var(--tri-space-3)] rounded-[var(--tri-toast-radius)] border-l-[var(--tri-border-strong-width)] p-[var(--tri-toast-padding)] shadow-[var(--tri-toast-shadow)] ${tones[tone]}`} role={tone === "danger" ? "alert" : "status"}><p className="flex-1 text-[length:var(--tri-text-small-size)]">{message}</p><button aria-label="Dismiss notification" className="grid size-[var(--tri-control-height-md)] place-items-center opacity-[var(--tri-opacity-muted)]" onClick={() => onDismiss(id)} type="button">×</button></div>; }
