// Copyright 2026 Google LLC — Apache-2.0

// Plain SVG/CSS approximations of Angular's D3 admin-dashboard charts.
// No charting dependency: workspace chart is a flex column of div segments;
// monthly-users chart is one <svg> with a <polyline/> + gradient <polygon/>.
// ponytail: no interactive hover tooltips/axis ticks like Angular's D3 impl —
// add when a shared chart-tooltip primitive lands in src/components/charts.

export interface WorkspaceBar {
  workspace: string;
  images: number;
  videos: number;
  audios: number;
}

export interface MonthlyUsersPoint {
  month: string;
  users: number;
}

/**
 * The eight platform-overview KPIs, in stable display order. `sourceKey`
 * matches FastAPI's camelCase wire aliases; `key` remains the stable UI/icon
 * identifier. Labels/tooltips mirror the Angular
 * admin-home cards; `accent` is a Tailwind text-color class matching the
 * Angular mat-icon tint per metric. Pure data — unit-tested.
 */
export interface OverviewKpiDescriptor {
  key: string;
  sourceKey: string;
  label: string;
  tooltip: string;
  accent: string;
}

export const OVERVIEW_KPIS: OverviewKpiDescriptor[] = [
  { key: "total_users", sourceKey: "totalUsers", label: "Total Users", tooltip: "Count of all registered users on the platform.", accent: "text-blue-400" },
  { key: "total_workspaces", sourceKey: "totalWorkspaces", label: "Workspaces", tooltip: "Count of all workspaces created.", accent: "text-purple-400" },
  { key: "images_generated", sourceKey: "imagesGenerated", label: "Images Gen.", tooltip: "Total number of AI-generated images.", accent: "text-red-400" },
  { key: "videos_generated", sourceKey: "videosGenerated", label: "Videos Gen.", tooltip: "Total number of AI-generated videos.", accent: "text-green-400" },
  { key: "audios_generated", sourceKey: "audiosGenerated", label: "Audios Gen.", tooltip: "Total number of AI-generated audios.", accent: "text-yellow-400" },
  { key: "total_media", sourceKey: "totalMedia", label: "AI Media Total", tooltip: "Combined total of all AI-generated assets (Images + Videos + Audios).", accent: "text-teal-400" },
  { key: "user_uploaded_media", sourceKey: "userUploadedMedia", label: "Uploaded", tooltip: "Count of all user uploaded source assets.", accent: "text-indigo-400" },
  { key: "overall_total_media", sourceKey: "overallTotalMedia", label: "Overall Total", tooltip: "Overall total of all media assets combined (AI Generated + Uploaded).", accent: "text-orange-400" },
];

/** Resolve overview values into the stable ordered KPI rows. Pure — unit-tested. */
export function overviewKpis(overview: Record<string, number | undefined> | undefined): Array<OverviewKpiDescriptor & { value: number }> {
  const source = overview ?? {};
  return OVERVIEW_KPIS.map((kpi) => ({ ...kpi, value: Number(source[kpi.sourceKey] ?? 0) }));
}

/**
 * Stacked-bar geometry. Returns the column height as a percentage of the chart
 * area (against `max` total) plus the per-segment flex-grow weights. Pure —
 * unit-tested.
 */
export function stackedHeights(bar: WorkspaceBar, max: number) {
  const ceiling = Math.max(max, 1);
  const total = bar.images + bar.videos + bar.audios;
  return { total, columnPercent: (total / ceiling) * 100 };
}

/**
 * Line-chart point string for a monthly-active-users series. Pure — unit-tested.
 */
export function linePoints(data: MonthlyUsersPoint[], width: number, height: number): string {
  const max = Math.max(...data.map((d) => d.users), 1);
  const x = (i: number) => (i / Math.max(data.length - 1, 1)) * (width - 24) + 12;
  const y = (v: number) => height - 28 - (v / max) * (height - 48);
  return data.map((d, i) => `${x(i)},${y(d.users)}`).join(" ");
}

