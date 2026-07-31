/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import type { ReactElement } from "react";

import { Tooltip } from "@/src/components/ui/tooltip";

// Decorative inline SVGs for the eight overview KPIs. No icon dependency —
// paths mirror the Angular Material glyph intent (group/business/image/movie/
// audiotrack/perm_media/cloud_upload/analytics) using simple geometry.
//
// This component is a Client Component on purpose: `Tooltip` calls
// `cloneElement(children, …)`, which only works on a concrete React element.
// When `Tooltip` is used from a Server Component the children cross the RSC
// boundary as a lazy node and `cloneElement` yields `{ type: undefined }`
// ("Element type is invalid: got undefined"). Keeping the icon + Tooltip in a
// single client module guarantees Tooltip receives real client-side children.
function GroupIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} viewBox="0 0 24 24"><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.5a3 3 0 0 1 0 5" /><path d="M18 20a6 6 0 0 0-3-5.2" /></svg>);
}
function BusinessIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} viewBox="0 0 24 24"><rect height="18" rx="1.5" width="16" x="4" y="3" /><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2" /><path d="M10 21v-3h4v3" /></svg>);
}
function ImageIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} viewBox="0 0 24 24"><rect height="16" rx="2" width="18" x="3" y="4" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="m4 17 4-4 3 3 4-5 5 6" /></svg>);
}
function MovieIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>);
}
function AudioIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M9 18V6l10-2v12" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></svg>);
}
function PermMediaIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} viewBox="0 0 24 24"><rect height="11" rx="2" width="14" x="3" y="6" /><path d="M7 6V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-1" /></svg>);
}
function CloudUploadIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.34 9 4 4 0 0 0 6 17h2" /><path d="M12 12v8M9 15l3-3 3 3" /></svg>);
}
function AnalyticsIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M4 20h16" /><path d="M7 20v-6M12 20V8M17 20v-9" /></svg>);
}

const KPI_ICONS: Record<string, (props: { className?: string }) => ReactElement> = {
  total_users: GroupIcon,
  total_workspaces: BusinessIcon,
  images_generated: ImageIcon,
  videos_generated: MovieIcon,
  audios_generated: AudioIcon,
  total_media: PermMediaIcon,
  user_uploaded_media: CloudUploadIcon,
  overall_total_media: AnalyticsIcon,
};

export interface KpiIconBadgeProps {
  /** Snake_case key matching AdminOverviewStats (see admin-charts OVERVIEW_KPIS). */
  iconKey: string;
  /** Tailwind text-color class tinting the icon glyph. */
  accent: string;
  /** Hover/focus tooltip text. */
  tooltip: string;
}

/** Circular KPI icon badge with a hover tooltip. Must be rendered from the
 *  client (see file header) so `Tooltip`'s `cloneElement` receives a real child. */
export function KpiIconBadge({ iconKey, accent, tooltip }: KpiIconBadgeProps) {
  const Icon = KPI_ICONS[iconKey];
  return (
    <Tooltip content={tooltip} position="top">
      <span className={`inline-flex size-10 items-center justify-center rounded-full ${accent}`}>
        {Icon ? <Icon className="size-6" /> : null}
      </span>
    </Tooltip>
  );
}
