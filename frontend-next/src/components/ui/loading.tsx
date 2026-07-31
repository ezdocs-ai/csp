/** Copyright 2026 Google LLC — Apache-2.0 */
import type { ReactNode } from "react";

export function Spinner({ label = "Loading", size = "md" }: { label?: string; size?: "sm" | "md" | "lg" }) {
  const dimensions = size === "sm" ? "size-5" : size === "lg" ? "size-12" : "size-8";
  return (
    <span aria-live="polite" className="inline-flex items-center justify-center" role="status">
      <svg aria-hidden="true" className={`${dimensions} animate-spin`} viewBox="0 0 24 24">
        <circle cx="12" cy="12" fill="none" r="9" stroke="var(--tri-border-default)" strokeWidth="3" />
        <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="var(--tri-brand-primary)" strokeLinecap="round" strokeWidth="3" />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function LoadingState({
  label = "Loading",
  className = "",
  children,
}: {
  label?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section aria-busy="true" aria-label={label} className={`grid w-full grid-cols-1 place-items-center gap-3 py-12 text-[color:var(--tri-text-secondary)] ${className}`}>
      <Spinner label={label} size="lg" />
      <p>{label}…</p>
      {children}
    </section>
  );
}
