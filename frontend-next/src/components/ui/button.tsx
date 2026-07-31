/* Copyright 2025 Google LLC
 * Licensed under Apache-2.0
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "iconOnly";
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
}

const variants: Record<ButtonVariant, string> = {
  primary: "bg-[var(--tri-button-primary-bg)] text-[color:var(--tri-button-primary-fg)] border-transparent shadow-[var(--tri-button-primary-shadow)] hover:bg-[var(--tri-button-primary-hover)]",
  secondary: "bg-[var(--tri-button-secondary-bg)] text-[color:var(--tri-button-secondary-fg)] border-[var(--tri-button-secondary-border)] hover:bg-[var(--tri-button-secondary-hover)]",
  ghost: "bg-[var(--tri-button-ghost-bg)] text-[color:var(--tri-button-ghost-fg)] border-transparent hover:bg-[var(--tri-button-ghost-hover)]",
  danger: "bg-[var(--tri-button-danger-bg)] text-[color:var(--tri-button-danger-fg)] border-transparent hover:opacity-[var(--tri-opacity-muted)]",
  iconOnly: "size-[var(--tri-button-icon-size)] bg-[var(--tri-button-ghost-bg)] text-[color:var(--tri-button-ghost-fg)] border-transparent hover:bg-[var(--tri-button-ghost-hover)]",
};

export function Button({ children, className = "", type = "button", variant = "primary", ...props }: ButtonProps) {
  return <button className={`inline-flex min-h-[var(--tri-button-height)] items-center justify-center gap-[var(--tri-space-2)] rounded-[var(--tri-button-radius)] border px-[var(--tri-button-padding-inline)] text-[length:var(--tri-label-button-size)] leading-[var(--tri-label-button-line-height)] tracking-[var(--tri-label-button-tracking)] font-[var(--tri-font-weight-semibold)] transition-[var(--tri-button-transition)] hover:translate-y-[-2px] active:scale-[.985] disabled:cursor-not-allowed disabled:opacity-[var(--tri-opacity-disabled)] ${variants[variant]} ${className}`} type={type} {...props}>{children}</button>;
}
