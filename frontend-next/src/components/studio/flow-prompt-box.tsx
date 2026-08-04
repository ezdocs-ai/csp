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

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Menu, MenuItem } from "@/src/components/ui";

/** A labelled selectable value shared by every chip + settings dropdown. */
export type FlowOption = {
  value: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
};

/** A generation mode (e.g. "Text to Video", "Concatenate Video"). */
export type FlowMode = { value: string; label: string };

export interface FlowPromptBoxProps {
  /** Mode (contextual selector, top-left). */
  mode: string;
  modes: FlowMode[];
  onModeChange: (mode: string) => void;
  /** Model chip (icon + label) + settings dropdown. */
  model: FlowOption | null;
  models: FlowOption[];
  onModelChange: (value: string) => void;
  /** Aspect ratio chip. `aspectRatio` is the raw value; only the ratio token is shown. */
  aspectRatio: string;
  aspectRatioOptions: FlowOption[];
  onAspectRatioChange: (value: string) => void;
  /** Outputs chip `x{n}`. */
  outputs: number;
  maxOutputs: number;
  onOutputsChange: (value: number) => void;
  /** Capability-gated chips. Omit options/callback to hide the chip. */
  duration?: number;
  durations?: FlowOption[];
  onDurationChange?: (value: number) => void;
  resolution?: string;
  resolutions?: FlowOption[];
  onResolutionChange?: (value: string) => void;
  /** Prompt. Caller computes the mode-aware placeholder + disabled flag. */
  prompt: string;
  onPromptChange: (value: string) => void;
  promptPlaceholder?: string;
  promptDisabled?: boolean;
  /** Actions. */
  isLoading: boolean;
  onGenerate: () => void;
  onRewrite?: () => void;
  generateDisabled?: boolean;
  /** Contextual reference-media slots rendered bottom-left (see ReferenceMediaStrip). */
  referenceSlots?: ReactNode;
}

