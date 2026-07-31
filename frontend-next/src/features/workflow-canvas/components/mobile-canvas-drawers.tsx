/** Copyright 2026 Google LLC — Apache-2.0
 * Responsive slide-over wrappers for the canvas palette + inspector. Below the lg
 * breakpoint the palette/inspector live in these drawers; at lg and up they are
 * hidden (the fixed rail + inspector render separately in the canvas shell).
 *
 * Each drawer is a modal region: while open it moves focus in and traps
 * Tab/Shift+Tab within its panel, Escape + scrim close it, and on close focus is
 * restored to the element that held focus at open time (the trigger button) — or
 * to an explicit `*TriggerRef` when the composition wires one. Body scroll-lock
 * is the canvas shell's job. No extra deps: the focus trap is hand-rolled on top
 * of a tiny pure index helper (`trapFocusIndex`). */
"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/src/components/ui";

export interface MobileCanvasDrawersProps {
  palette: ReactNode;
  inspector: ReactNode;
  paletteOpen: boolean;
  onPaletteOpenChange: (open: boolean) => void;
  inspectorOpen: boolean;
  onInspectorOpenChange: (open: boolean) => void;
  /** Optional ref to the control that opened the palette drawer so focus returns
   * to it on close. Omit to restore to whatever held focus at open time (which is
   * already the trigger when the drawer is opened by clicking it). Wiring these
   * refs is an optional composition follow-up — see the final report. */
  paletteTriggerRef?: RefObject<HTMLButtonElement | null> | null;
  /** Optional ref to the control that opened the inspector drawer. See above. */
  inspectorTriggerRef?: RefObject<HTMLButtonElement | null> | null;
}

