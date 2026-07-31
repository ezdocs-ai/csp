/** Copyright 2026 Google LLC — Apache-2.0 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiClient } from "@/src/lib/api/server";
import { CSRF_COOKIE, verifyCsrf } from "@/src/lib/auth/session";

async function idFrom(params: Promise<{ id: string }>) { return encodeURIComponent((await params).id); }
function errorResponse(error: unknown, fallback: string) { const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500; return NextResponse.json({ error: error instanceof Error ? error.message : fallback }, { status }); }
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { return NextResponse.json(await (await requireApiClient()).get(`/api/workflows/${await idFrom(params)}`)); } catch (error) { return errorResponse(error, "Workflow load failed"); } }
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }); try { await (await requireApiClient()).delete(`/api/workflows/${await idFrom(params)}`); return new NextResponse(null, { status: 204 }); } catch (error) { return errorResponse(error, "Workflow delete failed"); } }
