// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

export function LineChart({
  data,
  height = 220,
}: {
  data: { x: string | number; y: number }[];
  height?: number;
}) {
  const width = 640;
  const max = Math.max(...data.map(({ y }) => y), 1);
  const points = data.map(({ y }, index) => `${(index / Math.max(data.length - 1, 1)) * (width - 24) + 12},${height - 28 - (y / max) * (height - 48)}`).join(" ");

  return (
    <svg aria-label="Generation health" className="h-auto w-full" role="img" viewBox={`0 0 ${width} ${height}`}>
      <polyline fill="none" points={points} stroke="var(--color-primary, currentColor)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
      {data.map(({ x, y }, index) => <circle cx={(index / Math.max(data.length - 1, 1)) * (width - 24) + 12} cy={height - 28 - (y / max) * (height - 48)} fill="var(--color-primary, currentColor)" key={`${x}-${index}`} r="4"><title>{`${x}: ${y}`}</title></circle>)}
    </svg>
  );
}
