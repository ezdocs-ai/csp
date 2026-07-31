"use client";
/** Copyright 2026 Google LLC — Apache-2.0 */

import { useMemo, useState, type KeyboardEvent } from "react";
import { Tooltip } from "@/src/components/ui";
import { AssetsPanel } from "./assets-panel";
import { PreviewCanvas } from "./preview-canvas";
import { PropertiesPanel } from "./properties-panel";
import { RenderPanel } from "./render-panel";
import { TimelineEditor } from "./timeline-editor";
import { TransportControls } from "./transport-controls";
import { usePlayback } from "../hooks/use-playback";
import { useTimelineState } from "../hooks/use-timeline-state";
import { toggleTrack, totalDuration, visibleClips } from "@/src/features/workbench";

type Tool = "gallery" | "audio" | "stories" | "edit";

// Order matches Angular's tool rail. `agent` (Angular's 5th, always disabled)
// is omitted per task scope. audio/stories stay disabled "coming soon" like
// Angular; edit is enabled here so the Properties panel is reachable.
const TOOLS: { id: Tool; label: string; glyph: string; hint?: string }[] = [
  { id: "gallery", label: "Gallery", glyph: "🖼" },
  { id: "audio", label: "Audio", glyph: "♪", hint: "Audio coming soon!" },
  { id: "stories", label: "Stories", glyph: "▦", hint: "Stories coming soon!" },
  { id: "edit", label: "Edit", glyph: "✎" },
];

export function Workbench() {
  const { timeline, addClip, moveClip, trimClip, splitClip, removeClip, errors } = useTimelineState();
  const duration = useMemo(() => Math.max(timeline.durationSeconds, totalDuration(timeline.clips)), [timeline]);
  const playback = usePlayback(duration);
  const [hiddenTracks, setHiddenTracks] = useState<ReadonlySet<string>>(() => new Set());
  const [lockedTracks, setLockedTracks] = useState<ReadonlySet<string>>(() => new Set());
  const [activeTool, setActiveTool] = useState<Tool | null>(null);
  const [tabFocus, setTabFocus] = useState(0);
  const renderTimeline = { ...timeline, durationSeconds: duration };
  const previewClips = useMemo(() => visibleClips(timeline.clips, hiddenTracks), [timeline.clips, hiddenTracks]);

  function onToolKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = TOOLS.length - 1;
    let next = tabFocus;
    if (event.key === "ArrowRight") next = tabFocus >= last ? 0 : tabFocus + 1;
    else if (event.key === "ArrowLeft") next = tabFocus <= 0 ? last : tabFocus - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;
    event.preventDefault();
    setTabFocus(next);
    const tool = TOOLS[next];
    requestAnimationFrame(() => document.getElementById(`workbench-tab-${tool.id}`)?.focus());
    // Disabled ("coming soon") tabs are focusable so their tooltip hint is
    // keyboard-reachable, but never activate.
    if (!tool.hint) setActiveTool(tool.id);
  }

  return (
    <div className="grid gap-[var(--tri-space-4)] rounded-[var(--tri-card-radius)] bg-[var(--tri-surface-base)] p-[var(--tri-space-4)]">
      <Tooltip
        content="This is currently under development; it does not save content. Use at your own risk and download your work before leaving this page."
        multiline
      >
        <span className="inline-flex w-fit items-center rounded-full border border-[var(--tri-status-info-border)] bg-[var(--tri-status-info-bg)] px-[var(--tri-space-3)] py-[var(--tri-space-1)] text-[length:var(--tri-text-small-size)] font-[var(--tri-font-weight-semibold)] text-[var(--tri-brand-primary)]">
          BETA
        </span>
      </Tooltip>

      <div
        className={`grid items-start gap-[var(--tri-space-4)] ${
          activeTool ? "lg:grid-cols-[minmax(18rem,20rem)_minmax(0,1fr)]" : ""
        }`}
      >
        {activeTool !== null && (
          <aside
            aria-labelledby={`workbench-tab-${activeTool}`}
            className="min-h-0"
            id="workbench-panel"
            role="tabpanel"
          >
            {activeTool === "gallery" && <AssetsPanel onAddToTimeline={addClip} />}
            {activeTool === "edit" && <PropertiesPanel />}
          </aside>
        )}
        <section className="grid content-start gap-[var(--tri-space-4)]">
          <PreviewCanvas clips={previewClips} currentTime={playback.currentTime} />
          <TransportControls {...playback} />
        </section>
      </div>

      <div className="grid content-start gap-[var(--tri-space-4)]">
        <div
          aria-label="Workbench tools"
          className="flex flex-wrap gap-[var(--tri-space-2)]"
          onKeyDown={onToolKeyDown}
          role="tablist"
        >
          {TOOLS.map((tool, index) => {
            const selected = activeTool === tool.id;
            const disabled = Boolean(tool.hint);
            const button = (
              <button
                aria-controls="workbench-panel"
                aria-disabled={disabled || undefined}
                aria-label={tool.hint ? `${tool.label}: ${tool.hint}` : tool.label}
                aria-selected={selected}
                className={`inline-flex min-h-[var(--tri-control-height-md)] min-w-[var(--tri-control-height-md)] items-center justify-center gap-[var(--tri-space-1)] rounded-full px-[var(--tri-space-3)] text-[length:var(--tri-text-small-size)] ${
                  selected
                    ? "bg-[var(--tri-brand-primary)] text-[var(--tri-brand-on-primary)]"
                    : "border border-[var(--tri-border-default)] text-[var(--tri-text-secondary)]"
                }`}
                id={`workbench-tab-${tool.id}`}
                key={tool.id}
                onClick={() => {
                  if (disabled) return;
                  setTabFocus(index);
                  setActiveTool(selected ? null : tool.id);
                }}
                role="tab"
                tabIndex={index === tabFocus ? 0 : -1}
                type="button"
              >
                <span aria-hidden="true">{tool.glyph}</span>
                {selected && <span>{tool.label}</span>}
              </button>
            );
            return tool.hint ? (
              <Tooltip content={tool.hint} key={tool.id}>
                {button}
              </Tooltip>
            ) : (
              button
            );
          })}
        </div>

        <TimelineEditor
          clips={timeline.clips}
          currentTime={playback.currentTime}
          duration={duration}
          hiddenTracks={hiddenTracks}
          lockedTracks={lockedTracks}
          onDelete={removeClip}
          onMove={moveClip}
          onSeek={playback.seek}
          onSplit={splitClip}
          onToggleHidden={(key) => setHiddenTracks((current) => toggleTrack(current, key))}
          onToggleLocked={(key) => setLockedTracks((current) => toggleTrack(current, key))}
          onTrim={trimClip}
        />
        {errors.length > 0 && (
          <div
            className="rounded-[var(--tri-card-radius)] border border-[var(--tri-status-danger-border)] p-[var(--tri-space-3)] text-sm text-[var(--tri-status-danger-fg)]"
            role="alert"
          >
            Timeline invalid: {errors.join(" ")}
          </div>
        )}
        <RenderPanel disabled={errors.length > 0} timeline={renderTimeline} />
      </div>
    </div>
  );
}
