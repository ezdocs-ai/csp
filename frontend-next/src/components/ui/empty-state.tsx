/* Copyright 2025 Google LLC
 * Licensed under Apache-2.0
 */
import type { ReactNode } from "react";
export interface EmptyStateProps { title: string; description: string; illustration?: ReactNode; actions?: ReactNode; }
export function EmptyState({ actions, description, illustration, title }: EmptyStateProps) { return <section className="grid justify-items-start gap-[var(--tri-space-4)] py-[var(--tri-space-12)]" aria-labelledby="empty-state-title">{illustration ? <div aria-hidden="true" className="grid size-[var(--tri-space-16)] place-items-center rounded-[var(--tri-radius-lg)] border border-[var(--tri-border-subtle)] bg-[var(--tri-bg-surface-alt)] text-[var(--tri-brand-primary)]">{illustration}</div> : null}<div className="grid gap-[var(--tri-space-2)]"><h2 id="empty-state-title" className="font-[var(--tri-font-display)] text-[var(--tri-text-h3-size)] leading-[var(--tri-text-h3-line-height)]">{title}</h2><p className="max-w-[var(--tri-measure-compact)] text-[var(--tri-text-secondary)]">{description}</p></div>{actions ? <div className="flex flex-wrap gap-[var(--tri-space-2)]">{actions}</div> : null}</section>; }
