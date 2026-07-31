/* Copyright 2025 Google LLC
 * Licensed under Apache-2.0
 */
import type { ReactNode } from "react";
export interface FieldProps { label: string; htmlFor: string; children: ReactNode; error?: string; hint?: string; }
export function Field({ label, htmlFor, children, error, hint }: FieldProps) {
  return <div className="grid gap-[var(--tri-space-2)]"><label className="text-[var(--tri-text-small-size)] font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-secondary)]" htmlFor={htmlFor}>{label}</label>{children}{error ? <p className="text-[var(--tri-text-small-size)] text-[var(--tri-input-invalid-message)]" id={`${htmlFor}-error`} role="alert">{error}</p> : hint ? <p className="text-[var(--tri-text-small-size)] text-[var(--tri-text-tertiary)]">{hint}</p> : null}</div>;
}
