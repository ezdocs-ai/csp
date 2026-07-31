/* Copyright 2025 Google LLC
 * Licensed under Apache-2.0
 */
"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Toast, type ToastPlacement, type ToastTone } from "./toast";
type ToastItem = { id: string; message: ReactNode; tone: ToastTone; placement: ToastPlacement };
type ToastContextValue = { show: (message: ReactNode, tone?: ToastTone, placement?: ToastPlacement) => string; dismiss: (id: string) => void };
const ToastContext = createContext<ToastContextValue | null>(null);
export interface ToastProviderProps { children: ReactNode; }
// Angular notifications sit above every overlay (--z-index-notification: 99999).
const stacks: Record<ToastPlacement, string> = {
  "top-right": "right-[var(--tri-space-4)] top-[var(--tri-space-4)] w-[var(--tri-toast-width)] max-md:inset-x-[var(--tri-space-4)] max-md:top-auto max-md:bottom-[var(--tri-space-4)] max-md:w-auto",
  "bottom-center": "bottom-[var(--tri-space-4)] left-1/2 -translate-x-1/2 w-[var(--tri-toast-width)]",
};
export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: string) => setToasts((items) => items.filter((item) => item.id !== id)), []);
  const show = useCallback((message: ReactNode, tone: ToastTone = "neutral", placement: ToastPlacement = "top-right") => { const id = crypto.randomUUID(); setToasts((items) => [...items, { id, message, tone, placement }]); return id; }, []);
  useEffect(() => { const duration = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--tri-toast-duration")) * 1000 || 5000; const timers = toasts.map(({ id }) => window.setTimeout(() => dismiss(id), duration)); return () => timers.forEach(window.clearTimeout); }, [dismiss, toasts]);
  const value = useMemo(() => ({ show, dismiss }), [dismiss, show]);
  return <ToastContext.Provider value={value}>{children}{(Object.keys(stacks) as ToastPlacement[]).map((placement) => { const items = toasts.filter((toast) => toast.placement === placement); return items.length === 0 ? null : <div aria-live="polite" className={`fixed z-[99999] grid gap-[var(--tri-space-2)] ${stacks[placement]}`} key={placement}>{items.map((toast) => <Toast key={toast.id} {...toast} onDismiss={dismiss} />)}</div>; })}</ToastContext.Provider>;
}
export function useToast(): ToastContextValue { const context = useContext(ToastContext); if (!context) throw new Error("useToast must be used within ToastProvider"); return context; }
