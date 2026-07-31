/* Copyright 2025 Google LLC
 * Licensed under Apache-2.0
 */
"use client";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export type MenuSide = "top" | "right" | "bottom" | "left";
export type MenuAlign = "start" | "end";

export interface MenuProps {
  /** Rendered as the clickable (or hoverable) trigger. */
  trigger: ReactNode;
  children: ReactNode;
  label?: string;
  side?: MenuSide;
  align?: MenuAlign;
  /** Open on hover instead of click, with an invisible bridge to the panel (Angular Tools flyout). */
  hover?: boolean;
  /** Grace period before a hover menu closes. Angular uses 200ms. */
  closeGraceMs?: number;
  className?: string;
  panelClassName?: string;
}

const sides: Record<MenuSide, string> = {
  top: "bottom-full left-0 mb-[var(--tri-space-2)]",
  bottom: "top-full left-0 mt-[var(--tri-space-2)]",
  right: "left-full top-0 ml-[var(--tri-space-2)]",
  left: "right-full top-0 mr-[var(--tri-space-2)]",
};
const alignEnd: Record<MenuSide, string> = {
  top: "left-auto right-0",
  bottom: "left-auto right-0",
  right: "top-auto bottom-0",
  left: "top-auto bottom-0",
};
const bridges: Record<MenuSide, string> = {
  top: "-bottom-[var(--tri-space-2)] inset-x-0 h-[var(--tri-space-2)]",
  bottom: "-top-[var(--tri-space-2)] inset-x-0 h-[var(--tri-space-2)]",
  right: "-left-[var(--tri-space-2)] inset-y-0 w-[var(--tri-space-2)]",
  left: "-right-[var(--tri-space-2)] inset-y-0 w-[var(--tri-space-2)]",
};

export function Menu({
  align = "start",
  children,
  className = "",
  closeGraceMs = 200,
  hover = false,
  label,
  panelClassName = "",
  side = "bottom",
  trigger,
}: MenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const grace = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!open) return;
    // Focus the first menuitem when opened via keyboard/click (not pure hover).
    if (root.current?.contains(document.activeElement)) {
      const first = panel.current?.querySelector<HTMLElement>(
        '[role="menuitem"]:not([disabled]):not([aria-disabled="true"])'
      );
      first?.focus();
    }
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      const items = Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          '[role="menuitem"]:not([disabled]):not([aria-disabled="true"])'
        ) ?? []
      );
      if (items.length === 0) return;
      const current = items.findIndex((item) => item === document.activeElement);
      let next = current;
      if (event.key === "ArrowDown") next = current < 0 ? 0 : (current + 1) % items.length;
      else if (event.key === "ArrowUp") next = current <= 0 ? items.length - 1 : current - 1;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = items.length - 1;
      else return;
      event.preventDefault();
      items[next]?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => () => clearTimeout(grace.current), []);

  const hoverHandlers = hover
    ? {
        onMouseEnter: () => {
          clearTimeout(grace.current);
          setOpen(true);
        },
        onMouseLeave: () => {
          grace.current = setTimeout(() => setOpen(false), closeGraceMs);
        },
      }
    : {};

  return (
    <div className={`relative ${className}`} ref={root} {...hoverHandlers}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className="flex w-full items-center"
        onClick={() => setOpen((value) => (hover ? true : !value))}
        type="button"
      >
        {trigger}
      </button>
      {open ? (
        <div
          className={`absolute z-[1001] min-w-[14rem] rounded-[var(--tri-dialog-radius,24px)] border border-white/10 bg-[var(--tri-bg-surface-raised)] p-[var(--tri-space-2)] shadow-[var(--tri-shadow-lg)] backdrop-blur-[10px] ${sides[side]} ${align === "end" ? alignEnd[side] : ""} ${panelClassName}`}
          ref={panel}
          role="menu"
        >
          {hover ? <span aria-hidden className={`absolute ${bridges[side]}`} /> : null}
          {children}
        </div>
      ) : null}
    </div>
  );
}

export interface MenuItemProps {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  trailing?: ReactNode;
  disabled?: boolean;
  selected?: boolean;
  /** Native title, used where Angular sets a matTooltip on a disabled item. */
  title?: string;
  href?: string;
}

export function MenuItem({ children, disabled, href, icon, onClick, selected, title, trailing }: MenuItemProps) {
  const shared = {
    "aria-current": selected ? ("true" as const) : undefined,
    className: `flex w-full items-center gap-[var(--tri-space-3)] rounded-[12px] px-[var(--tri-space-3)] py-[var(--tri-space-2)] text-left text-[length:var(--tri-text-small-size)] min-h-11 ${disabled ? "cursor-not-allowed opacity-50" : "hover:bg-white/10"} ${selected ? "bg-white/10 font-[var(--tri-font-weight-bold)]" : ""}`,
    role: "menuitem",
    title,
  };
  const body = (
    <>
      {icon ? <span className="flex shrink-0 items-center">{icon}</span> : null}
      <span className="flex-1 truncate">{children}</span>
      {trailing}
    </>
  );
  if (href && !disabled) {
    return (
      <a {...shared} href={href}>
        {body}
      </a>
    );
  }
  return (
    <button {...shared} aria-disabled={disabled} disabled={disabled} onClick={onClick} type="button">
      {body}
    </button>
  );
}

export function MenuDivider() {
  return <hr className="my-[var(--tri-space-2)] border-0 border-t border-[var(--tri-border-default)]" role="separator" />;
}
