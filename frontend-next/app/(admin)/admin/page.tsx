// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

import { headers } from "next/headers";
import { BarChart } from "@/src/components/charts/bar-chart";
import { DonutChart } from "@/src/components/charts/donut-chart";
import { LineChart } from "@/src/components/charts/line-chart";
import { Card } from "@/src/components/ui/card";
import { requireRole } from "@/src/lib/auth/server";
import { DashboardFilters, MonthlyUsersChart, WorkspaceBarChart } from "@/src/features/admin";
import { overviewKpis } from "@/src/features/admin/components/admin-charts";
import { CleanupStuckJobsButton } from "@/src/features/admin/components/cleanup-stuck-jobs-button";
import { KpiIconBadge } from "@/src/features/admin/components/kpi-icon-badge";
import { resolveDashboardDateRange } from "@/src/features/admin/components/dashboard-date-range";
import type { DashboardData } from "@/src/features/admin";

// Defensive shapes for the two chart series the backend may add. The current
// /api/admin/dashboard route forwards only overview/mediaOverTime/activeRoles/
// generationHealth, so these stay empty until the route is extended (out of scope:
// that route is not an admin page file). Field names cover the likely aliases.
type WorkspaceStat = { workspace?: string; workspaceName?: string; name?: string; imagesGenerated?: number; videosGenerated?: number; audiosGenerated?: number; images?: number; videos?: number; audios?: number };
type MonthlyStat = { month?: string; date?: string; activeUsers?: number; users?: number; count?: number };
type DashboardCharts = { mediaPerWorkspace?: WorkspaceStat[]; monthlyActiveUsers?: MonthlyStat[] };

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Angular gates the full dashboard on a "superAdmin" tier with a "Restricted
  // View" fallback for org admins. The Next session Role union is only
  // "admin" | "user" | "creator" | "workflows" (src/lib/auth/session.ts) — there
  // is NO superAdmin role. Per task guidance we gate on `admin` and do NOT
  // invent a superAdmin role, so the dashboard renders in full to every admin.
  await requireRole(["admin"]);
  const filters = await searchParams;
  const { start, end, today } = resolveDashboardDateRange(filters);
  const queryParams = new URLSearchParams(
    Object.entries(filters).flatMap(([key, value]) =>
      key !== "range" && key !== "start_date" && key !== "end_date" && typeof value === "string"
        ? [[key, value]]
        : [],
    ),
  );
  if (start && end) {
    queryParams.set("start_date", start);
    queryParams.set("end_date", end);
  }
  const query = queryParams.toString();
  const incomingHeaders = await headers();
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/admin/dashboard?${query}`, {
    cache: "no-store",
    headers: { cookie: incomingHeaders.get("cookie") ?? "" },
  });
  const data: DashboardData = response.ok ? await response.json() : { overview: {}, mediaOverTime: [], activeRoles: [], generationHealth: [] };
  const extended = data as DashboardData & DashboardCharts;
  const kpis = overviewKpis(data.overview);
  const media = data.mediaOverTime.map((item) => ({ label: String(item.date ?? item.label ?? ""), value: Number(item.totalGenerated ?? item.total ?? item.count ?? 0) }));
  const health = data.generationHealth.map((item) => ({ x: item.date ?? item.status ?? "", y: Number(item.count ?? 0) }));
  const workspaces = (extended.mediaPerWorkspace ?? []).map((w) => ({ workspace: w.workspace ?? w.workspaceName ?? w.name ?? "—", images: Number(w.imagesGenerated ?? w.images ?? 0), videos: Number(w.videosGenerated ?? w.videos ?? 0), audios: Number(w.audiosGenerated ?? w.audios ?? 0) }));
  const monthly = (extended.monthlyActiveUsers ?? []).map((m) => ({ month: m.month ?? m.date ?? "—", users: Number(m.activeUsers ?? m.users ?? m.count ?? 0) }));

  return (
    <section className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Admin dashboard</h1>
          <p className="text-[var(--color-muted-foreground)]">Platform activity and health.</p>
        </div>
        <DashboardFilters initialEnd={end} initialStart={start} key={`${start}:${end}`} today={today} />
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {kpis.map((kpi) => (
          <Card as="article" className="flex min-w-0 flex-col items-center gap-2 text-center" key={kpi.key}>
            <KpiIconBadge accent={kpi.accent} iconKey={kpi.key} tooltip={kpi.tooltip} />
            <p className="text-3xl font-semibold tabular-nums">{kpi.value}</p>
            <p className="text-sm text-[var(--color-muted-foreground)]">{kpi.label}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-xl border p-5"><h2 className="mb-4 text-lg font-semibold">Media over time</h2><BarChart data={media} /></article>
        <article className="rounded-xl border p-5"><h2 className="mb-4 text-lg font-semibold">Role distribution</h2><DonutChart data={data.activeRoles.map(({ role, count }) => ({ label: role, value: count }))} /></article>
        <article className="rounded-xl border p-5 xl:col-span-2"><h2 className="mb-4 text-lg font-semibold">Generation health</h2><LineChart data={health} /></article>
        <article className="rounded-xl border p-5"><h2 className="mb-4 text-lg font-semibold">Media per workspace</h2><WorkspaceBarChart data={workspaces} /></article>
        <article className="rounded-xl border p-5"><h2 className="mb-4 text-lg font-semibold">Monthly active users</h2><MonthlyUsersChart data={monthly} /></article>
      </div>
      <CleanupStuckJobsButton />
    </section>
  );
}
