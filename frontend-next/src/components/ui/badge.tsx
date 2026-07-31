/* Copyright 2025 Google LLC
 * Licensed under Apache-2.0
 */
import type { ReactNode } from "react";
export type BadgeTone = "neutral" | "success" | "info" | "danger" | "warning";
export interface BadgeProps { children: ReactNode; tone?: BadgeTone; icon?: ReactNode; className?: string; }
const tones: Record<BadgeTone, string> = { neutral: "bg-[var(--tri-badge-neutral)] text-[var(--tri-text-secondary)]", success: "bg-[var(--tri-badge-success)] text-[var(--tri-brand-on-primary)]", info: "bg-[var(--tri-badge-info)] text-[var(--tri-brand-on-primary)]", danger: "bg-[var(--tri-badge-danger)] text-[var(--tri-brand-on-primary)]", warning: "bg-[var(--tri-badge-warning)] text-[var(--tri-brand-on-primary)]" };
export function Badge({ children, className = "", icon, tone = "neutral" }: BadgeProps) { return <span className={`inline-flex min-h-[var(--tri-badge-height)] items-center gap-[var(--tri-space-1)] rounded-[var(--tri-badge-radius)] px-[var(--tri-badge-padding-inline)] text-[var(--tri-label-overline-size)] leading-[var(--tri-label-overline-line-height)] tracking-[var(--tri-label-overline-tracking)] font-[var(--tri-font-weight-bold)] uppercase ${tones[tone]} ${className}`}>{icon}<span>{children}</span></span>; }
