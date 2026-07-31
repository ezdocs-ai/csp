/* Copyright 2025 Google LLC
 * Licensed under Apache-2.0
 */
"use client";
import { cloneElement, useEffect, useId, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

export type TooltipPosition = "top" | "right" | "bottom" | "left";

export interface TooltipProps {
  children: ReactElement<{ "aria-describedby"?: string }>;
  content: ReactNode;
  /** Angular nav items use `right`; default stays `top`. */
  position?: TooltipPosition;
  /** Show delay in ms. Angular Material defaults to 0. */
  delay?: number;
  /** Allows wrapping, matching Angular's `multiline-tooltip` class. */
  multiline?: boolean;
}

const positions: Record<TooltipPosition, string> = {
  top: "bottom-[calc(100%+var(--tri-space-2))] left-1/2 -translate-x-1/2",
  bottom: "top-[calc(100%+var(--tri-space-2))] left-1/2 -translate-x-1/2",
  right: "left-[calc(100%+var(--tri-space-2))] top-1/2 -translate-y-1/2",
  left: "right-[calc(100%+var(--tri-space-2))] top-1/2 -translate-y-1/2",
};

export function Tooltip({ children, content, delay = 0, multiline = false, position = "top" }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function show() {
    clearTimeout(timer.current);
    if (delay > 0) timer.current = setTimeout(() => setOpen(true), delay);
    else setOpen(true);
  }
  function hide() {
    clearTimeout(timer.current);
    setOpen(false);
  }

  return (
    <span className="relative inline-flex" onBlur={hide} onFocus={show} onMouseEnter={show} onMouseLeave={hide}>
      {cloneElement(children, { "aria-describedby": open ? id : undefined })}
      {open ? (
        <span
          className={`pointer-events-none absolute z-50 max-w-[var(--tri-measure-compact)] rounded-[var(--tri-tooltip-radius)] bg-[var(--tri-tooltip-bg)] px-[var(--tri-tooltip-padding)] text-[length:var(--tri-tooltip-font-size)] text-[var(--tri-tooltip-fg)] shadow-[var(--tri-shadow-sm)] ${positions[position]} ${multiline ? "whitespace-pre-line" : "w-max whitespace-nowrap"}`}
          id={id}
          role="tooltip"
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
