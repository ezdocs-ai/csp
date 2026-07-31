/* Copyright 2026 Google LLC
 * Licensed under Apache-2.0
 */

import { GalleryView, type GalleryResponse, type GallerySearch } from "@/src/features/gallery";
import { getServerApiClient } from "@/src/lib/api/server";
import { requireUser } from "@/src/lib/auth/server";
import { listWorkspaces } from "@/src/lib/workspace";

export default async function GalleryPage(props: PageProps<"/gallery">) {
  const session = await requireUser();
  const searchParams = await props.searchParams; const page = Math.max(1, Number(searchParams.page ?? 1)); const pageSize = 24;
  const client = await getServerApiClient();
  if (!client) return <section className="mx-auto grid max-w-[var(--tri-layout-content)] gap-[var(--tri-space-6)] px-[var(--tri-layout-gutter)] py-[var(--tri-space-8)]"><h1 className="font-[var(--tri-font-display)] text-[var(--tri-text-h1-size)]">Gallery</h1><p className="text-[var(--tri-text-secondary)]">Sign in to view gallery media.</p></section>;
  let workspaceId = numberValue(searchParams.workspaceId);
  if (!workspaceId) {
    const [workspace] = await listWorkspaces(client);
    workspaceId = Number(workspace?.id);
    if (!Number.isInteger(workspaceId) || workspaceId < 1) throw new Error("No workspace available.");
    // The shell's WorkspaceSwitcher owns URL synchronization. Rendering the
    // first workspace directly avoids racing its router.replace with a server
    // redirect during hydration.
  }
  const isAdmin = session.roles.includes("admin");
  // Resolve the numeric user id (for "My tags") and the workspace tag catalogue
  // in parallel. Both are best-effort: a failure must not break the gallery.
  const [profileResult, tagsResult] = await Promise.allSettled([
    client.get<{ id: number }>("/api/users/me"),
    client.post<{ data: { name: string; userId?: number | null }[] | null }>(
      "/api/tags/search",
      JSON.stringify({ workspaceId, limit: 100 }),
    ),
  ]);
  const userId = profileResult.status === "fulfilled" ? profileResult.value.id : undefined;
  const tags =
    tagsResult.status === "fulfilled" && Array.isArray(tagsResult.value.data)
      ? tagsResult.value.data.map((t) => ({ name: t.name, userId: t.userId ?? null }))
      : [];
  // "Only my media" (`mine=1`) overrides any @-search owner with the session email.
  const mine = searchParams.mine === "1";
  const request: GallerySearch = { limit: pageSize, offset: (page - 1) * pageSize, includeDeleted: false, workspaceId, status: statusValue(searchParams.status), mimeType: stringValue(searchParams.type) as GallerySearch["mimeType"], model: stringValue(searchParams.model) as GallerySearch["model"], itemType: stringValue(searchParams.itemType), startDate: stringValue(searchParams.startDate), endDate: stringValue(searchParams.endDate), userEmail: mine ? session.email : stringValue(searchParams.owner), tags: csvValue(searchParams.tags), query: stringValue(searchParams.query) };
  let response: GalleryResponse;
  try { response = await client.post<GalleryResponse>("/api/gallery/search", JSON.stringify(request)); } catch (error) { throw new Error(error instanceof Error ? error.message : "Gallery request failed"); }
  return <GalleryView currentPage={response.page} isAdmin={isAdmin} media={response.data ?? []} tags={tags} totalPages={response.totalPages} userEmail={session.email} userId={userId} />;
}
function stringValue(value: string | string[] | undefined) { return typeof value === "string" ? value : undefined; }
function numberValue(value: string | string[] | undefined) { const parsed = Number(stringValue(value)); return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined; }
function statusValue(value: string | string[] | undefined): GallerySearch["status"] { const status = stringValue(value); return status === "processing" || status === "completed" || status === "failed" || status === "stopped" ? status : undefined; }
function csvValue(value: string | string[] | undefined) { const text = stringValue(value); return text ? text.split(",").filter(Boolean) : undefined; }
