/** Copyright 2026 Google LLC — Apache-2.0 */

export type DashboardDateRange = { start: string; end: string; today: string };

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Matches Angular admin initialization: first through last day of this month. */
export function defaultDashboardDateRange(now = new Date()): DashboardDateRange {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: formatLocalDate(start), end: formatLocalDate(end), today: formatLocalDate(now) };
}

export function resolveDashboardDateRange(
  filters: Record<string, string | string[] | undefined>,
  now = new Date(),
): DashboardDateRange {
  const defaults = defaultDashboardDateRange(now);
  if (filters.range === "all") return { ...defaults, start: "", end: "" };
  const start = typeof filters.start_date === "string" ? filters.start_date : "";
  const end = typeof filters.end_date === "string" ? filters.end_date : "";
  return start && end ? { ...defaults, start, end } : defaults;
}