export function MobileCanvasDrawers({
  palette,
  inspector,
  paletteOpen,
  onPaletteOpenChange,
  inspectorOpen,
  onInspectorOpenChange,
  paletteTriggerRef,
  inspectorTriggerRef,
}: MobileCanvasDrawersProps) {
  // One keydown listener covers both drawers; ignored when both are closed.
  useEffect(() => {
    if (!paletteOpen && !inspectorOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const target = escapeTarget(paletteOpen, inspectorOpen);
      if (!target) return;
      event.preventDefault();
      if (target === "right") onInspectorOpenChange(false);
      else onPaletteOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, inspectorOpen, onPaletteOpenChange, onInspectorOpenChange]);

  return (
    <div className="contents lg:hidden">
      {paletteOpen ? (
        <Drawer side="left" label="Step palette" onClose={() => onPaletteOpenChange(false)} triggerRef={paletteTriggerRef}>
          {palette}
        </Drawer>
      ) : null}
      {inspectorOpen ? (
        <Drawer side="right" label="Node inspector" onClose={() => onInspectorOpenChange(false)} triggerRef={inspectorTriggerRef}>
          {inspector}
        </Drawer>
      ) : null}
    </div>
  );
}

type DrawerSide = "left" | "right";

/** Which drawer an Escape press should close (inspector wins when both are open).
 * Returns null when nothing is open. Pure. */
export function escapeTarget(paletteOpen: boolean, inspectorOpen: boolean): DrawerSide | null {
  if (inspectorOpen) return "right";
  if (paletteOpen) return "left";
  return null;
}

/** Wrapping focus index for Tab (shift=false) / Shift+Tab (shift=true) across
 * `count` focusable elements inside a trap. When the active element is outside
 * the list (current < 0 or out of range) Tab enters at 0 and Shift+Tab at the
 * last item. Pure. Returns -1 for an empty trap so callers can no-op. */
export function trapFocusIndex(current: number, count: number, shift: boolean): number {
  if (count <= 0) return -1;
  if (current < 0 || current >= count) return shift ? count - 1 : 0;
  return shift ? (current - 1 + count) % count : (current + 1) % count;
}

/** Selector for elements that take keyboard focus, in DOM order. */
export const FOCUSABLE_SELECTOR =
  'a[href],button:not([disabled]),textarea:not([disabled]),select:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Keyboard-focusable descendants of `container`, in DOM order. */
export function focusableWithin(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/* ---------------------- portal layering + background inert ----------------------
 * Exported so Bun's DOM-less runner can guard the invariants the component body
 * enforces through effects (which need a DOM). */

/** Z-index for the portaled drawer layer. Above the studio Sidebar (z-1000) and
 * WorkspaceSwitcher (z-101) so the drawer + scrim overlay them, but below the
 * global LoadingBar (z-9999) so it stays visible. Keep in sync with
 * DRAWER_LAYER_CLASS (the literal z-[1100] is required for Tailwind). */
export const DRAWER_Z_INDEX = 1100;

/** Class on the portaled drawer wrapper. z-[1100] = DRAWER_Z_INDEX. */
export const DRAWER_LAYER_CLASS = "fixed inset-0 z-[1100] lg:hidden";

/** True when `z` clears the studio Sidebar (1000) but sits under LoadingBar (9999). */
export function isSafeDrawerZ(z: number): boolean {
  return z > 1000 && z < 9999;
}

/** Element tags that are never visual/interactive; skipped when inerting the
 * drawer's background so scripts/styles/resources are never touched. */
export const BACKGROUND_INERT_SKIP_TAGS = ["SCRIPT", "STYLE", "LINK", "TEMPLATE", "NOSCRIPT"] as const;

/** True for a body child that should be inerted/aria-hidden while a drawer is
 * open. Pure over a minimal {tagName} shape so it is testable without a DOM. */
export function shouldHideBackgroundChild(el: { tagName: string }): boolean {
  const tag = el.tagName.toUpperCase();
  return !(BACKGROUND_INERT_SKIP_TAGS as readonly string[]).includes(tag);
}

function Drawer({
  side,
  label,
  onClose,
  triggerRef,
  children,
}: {
  side: DrawerSide;
  label: string;
  onClose: () => void;
  triggerRef?: RefObject<HTMLButtonElement | null> | null;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLElement>(null);

  /* Portal host appended to document.body so the drawer escapes the canvas
   * z-40 stacking context and layers above the studio Sidebar (z-1000). The
   * host is excluded from background inerting below so the drawer itself stays
   * interactive and visible to AT. Lazy-init keeps SSR DOM-free. */
  const [host] = useState<HTMLElement | null>(() =>
    typeof document !== "undefined" ? document.createElement("div") : null,
  );
  useEffect(() => {
    if (!host) return;
    if (host.parentNode !== document.body) document.body.appendChild(host);
    return () => {
      if (host.parentNode) host.parentNode.removeChild(host);
    };
  }, [host]);

  /* The drawer is conditionally rendered only while open, so a mount effect is
   * exactly open/close: capture the trigger, move focus in; restore on unmount.
   * triggerRef identity (a stable ref object) is the only reactive dependency;
   * the restore targets are snapshotted locally so the cleanup never reads a
   * possibly-stale ref value. This effect is defined BEFORE the background-inert
   * effect so the reverse-order unmount cleanup restores focus AFTER the
   * background is un-inerted (the trigger lives in the inerted editor root). */
  useEffect(() => {
    const previouslyFocused =
      typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
    const explicitTrigger = (triggerRef?.current as HTMLElement | null) ?? null;
    const panel = panelRef.current;
    const first = panel ? focusableWithin(panel)[0] : null;
    (first ?? panel)?.focus();
    return () => {
      (explicitTrigger ?? previouslyFocused)?.focus();
    };
  }, [triggerRef]);

  /* While open, make every OTHER body child non-interactive and hidden from AT
   * (inert + aria-hidden). This robustly covers the editor root AND any studio
   * chrome (Sidebar/WorkspaceSwitcher) regardless of where it lives in the DOM,
   * without needing selectors for studio components (which are out of scope and
   * must not be edited here). The portal host is skipped so the drawer stays
   * focusable/visible; non-visual resource tags (script/style/link/...) are
   * skipped. Prior inert/aria-hidden values are snapshotted so cleanup never
   * clobbers a pre-existing attribute. */
  useEffect(() => {
    if (!host) return;
    const snapshot: Array<{ el: HTMLElement; inert: string | null; hidden: string | null }> = [];
    for (const child of Array.from(document.body.children)) {
      if (child === host) continue;
      if (!(child instanceof HTMLElement)) continue;
      if (!shouldHideBackgroundChild(child)) continue;
      snapshot.push({
        el: child,
        inert: child.getAttribute("inert"),
        hidden: child.getAttribute("aria-hidden"),
      });
      child.setAttribute("inert", "");
      child.setAttribute("aria-hidden", "true");
    }
    return () => {
      for (const { el, inert, hidden } of snapshot) {
        if (inert === null) el.removeAttribute("inert");
        else el.setAttribute("inert", inert);
        if (hidden === null) el.removeAttribute("aria-hidden");
        else el.setAttribute("aria-hidden", hidden);
      }
    };
  }, [host]);

  /* Trap Tab/Shift+Tab inside the panel so focus cannot escape to the page behind. */
  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab" || !panelRef.current) return;
    const items = focusableWithin(panelRef.current);
    if (items.length === 0) return;
    const next = trapFocusIndex(items.indexOf(document.activeElement as HTMLElement), items.length, event.shiftKey);
    event.preventDefault();
    items[next]?.focus();
  };

  const sideClass =
    side === "left"
      ? "left-0 top-0 h-[100dvh] w-[min(20rem,100vw)] rounded-r-[var(--tri-radius-lg)] border-r-0"
      : "right-0 top-0 h-[100dvh] w-[min(26rem,100vw)] rounded-l-[var(--tri-radius-lg)] border-l-0";

  if (!host) return null;

  return createPortal(
    <div className={DRAWER_LAYER_CLASS} role="presentation">
      <button
        type="button"
        tabIndex={-1}
        aria-label={`Close ${label}`}
        className="absolute inset-0 cursor-default bg-[var(--tri-bg-scrim)]"
        onClick={onClose}
      />
      <section
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onKeyDown={onKeyDown}
        className={`absolute flex max-h-[100dvh] min-w-0 flex-col overflow-y-auto overscroll-contain border-[var(--tri-border-default)] bg-[var(--tri-bg-surface)] p-[var(--tri-space-3)] shadow-[var(--tri-shadow-lg)] ${sideClass}`}
      >
        <div className="mb-[var(--tri-space-2)] flex items-center justify-between gap-[var(--tri-space-2)]">
          <h2 className="font-[var(--tri-font-display)] text-[var(--tri-text-h4-size)] leading-[var(--tri-text-h4-line-height)]">
            {label}
          </h2>
          <Button aria-label={`Close ${label}`} title="Close" variant="secondary" className="min-h-11 min-w-11 px-3" onClick={onClose}>
            ×
          </Button>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1">{children}</div>
      </section>
    </div>,
    host,
  );
}
