/** Copyright 2026 Google LLC — Apache-2.0 */
import { SourceAssetAdmin } from "@/src/features/source-assets";
import { requireRole } from "@/src/lib/auth/server";

export default async function SourceAssetsPage() {
  await requireRole(["admin"]);
  return <section className="space-y-[var(--tri-space-6)] px-[var(--tri-layout-gutter)] py-[var(--tri-space-8)]"><div><h1 className="font-[var(--tri-font-display)] text-[var(--tri-text-h2-size)]">Source assets</h1><p className="text-[var(--tri-text-secondary)]">Manage files available to creative tools.</p></div><SourceAssetAdmin /></section>;
}
