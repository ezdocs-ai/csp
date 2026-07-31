/* Copyright 2025 Google LLC
 * Licensed under Apache-2.0
 */
import type { HTMLAttributes, ReactNode } from "react";
export interface TopbarProps extends HTMLAttributes<HTMLElement> { children: ReactNode; }
export function Topbar({ children, className = "", ...props }: TopbarProps) { return <header className={`sticky top-0 z-30 flex h-[var(--tri-nav-topbar-height)] items-center justify-between border-b border-[var(--tri-nav-topbar-border)] bg-[var(--tri-nav-topbar-bg)] px-[var(--tri-layout-gutter)] backdrop-blur-[var(--tri-nav-topbar-blur)] ${className}`} {...props}>{children}</header>; }