export function FlowPromptBox({
  mode,
  modes,
  onModeChange,
  model,
  models,
  onModelChange,
  aspectRatio,
  aspectRatioOptions,
  onAspectRatioChange,
  outputs,
  maxOutputs,
  onOutputsChange,
  duration,
  durations,
  onDurationChange,
  resolution,
  resolutions,
  onResolutionChange,
  prompt,
  onPromptChange,
  promptPlaceholder,
  promptDisabled = false,
  isLoading,
  onGenerate,
  onRewrite,
  generateDisabled = false,
  referenceSlots,
}: FlowPromptBoxProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openField, setOpenField] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ponytail: single dismiss effect for the settings popover; mode menu uses <Menu>.
  useEffect(() => {
    if (!settingsOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
        setOpenField(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSettingsOpen(false);
        setOpenField(null);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [settingsOpen]);

  const showDuration = !!durations && durations.length > 0 && !!onDurationChange;
  const showResolution = !!resolutions && resolutions.length > 0 && !!onResolutionChange;
  const outputsRange = Array.from({ length: Math.max(1, maxOutputs) }, (_, i) => i + 1);
  const resolutionActive = resolutions?.find((r) => r.value === resolution) ?? null;

  function openSettings(field: string) {
    setSettingsOpen(true);
    setOpenField((current) => (current === field && settingsOpen ? null : field));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !promptDisabled) {
      event.preventDefault();
      onGenerate();
    }
  }

  return (
    <div className="relative z-[55] w-full max-w-2xl">
      {settingsOpen ? (
        <div
          className="absolute bottom-full right-0 z-[60] mb-3 w-[500px] max-w-[calc(100vw-2rem)] rounded-2xl border-[var(--tri-border-default)] bg-[var(--tri-bg-surface-raised)]/95 p-5 text-[var(--tri-text-secondary)] shadow-2xl backdrop-blur-md"
          ref={panelRef}
          role="dialog"
          aria-label="Generation settings"
        >
          <div className="grid grid-cols-2 gap-3">
            <SettingsDropdown
              label="Model"
              open={openField === "model"}
              display={
                <>
                  {model?.icon}
                  <span className="truncate">{model?.label ?? model?.value ?? "Model"}</span>
                </>
              }
              options={models}
              onSelect={(value) => {
                onModelChange(value);
                setOpenField(null);
              }}
              onToggle={() => openSettings("model")}
            />
            <SettingsDropdown
              label="Aspect Ratio"
              open={openField === "aspect"}
              display={
                <>
                  {aspectOptionsIcon(aspectRatio)}
                  <span className="truncate">{aspectRatio}</span>
                </>
              }
              options={aspectRatioOptions}
              onSelect={(value) => {
                onAspectRatioChange(value);
                setOpenField(null);
              }}
              onToggle={() => openSettings("aspect")}
            />
            <SettingsDropdown
              label="Outputs per prompt"
              open={openField === "outputs"}
              display={<span>x{outputs}</span>}
              options={outputsRange.map((n) => ({ value: String(n), label: `x${n}` }))}
              onSelect={(value) => {
                onOutputsChange(Number(value));
                setOpenField(null);
              }}
              onToggle={() => openSettings("outputs")}
            />
            {showDuration ? (
              <SettingsDropdown
                label="Duration"
                open={openField === "duration"}
                display={<span>{duration ?? durations?.[0]?.value}s</span>}
                options={durations ?? []}
                onSelect={(value) => {
                  onDurationChange?.(Number(value));
                  setOpenField(null);
                }}
                onToggle={() => openSettings("duration")}
              />
            ) : null}
            {showResolution ? (
              <SettingsDropdown
                label="Resolution"
                open={openField === "resolution"}
                display={
                  <>
                    {resolutionActive?.icon}
                    <span className="truncate">{resolutionActive?.label ?? resolution}</span>
                  </>
                }
                options={resolutions ?? []}
                onSelect={(value) => {
                  onResolutionChange?.(value);
                  setOpenField(null);
                }}
                onToggle={() => openSettings("resolution")}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="relative z-10 w-full rounded-3xl border-[var(--tri-border-default)] bg-[var(--tri-bg-surface)] p-5 text-[var(--tri-text-tertiary)] shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Menu
            align="start"
            className="inline-block"
            label="Generation mode"
            panelClassName="w-64"
            side="top"
            trigger={
              <span className="flex items-center gap-2 rounded-lg bg-[var(--tri-bg-surface-alt)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--tri-bg-surface-raised)]">
                {mode}
                <ChevronDownIcon />
              </span>
            }
          >
            {modes.map((entry) => (
              <MenuItem
                key={entry.value}
                onClick={() => onModeChange(entry.value)}
                selected={entry.value === mode}
              >
                {entry.label}
              </MenuItem>
            ))}
          </Menu>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Chip ariaExpanded={settingsOpen} onClick={() => openSettings("model")}>
              {model?.icon}
              <span>{model?.label ?? model?.value ?? "Model"}</span>
            </Chip>
            <Chip ariaExpanded={settingsOpen} onClick={() => openSettings("aspect")}>
              {aspectRatio.split(" ")[0]}
            </Chip>
            <Chip ariaExpanded={settingsOpen} onClick={() => openSettings("outputs")}>
              x{outputs}
            </Chip>
            {showDuration ? (
              <Chip ariaExpanded={settingsOpen} onClick={() => openSettings("duration")}>
                {duration ?? durations?.[0]?.value}s
              </Chip>
            ) : null}
            {showResolution ? (
              <Chip ariaExpanded={settingsOpen} onClick={() => openSettings("resolution")}>
                {resolutionActive?.icon ?? resolution}
              </Chip>
            ) : null}
          </div>
        </div>

        <div className="mt-4">
          <textarea
            aria-label="Generation prompt"
            className="w-full resize-none bg-transparent text-xl text-[var(--tri-text-secondary)] placeholder:text-[var(--tri-text-disabled)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={promptDisabled}
            id="flow-prompt"
            maxLength={10000}
            onChange={(event) => onPromptChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={promptPlaceholder}
            rows={4}
            value={prompt}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-y-4 border-t-[var(--tri-border-subtle)] pt-4">
          <div className="flex flex-wrap items-center gap-3">{referenceSlots}</div>
          <div className="flex items-center gap-2.5">
            {onRewrite ? (
              <button
                className="flex cursor-pointer items-center gap-1.5 rounded-full border-[var(--tri-border-default)] bg-[var(--tri-bg-surface-alt)] px-4 py-2 text-sm font-semibold text-[var(--tri-text-tertiary)] transition-colors hover:bg-[var(--tri-bg-surface-raised)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLoading}
                onClick={onRewrite}
                type="button"
              >
                <RewriteIcon />
                <span>Rewrite</span>
              </button>
            ) : null}
            <button
              className="flex cursor-pointer items-center gap-1.5 rounded-full bg-[var(--tri-bg-surface)] px-5 py-2 text-sm font-bold text-[var(--tri-text-primary)] transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              disabled={isLoading || generateDisabled}
              onClick={onGenerate}
              type="button"
            >
              <SparkIcon />
              <span className="bg-[image:var(--tri-gradient-brand-text)] bg-clip-text text-transparent">
                {isLoading ? "Generating..." : "Generate"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({
  ariaExpanded,
  children,
  onClick,
}: {
  ariaExpanded: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      aria-expanded={ariaExpanded}
      className="flex cursor-pointer items-center gap-1.5 rounded-md bg-[var(--tri-bg-surface-alt)] px-2.5 py-1 text-[var(--tri-text-secondary)] transition-colors hover:bg-[var(--tri-bg-surface-raised)]"
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function SettingsDropdown({
  display,
  label,
  onSelect,
  onToggle,
  open,
  options,
}: {
  display: ReactNode;
  label: string;
  onSelect: (value: string) => void;
  onToggle: () => void;
  open: boolean;
  options: FlowOption[];
}) {
  return (
    <div className="relative">
      <label className="mb-1.5 block text-xs font-medium text-[var(--tri-text-tertiary)]">{label}</label>
      <button
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-lg border-[var(--tri-border-subtle)] bg-[var(--tri-bg-surface-alt)] px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--tri-bg-surface-raised)]"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        type="button"
      >
        <span className="flex items-center gap-1.5 truncate">{display}</span>
        <ChevronDownIcon className={open ? "rotate-180" : ""} />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border-[var(--tri-border-default)] bg-[var(--tri-bg-surface-alt)] p-1 shadow-lg">
          {options.map((option) => (
            <button
              className="flex w-full cursor-pointer items-center gap-1.5 rounded px-3 py-1.5 text-left text-sm text-[var(--tri-text-tertiary)] hover:bg-[var(--tri-bg-surface-raised)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={option.disabled}
              key={option.value}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(option.value);
              }}
              type="button"
            >
              {option.icon}
              <span className="truncate">{option.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function aspectOptionsIcon(ratio: string): ReactNode {
  const box = "size-4";
  if (ratio.includes("1:1")) {
    return (
      <svg className={box} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <rect height={14} rx={2} width={14} x={5} y={5} />
      </svg>
    );
  }
  if (ratio.includes("16:9") || ratio.includes("21:9")) {
    return (
      <svg className={box} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <rect height={12} rx={2} width={18} x={3} y={6} />
      </svg>
    );
  }
  return (
    <svg className={box} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <rect height={18} rx={2} width={12} x={6} y={3} />
    </svg>
  );
}

function ChevronDownIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`size-4 flex-shrink-0 text-[var(--tri-text-tertiary)] transition-transform ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RewriteIcon() {
  return (
    <svg className="size-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg className="size-4 fill-[var(--tri-brand-violet)] text-[var(--tri-brand-violet)]" viewBox="0 0 24 24">
      <path d="M12 2a1 1 0 011 1v3.17c2.11.45 3.82 2.16 4.27 4.27H20.5a1 1 0 110 2h-3.23c-.45 2.11-2.16 3.82-4.27 4.27V21a1 1 0 11-2 0v-3.17c-2.11-.45-3.82-2.16-4.27-4.27H3.5a1 1 0 110-2h3.23c.45-2.11 2.16-3.82 4.27-4.27V3a1 1 0 011-1z" />
    </svg>
  );
}
