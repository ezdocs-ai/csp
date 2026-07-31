/* Copyright 2025 Google LLC
 * Licensed under Apache-2.0
 */
import type { HTMLAttributes } from "react";

export type CardVariant = "base" | "interactive" | "featured" | "glass";
export interface CardProps extends HTMLAttributes<HTMLElement> { variant?: CardVariant; as?: "article" | "section" | "div"; }
const variants: Record<CardVariant, string> = {
  base: "bg-[var(--tri-card-bg)] border-[var(--tri-card-border)] rounded-[var(--tri-card-radius)] p-[var(--tri-card-padding)]",
  interactive: "bg-[var(--tri-card-bg)] border-[var(--tri-card-border)] rounded-[var(--tri-card-radius)] p-[var(--tri-card-padding)] transition-[var(--tri-button-transition)] hover:translate-y-[-2px] hover:border-[var(--tri-card-interactive-hover-border)] hover:shadow-[var(--tri-card-interactive-hover-shadow)]",
  featured: "bg-[var(--tri-card-featured-bg)] text-[var(--tri-card-featured-fg)] border-transparent rounded-[var(--tri-card-featured-radius)] p-[var(--tri-card-featured-padding)]",
  glass: "bg-[var(--tri-card-glass-bg)] border-[var(--tri-card-glass-border)] rounded-[var(--tri-card-radius)] p-[var(--tri-card-padding)] backdrop-blur-[var(--tri-card-glass-blur)]",
};
export function Card({ as: Tag = "article", className = "", variant = "base", ...props }: CardProps) { return <Tag className={`border ${variants[variant]} ${className}`} {...props} />; }
