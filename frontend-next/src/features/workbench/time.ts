/** Copyright 2026 Google LLC — Apache-2.0 */

export function formatTime(seconds: number): string {
  const totalMilliseconds = Math.max(0, Math.round(seconds * 1000));
  const milliseconds = totalMilliseconds % 1000;
  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  const secs = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  const time = [minutes.toString().padStart(2, "0"), secs.toString().padStart(2, "0")].join(":");

  return `${hours > 0 ? `${hours.toString().padStart(2, "0")}:` : ""}${time}.${milliseconds.toString().padStart(3, "0")}`;
}

export function parseTime(value: string): number {
  const match = /^(?:(\d+):)?(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(value.trim());
  if (!match) {
    return Number.NaN;
  }

  const [, hours = "0", minutes, seconds, milliseconds = "0"] = match;
  const minuteValue = Number(minutes);
  const secondValue = Number(seconds);
  if (minuteValue >= 60 || secondValue >= 60) {
    return Number.NaN;
  }

  return Number(hours) * 3600 + minuteValue * 60 + secondValue + Number(milliseconds.padEnd(3, "0")) / 1000;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function snapToGrid(value: number, gridMs: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(gridMs) || gridMs <= 0) {
    return value;
  }

  const gridSeconds = gridMs / 1000;
  return Math.round(value / gridSeconds) * gridSeconds;
}
