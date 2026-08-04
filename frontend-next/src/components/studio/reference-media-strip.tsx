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

import type { ReactNode } from "react";

export type ReferenceSlotKind = "image" | "video" | "audio";

export interface ReferenceSlot {
  id: string;
  kind: ReferenceSlotKind;
  previewUrl?: string;
  label?: string;
}

export interface ReferenceMediaStripProps {
  slots: ReferenceSlot[];
  /** When set, renders an `{filled}/{max}` badge (Ingredients mode). */
  max?: number;
  /** Show a compare_arrows divider between two image slots (Frames/Concatenate). */
  showDivider?: boolean;
  onOpen?: (slot: ReferenceSlot) => void;
  onClear?: (slot: ReferenceSlot) => void;
  onEdit?: (slot: ReferenceSlot) => void;
}

export function ReferenceMediaStrip({
  max,
  onClear,
  onEdit,
  onOpen,
  showDivider = false,
  slots,
}: ReferenceMediaStripProps) {
  const filled = slots.filter((slot) => !!slot.previewUrl).length;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {max ? (
        <span className="rounded-md bg-[var(--tri-bg-surface-alt)] px-2 py-0.5 text-xs text-[var(--tri-text-tertiary)]">
          {filled}/{max}
        </span>
      ) : null}
      {slots.map((slot, index) => (
        <div className="flex items-center gap-3" key={slot.id}>
          <Slot slot={slot} onClear={onClear} onEdit={onEdit} onOpen={onOpen} />
          {showDivider && index === 0 && slots.length > 1 ? <CompareArrowsIcon /> : null}
        </div>
      ))}
    </div>
  );
}

function Slot({
  onClear,
  onEdit,
  onOpen,
  slot,
}: {
  onClear?: (slot: ReferenceSlot) => void;
  onEdit?: (slot: ReferenceSlot) => void;
  onOpen?: (slot: ReferenceSlot) => void;
  slot: ReferenceSlot;
}) {
  const label = slot.label ?? slot.kind;
  return (
    <div
      className="group relative flex size-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-[var(--tri-border-default)] bg-[var(--tri-bg-surface-alt)] transition-colors hover:border-[var(--tri-border-strong)] hover:bg-[var(--tri-bg-surface-raised)]"
      onClick={() => onOpen?.(slot)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onOpen?.(slot);
      }}
      role="button"
      tabIndex={0}
      aria-label={slot.previewUrl ? `Edit ${label}` : `Add ${label}`}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen?.(slot);
        }
      }}
    >
      {slot.previewUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={label}
            className="absolute inset-0 size-full rounded-lg object-cover"
            src={slot.previewUrl}
          />
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-[var(--tri-bg-scrim)] opacity-0 transition-opacity group-hover:opacity-100">
            <button
              className="rounded-full bg-[var(--tri-bg-surface)]/20 px-2 py-1 text-xs font-semibold text-white hover:bg-[var(--tri-bg-surface)]/30"
              onClick={(event) => {
                event.stopPropagation();
                onEdit?.(slot);
              }}
              type="button"
            >
              Edit
            </button>
          </div>
          <button
            aria-label={`Clear ${label}`}
            className="absolute -right-2 -top-2 rounded-full bg-[var(--tri-bg-surface)] p-0.5 text-[var(--tri-text-tertiary)] hover:text-[var(--tri-text-inverse)]"
            onClick={(event) => {
              event.stopPropagation();
              onClear?.(slot);
            }}
            type="button"
          >
            <CloseIcon />
          </button>
        </>
      ) : (
        <KindIcon kind={slot.kind} />
      )}
    </div>
  );
}

function KindIcon({ kind }: { kind: ReferenceSlotKind }) {
  if (kind === "video")
    return (
      <svg className="size-6 text-[var(--tri-text-tertiary)]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="m22 8-6 4 6 4V8Z" strokeLinecap="round" strokeLinejoin="round" />
        <rect height={12} width={14} x={2} y={6} rx={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (kind === "audio")
    return (
      <svg className="size-6 text-[var(--tri-text-tertiary)]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={6} cy={18} r={3} />
        <circle cx={18} cy={16} r={3} />
      </svg>
    );
  return (
    <svg className="size-6 text-[var(--tri-text-tertiary)]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="size-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CompareArrowsIcon(): ReactNode {
  return (
    <svg className="size-5 text-[var(--tri-text-tertiary)]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
