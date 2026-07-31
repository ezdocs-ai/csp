/* Copyright 2025 Google LLC
 * Licensed under Apache-2.0
 */
"use client";
import type { ReactNode } from "react";
import { Button } from "./button";
import { Dialog } from "./dialog";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  onConfirm: () => void;
  onClose: () => void;
}

/** Port of Angular `ConfirmationDialogComponent`. */
export function ConfirmDialog({
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  message,
  onClose,
  onConfirm,
  open,
  title,
  tone = "primary",
}: ConfirmDialogProps) {
  return (
    <Dialog onClose={onClose} open={open} size="sm" title={title}>
      <p className="mt-[var(--tri-space-3)] text-[length:var(--tri-text-small-size)]">{message}</p>
      <div className="mt-[var(--tri-space-6)] flex justify-end gap-[var(--tri-space-3)]">
        <Button onClick={onClose} variant="ghost">
          {cancelLabel}
        </Button>
        <Button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          variant={tone === "danger" ? "danger" : "primary"}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
