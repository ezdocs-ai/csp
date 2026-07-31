"use client";
/** Copyright 2026 Google LLC — Apache-2.0 */

import { useRef, useState } from "react";
import { Button, Field } from "@/src/components/ui";
import { useToast } from "@/src/components/ui/toast-provider";
import { toRenderRequest } from "@/src/features/workbench";
import type { Timeline } from "@/src/features/workbench";

type Props = { timeline: Timeline; disabled?: boolean };
function csrfToken(): string | undefined { return document.cookie.split("; ").find((cookie) => cookie.startsWith("csp_csrf="))?.split("=")[1]; }
export function RenderPanel({ timeline, disabled }: Props) {
  const { show } = useToast();
  const [outputFormat, setOutputFormat] = useState(timeline.outputFormat ?? "mp4");
  const [status, setStatus] = useState<"idle" | "rendering" | "done" | "error">("idle");
  const controllerRef = useRef<AbortController | null>(null);
  const render = async () => {
    const controller = new AbortController(); controllerRef.current = controller; setStatus("rendering");
    const timeout = window.setTimeout(() => controller.abort(), 10 * 60 * 1000);
    try {
      const response = await fetch("/api/workbench/render", { body: JSON.stringify({ ...toRenderRequest(timeline), output_format: outputFormat }), headers: { "content-type": "application/json", "x-csrf-token": decodeURIComponent(csrfToken() ?? "") }, method: "POST", signal: controller.signal });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Render failed");
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = `workbench.${outputFormat}`; link.click(); URL.revokeObjectURL(url);
      setStatus("done"); show("Render downloaded", "success");
    } catch (error) { setStatus("error"); show(error instanceof Error && error.name === "AbortError" ? "Render cancelled or timed out" : error instanceof Error ? error.message : "Render failed", "danger"); }
    finally { window.clearTimeout(timeout); controllerRef.current = null; }
  };
  return <section aria-label="Render export" className="flex flex-wrap items-end gap-3 rounded-[var(--tri-card-radius)] border border-[var(--tri-border-subtle)] p-4"><Field htmlFor="output-format" label="Output format"><select className="min-h-11 rounded-[var(--tri-input-radius)] border border-[var(--tri-input-border)] bg-[var(--tri-input-bg)] px-3 text-[var(--tri-text-primary)]" id="output-format" onChange={(event) => setOutputFormat(event.target.value)} value={outputFormat}><option value="mp4">MP4 video</option><option value="webm">WebM video</option></select></Field><Button disabled={disabled || status === "rendering"} onClick={render}>{status === "rendering" ? "Rendering…" : "Render export"}</Button>{status === "rendering" && <Button onClick={() => controllerRef.current?.abort()} variant="ghost">Cancel</Button>}<span aria-live="polite" className="text-sm text-[var(--tri-text-secondary)]">{status === "rendering" ? "Rendering can take several minutes." : ""}</span></section>;
}
