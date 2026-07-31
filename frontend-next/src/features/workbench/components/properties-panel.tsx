"use client";
/** Copyright 2026 Google LLC — Apache-2.0 */

import { useState } from "react";

// ponytail: Angular wires these studio-sliders to nothing (hardcoded value=50,
// broken valueText bindings). We mirror the groups/labels for parity and back
// them with local state so the readout is live; upgrade to real filter pipeline
// when backend exposes per-clip color grading.
const RATIOS = ["16:9", "9:16", "1:1", "4:3"] as const;
const GROUPS = [
  { name: "Lighting", sliders: ["Exposure", "Contrast", "Highlights", "Shadows", "Whites", "Blacks"] },
  { name: "Colors", sliders: ["Temp", "Tint", "Vibrance", "Saturation"] },
  { name: "Effects", sliders: ["Texture", "Clarity", "Dehaze", "Vignette", "Grain size", "Grain Roughness"] },
  { name: "Detail", sliders: ["Sharpning", "Radius", "Detail"] },
] as const;

export function PropertiesPanel() {
  const [ratio, setRatio] = useState<string>("16:9");
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(GROUPS.flatMap((group) => group.sliders).map((slider) => [slider, 50])),
  );

  return (
    <section aria-label="Properties" className="grid content-start gap-[var(--tri-space-4)]">
      <h2 className="text-[length:var(--tri-text-h4-size)] font-[var(--tri-font-weight-semibold)]">Properties</h2>

      <div>
        <h3 className="mb-[var(--tri-space-2)] text-[length:var(--tri-text-small-size)] font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-secondary)]">
          Aspect Ratio
        </h3>
        <div className="grid grid-cols-4 gap-[var(--tri-space-2)]">
          {RATIOS.map((value) => (
            <button
              aria-pressed={ratio === value}
              className={`inline-flex min-h-[var(--tri-control-height-md)] items-center justify-center rounded-[var(--tri-radius-lg)] text-[length:var(--tri-text-small-size)] ${
                ratio === value
                  ? "border border-[var(--tri-brand-primary)] bg-[var(--tri-brand-primary)] text-[var(--tri-brand-on-primary)]"
                  : "border border-[var(--tri-border-default)] text-[var(--tri-text-secondary)]"
              }`}
              key={value}
              onClick={() => setRatio(value)}
              type="button"
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {GROUPS.map((group) => (
        <details className="rounded-[var(--tri-radius-lg)] border border-[var(--tri-border-subtle)]" key={group.name} open>
          <summary className="flex min-h-[var(--tri-control-height-md)] cursor-pointer items-center gap-[var(--tri-space-2)] px-[var(--tri-space-3)] text-[length:var(--tri-text-small-size)] font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-primary)]">
            {group.name}
          </summary>
          <div className="grid gap-[var(--tri-space-3)] px-[var(--tri-space-3)] pb-[var(--tri-space-3)]">
            {group.sliders.map((slider) => (
              <label className="grid gap-[var(--tri-space-1)] text-[length:var(--tri-text-small-size)] text-[var(--tri-text-secondary)]" key={slider}>
                <span className="flex justify-between">
                  <span>{slider}</span>
                  <span>{values[slider]}%</span>
                </span>
                <input
                  className="min-h-[var(--tri-control-height-md)] w-full accent-[var(--tri-brand-primary)]"
                  max={100}
                  min={10}
                  onChange={(event) => setValues((current) => ({ ...current, [slider]: Number(event.target.value) }))}
                  step={5}
                  type="range"
                  value={values[slider]}
                />
              </label>
            ))}
          </div>
        </details>
      ))}
    </section>
  );
}
