/* Copyright 2026 Google LLC
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
"use client";

import { useEffect, useRef } from "react";

export type GenerationStatus = "processing" | "failed" | null;

export interface GenerationOverlayProps {
  status: GenerationStatus;
  title?: string;
  message?: string;
  onDismiss?: () => void;
}

export function GenerationOverlay({ message, onDismiss, status, title }: GenerationOverlayProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!status) return;
    // Autofocus the Close button when it renders (failed state).
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && onDismiss) {
        onDismiss();
        return;
      }
      // Focus trap: in the failed state the Close button is the only focusable
      // element, so Tab/Shift+Tab wraps back to it.
      if (event.key === "Tab" && closeRef.current) {
        event.preventDefault();
        closeRef.current.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [status, onDismiss]);

  if (!status) return null;
  const isFailed = status === "failed";
  return (
    <div
      aria-live="assertive"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-black/70 p-6 text-center"
      role="alertdialog"
    >
      {isFailed ? null : <Spinner />}
      <h2 className="font-[var(--tri-font-display)] text-2xl text-white">
        {title ?? (isFailed ? "Generation Failed" : "Generating...")}
      </h2>
      {message ? <p className="max-w-md text-sm text-white/80">{message}</p> : null}
      <p className="text-xs text-white/60">This may take a few moments. You can safely navigate away.</p>
      {isFailed && onDismiss ? (
        <button
          className="mt-2 cursor-pointer rounded-full bg-white px-5 py-2 text-sm font-bold text-neutral-900 transition-colors hover:bg-neutral-200"
          onClick={onDismiss}
          ref={closeRef}
          type="button"
        >
          Close
        </button>
      ) : null}
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="size-10 animate-spin rounded-full border-2 border-white/30 border-t-white"
    />
  );
}
