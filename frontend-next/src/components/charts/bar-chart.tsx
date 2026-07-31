// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

export function BarChart({
  data,
  height = 220,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  const width = 640;
  const max = Math.max(...data.map(({ value }) => value), 1);
  const gap = 12;
  const barWidth = Math.max((width - gap * (data.length + 1)) / Math.max(data.length, 1), 1);

  return (
    <svg aria-label="Media generated over time" className="h-auto w-full" role="img" viewBox={`0 0 ${width} ${height}`}>
      {data.map(({ label, value }, index) => {
        const barHeight = (value / max) * (height - 34);
        const x = gap + index * (barWidth + gap);
        return (
          <g key={label}>
            <title>{`${label}: ${value}`}</title>
            <rect fill="var(--color-primary, currentColor)" height={barHeight} rx="4" width={barWidth} x={x} y={height - 22 - barHeight} />
            <text fill="currentColor" fontSize="10" textAnchor="middle" x={x + barWidth / 2} y={height - 6}>{label}</text>
          </g>
        );
      })}
    </svg>
  );
}
