/** Copyright 2026 Google LLC — Apache-2.0 */
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "bun:test";

import { KpiIconBadge } from "@/src/features/admin/components/kpi-icon-badge";
import { OVERVIEW_KPIS, overviewKpis } from "@/src/features/admin/components/admin-charts";

test("KpiIconBadge renders an SVG for every overview KPI key", () => {
  // Locks the contract that kept /admin at HTTP 500 before: the badge must own
  // the icon + Tooltip so Tooltip's cloneElement receives a concrete (client)
  // child instead of a lazy RSC node crossing the server→client boundary.
  for (const kpi of overviewKpis({})) {
    const html = renderToStaticMarkup(<KpiIconBadge accent={kpi.accent} iconKey={kpi.key} tooltip={kpi.tooltip} />);
    expect(html).toContain("<svg");
    expect(html).toContain(kpi.accent);
  }
});

test("KpiIconBadge renders no icon for an unknown key (defensive)", () => {
  const html = renderToStaticMarkup(<KpiIconBadge accent="text-pink-400" iconKey="does_not_exist" tooltip="x" />);
  expect(html).not.toContain("<svg");
});

test("every OVERVIEW_KPIS key has a matching badge icon (no missing glyph)", () => {
  // Re-render each and count svg; ensures a future KPI addition surfaces here
  // rather than as a blank badge in production.
  const missing = OVERVIEW_KPIS.map((k) => k.key).filter(
    (key) => !renderToStaticMarkup(<KpiIconBadge accent="x" iconKey={key} tooltip="t" />).includes("<svg"),
  );
  expect(missing).toEqual([]);
});
