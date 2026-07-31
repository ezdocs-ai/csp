/* Copyright 2025 Google LLC
 * Licensed under Apache-2.0
 */
import type { InputHTMLAttributes } from "react";
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> { invalid?: boolean; }
export function Input({ className = "", invalid = false, ...props }: InputProps) {
  return <input aria-invalid={invalid || undefined} className={`h-[var(--tri-input-height)] w-full rounded-[var(--tri-input-radius)] border bg-[var(--tri-input-bg)] px-[var(--tri-input-padding-inline)] text-[var(--tri-text-primary)] placeholder:text-[var(--tri-text-tertiary)] transition-[var(--tri-button-transition)] hover:border-[var(--tri-input-hover-border)] focus:border-[var(--tri-input-focus-border)] ${invalid ? "border-[var(--tri-input-invalid-border)]" : "border-[var(--tri-input-border)]"} ${className}`} {...props} />;
}
