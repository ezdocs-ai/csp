/** Copyright 2026 Google LLC — Apache-2.0 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiClient } from "@/src/lib/api/server";
import { CSRF_COOKIE, verifyCsrf } from "@/src/lib/auth/session";

export async function POST(request: NextRequest) {
  if (!verifyCsrf(request.cookies.get(CSRF_COOKIE)?.value, request.headers.get("x-csrf-token") ?? undefined))
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || !Number.isInteger(body.workspaceId) || !body.model)
    return NextResponse.json({ error: "workspaceId and model required" }, { status: 400 });
  // Map UI short names → backend GenerationModelEnum values
  // (csp/backend/src/common/base_dto.py: LYRIA_002="lyria-002", CHIRP_3="chirp_3", GEMINI_2_5_FLASH_TTS="gemini-2.5-flash-tts")
  const MODEL_FULL: Record<string, string> = { lyria: "lyria-002", chirp: "chirp_3", "gemini-tts": "gemini-2.5-flash-tts" };
  const payload = { ...body, model: MODEL_FULL[body.model] ?? body.model };
  try {
    const api = await requireApiClient();
    const item = await api.post<{ id?: string; mediaItemId?: string } & Record<string, unknown>>(
      "/api/audios/generate",
      JSON.stringify(payload),
    );
    return NextResponse.json({ mediaItemId: item?.id ?? item?.mediaItemId, ...item }, { status: 202 });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Audio generation failed" }, { status });
  }
}
