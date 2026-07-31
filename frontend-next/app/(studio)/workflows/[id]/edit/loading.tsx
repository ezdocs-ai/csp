/* Copyright 2026 Google LLC
 * Licensed under Apache-2.0 */
/* Full-viewport dark canvas skeleton layered like the editor shell (plan §3).
 * Fixed inset-0 z-40 sits above ordinary <main>/Footer and below the retained
 * floating Sidebar/WorkspaceSwitcher, which remain visible and interactive. */
export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading workflow canvas"
      className="fixed inset-0 z-40 flex h-[100dvh] w-full flex-col overflow-hidden bg-[var(--tri-bg-page)] text-[var(--tri-text-primary)]"
      data-theme="dark"
      role="status"
    >
      <div className="flex h-16 items-center gap-[var(--tri-space-3)] border-b border-[var(--tri-border-subtle)] bg-[var(--tri-bg-surface)] px-[var(--tri-space-4)]">
        <div className="size-11 animate-pulse rounded-[var(--tri-button-radius)] bg-[var(--tri-bg-surface-alt)]" />
        <div className="h-8 w-48 animate-pulse rounded-[var(--tri-radius-md)] bg-[var(--tri-bg-surface-alt)]" />
        <div className="ml-auto h-11 w-28 animate-pulse rounded-[var(--tri-button-radius)] bg-[var(--tri-bg-surface-alt)]" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-[18rem] shrink-0 flex-col gap-[var(--tri-space-3)] border-r border-[var(--tri-border-subtle)] bg-[var(--tri-bg-surface)] p-[var(--tri-space-3)] lg:flex">
          {Array.from({ length: 4 }, (_, i) => (
            <div className="h-14 animate-pulse rounded-[var(--tri-radius-md)] bg-[var(--tri-bg-surface-alt)]" key={i} />
          ))}
        </div>
        <main aria-hidden="true" className="relative min-w-0 flex-1 bg-[var(--tri-bg-page)]" id="workflow-canvas-main">
          <div className="absolute inset-[var(--tri-space-6)] grid place-items-center">
            <div className="h-32 w-56 animate-pulse rounded-[var(--tri-radius-lg)] bg-[var(--tri-bg-surface-alt)]" />
          </div>
        </main>
        <div className="hidden w-[24rem] shrink-0 flex-col gap-[var(--tri-space-3)] border-l border-[var(--tri-border-subtle)] bg-[var(--tri-bg-surface)] p-[var(--tri-space-3)] lg:flex">
          {Array.from({ length: 4 }, (_, i) => (
            <div className="h-12 animate-pulse rounded-[var(--tri-radius-md)] bg-[var(--tri-bg-surface-alt)]" key={i} />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading workflow canvas…</span>
    </div>
  );
}