/** Stacked bar chart: media per workspace (images + videos + audios). */
export function WorkspaceBarChart({ data, height = 240 }: { data: WorkspaceBar[]; height?: number }) {
  const max = Math.max(...data.map((d) => d.images + d.videos + d.audios), 1);
  const summary = `Stacked bar chart of media per workspace. ${data.length} workspaces. ${data
    .map((d) => `${d.workspace}: ${d.images + d.videos + d.audios} total (${d.images} images, ${d.videos} videos, ${d.audios} audios)`)
    .join("; ")}`;
  return (
    <div>
      <div aria-label={summary} role="img">
        {data.length === 0 ? <p className="py-[var(--tri-space-8)] text-center text-[var(--tri-text-tertiary)]">No workspace data.</p> : null}
        <div className="flex items-end gap-[var(--tri-space-2)]" style={{ height }}>
          {data.map((bar) => {
            const h = stackedHeights(bar, max);
            return (
              <div className="flex min-w-[2.5rem] flex-1 flex-col justify-end" key={bar.workspace} style={{ height: `${h.columnPercent}%` }} title={`${bar.workspace}: ${h.total}`}>
                <div className="flex w-full flex-1 flex-col-reverse overflow-hidden rounded-t-[var(--tri-radius-sm)]">
                  <span aria-hidden="true" style={{ flexGrow: bar.images }} className="bg-[var(--tri-data-viz-1)]" />
                  <span aria-hidden="true" style={{ flexGrow: bar.videos }} className="bg-[var(--tri-data-viz-2)]" />
                  <span aria-hidden="true" style={{ flexGrow: bar.audios }} className="bg-[var(--tri-data-viz-3)]" />
                </div>
                <span className="mt-[var(--tri-space-1)] truncate text-[length:var(--tri-text-small-size)] text-[var(--tri-text-secondary)]">{bar.workspace}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-[var(--tri-space-3)] flex flex-wrap gap-[var(--tri-space-3)] text-[length:var(--tri-text-small-size)] text-[var(--tri-text-secondary)]">
          <span className="inline-flex items-center gap-[var(--tri-space-1)]"><span aria-hidden="true" className="inline-block size-2 bg-[var(--tri-data-viz-1)]" />Images</span>
          <span className="inline-flex items-center gap-[var(--tri-space-1)]"><span aria-hidden="true" className="inline-block size-2 bg-[var(--tri-data-viz-2)]" />Videos</span>
          <span className="inline-flex items-center gap-[var(--tri-space-1)]"><span aria-hidden="true" className="inline-block size-2 bg-[var(--tri-data-viz-3)]" />Audios</span>
        </p>
      </div>
      <table className="sr-only">
        <caption>Media per workspace</caption>
        <thead><tr><th scope="col">Workspace</th><th scope="col">Images</th><th scope="col">Videos</th><th scope="col">Audios</th><th scope="col">Total</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.workspace}><th scope="row">{d.workspace}</th><td>{d.images}</td><td>{d.videos}</td><td>{d.audios}</td><td>{d.images + d.videos + d.audios}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

/** Line + area chart with gradient: monthly active users evolution. */
export function MonthlyUsersChart({ data, height = 240 }: { data: MonthlyUsersPoint[]; height?: number }) {
  const width = 640;
  const max = Math.max(...data.map((d) => d.users), 1);
  const x = (i: number) => (i / Math.max(data.length - 1, 1)) * (width - 24) + 12;
  const yOf = (v: number) => height - 28 - (v / max) * (height - 48);
  const line = linePoints(data, width, height);
  const base = height - 28;
  const area = `${12},${base} ${line} ${width - 12},${base}`;
  const summary = `Line chart of monthly active users. ${data.length} months. ${data.map((d) => `${d.month}: ${d.users}`).join("; ")}`;
  return (
    <div>
      <svg aria-label={summary} className="h-auto w-full" role="img" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="mau-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--tri-data-viz-1)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--tri-data-viz-1)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {data.length === 0 ? (
          <text aria-label="No monthly active user data" fill="var(--tri-text-tertiary)" textAnchor="middle" x={width / 2} y={height / 2}>No monthly active user data.</text>
        ) : (
          <>
            <polygon fill="url(#mau-area)" points={area} />
            <polyline fill="none" points={line} stroke="var(--tri-data-viz-1)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
            {data.map((d, i) => <circle cx={x(i)} cy={yOf(d.users)} fill="var(--tri-data-viz-1)" key={`${d.month}-${i}`} r="4"><title>{`${d.month}: ${d.users}`}</title></circle>)}
          </>
        )}
      </svg>
      <table className="sr-only">
        <caption>Monthly active users</caption>
        <thead><tr><th scope="col">Month</th><th scope="col">Active users</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.month}><th scope="row">{d.month}</th><td>{d.users}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
