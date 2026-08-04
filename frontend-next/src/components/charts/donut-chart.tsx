// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

export function DonutChart({
  data,
  size = 180,
}: {
  data: { label: string; value: number; color?: string }[];
  size?: number;
}) {
  const total = data.reduce((sum, { value }) => sum + value, 0) || 1;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const segments = data.map(({ value }, index) => ({
    length: (value / total) * circumference,
    offset: data.slice(0, index).reduce((sum, item) => sum + (item.value / total) * circumference, 0),
  }));

  return (
    <div className="flex items-center gap-[var(--tri-space-4)]">
      <svg aria-label="Role distribution" height={size} role="img" viewBox="0 0 100 100" width={size}>
        {data.map(({ label, value, color }, index) => <circle cx="50" cy="50" fill="none" key={label} r={radius} stroke={color ?? `var(--chart-${(index % 5) + 1}, var(--color-primary, currentColor))`} strokeDasharray={`${segments[index].length} ${circumference - segments[index].length}`} strokeDashoffset={-segments[index].offset} strokeWidth="16" transform="rotate(-90 50 50)"><title>{`${label}: ${value}`}</title></circle>)}
      </svg>
      <ul className="space-y-[var(--tri-space-1)] text-[length:var(--tri-text-small-size)]">{data.map(({ label, value }) => <li key={label}>{label}: {value}</li>)}</ul>
    </div>
  );
}
