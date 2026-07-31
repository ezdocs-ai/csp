/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, useToast } from "@/src/components/ui";
import { useWorkspace } from "@/src/lib/workspace";
import { guidelineBadge } from "../guideline-status";
import { useBrandGuideline, type BrandGuideline } from "../hooks/use-brand-guideline";

function csrfToken() {
  return document.cookie.split("; ").find((item) => item.startsWith("csp_csrf="))?.split("=").slice(1).join("=") ?? "";
}

export interface BrandGuidelineUploadProps {
  /** `session.sub` — workspace owner check for edit gating. */
  userId: string;
  /** `session.roles.includes("admin")` — admins may edit any workspace guideline. */
  isAdmin: boolean;
}

const MAX_BYTES = 500 * 1024 * 1024;

export function BrandGuidelineUpload({ userId, isAdmin }: BrandGuidelineUploadProps) {
  const { activeWorkspace } = useWorkspace();
  const toast = useToast();

  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [current, setCurrent] = useState<BrandGuideline | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [toneExpanded, setToneExpanded] = useState(false);
  const [styleExpanded, setStyleExpanded] = useState(false);

  const { guideline, status, loading } = useBrandGuideline(current?.id ?? null);
  const displayed = guideline ?? current;

  // Backend delete: workspace owner or admin only.
  const canEdit = !!activeWorkspace && (isAdmin || activeWorkspace.ownerId === userId);

  // Initial fetch by active workspace (Angular `getBrandGuidelineForWorkspace` parity).
  const fetchByWorkspace = useCallback(async (workspaceId: string) => {
    setFetching(true);
    setFetchError(null);
    setCurrent(null);
    try {
      const res = await fetch(`/api/brand-guidelines?workspaceId=${encodeURIComponent(workspaceId)}`);
      if (res.status === 404) {
        setCurrent(null);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load brand guideline");
      setCurrent(data);
      setShowUpload(false);
    } catch (cause) {
      setFetchError(cause instanceof Error ? cause.message : "Failed to load brand guideline");
    } finally {
      setFetching(false);
    }
  }, []);

  // Defer the async load so setState happens outside the effect's synchronous
  // body (codebase convention: template-editor.tsx / use-workflows.ts).
  useEffect(() => {
    if (!activeWorkspace?.id) return;
    const timer = window.setTimeout(() => void fetchByWorkspace(activeWorkspace.id));
    return () => window.clearTimeout(timer);
  }, [activeWorkspace?.id, fetchByWorkspace]);

  // Toast only on processing → terminal transition (mirrors Angular active-job subscription).
  const prevStatusRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (prev !== "processing") return;
    if (status === "completed") toast.show("Brand Guidelines processed successfully!", "success");
    else if (status === "failed") toast.show(displayed?.errorMessage || "Brand Guideline processing failed.", "danger");
  }, [status, displayed?.errorMessage, toast]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError("");
    if (!activeWorkspace) {
      setUploadError("Select a workspace before uploading");
      return;
    }
    if (!file) {
      setUploadError("A PDF file is required");
      return;
    }
    if (name.trim().length < 3) {
      setUploadError("Name must be at least 3 characters long");
      return;
    }
    if (file.type !== "application/pdf") {
      setUploadError("Only PDF files are supported");
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadError("PDF must be 500 MB or smaller");
      return;
    }
    setUploading(true);
    toast.show("Uploading file, please keep this window open...", "info");
    try {
      const headers = { "Content-Type": "application/json", "x-csrf-token": csrfToken() };
      const init = await fetch("/api/brand-guidelines", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "generate-upload-url", workspaceId: Number(activeWorkspace.id), filename: file.name, contentType: file.type, size: file.size }),
      });
      const initData = await init.json();
      if (!init.ok) throw new Error(initData.error ?? "Failed to start upload");
      const upload = await fetch(initData.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!upload.ok) throw new Error("Failed to upload PDF");
      const finalize = await fetch("/api/brand-guidelines", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "finalize-upload", workspace_id: Number(activeWorkspace.id), gcs_uri: initData.gcsUri, name: name.trim(), original_filename: file.name }),
      });
      const data = await finalize.json();
      if (!finalize.ok) throw new Error(data.error ?? "Failed to finalize upload");
      setCurrent(data);
      setName("");
      setFile(null);
      setShowUpload(false);
      prevStatusRef.current = "processing";
      toast.show("Upload complete. Analyzing your brand guideline...", "success");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Failed to upload brand guideline";
      setUploadError(message);
      toast.show(message, "danger");
    } finally {
      setUploading(false);
    }
  }

  async function confirmDelete() {
    if (!displayed?.id) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/brand-guidelines/${encodeURIComponent(String(displayed.id))}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrfToken() },
      });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to delete brand guideline");
      }
      setCurrent(null);
      setShowUpload(false);
      toast.show("Brand guideline deleted.", "success");
    } catch (cause) {
      toast.show(cause instanceof Error ? cause.message : "Failed to delete brand guideline", "danger");
    } finally {
      setDeleting(false);
    }
  }

  const badge = guidelineBadge(status, loading);
  const hasGuideline = !!displayed;
  const showForm = !hasGuideline || showUpload;

  return (
    <section className="space-y-6">
      {fetchError ? (
        <p role="alert" className="text-sm text-[var(--tri-error)]">{fetchError}</p>
      ) : null}

      {!activeWorkspace ? (
        <EmptyState
          title="Select a workspace"
          description="Choose a workspace from the switcher to view or upload its brand guideline."
        />
      ) : null}

      {activeWorkspace && fetching ? (
        <Card>
          <p className="p-6 text-sm text-[var(--tri-text-secondary)]">Loading brand guideline…</p>
        </Card>
      ) : null}

      {activeWorkspace && showForm ? (
        <Card>
          <form className="space-y-4 p-6" onSubmit={submit}>
            <p className="text-sm text-[var(--tri-text-secondary)]">
              Upload a PDF with your brand guidelines. We&apos;ll analyze it to help you generate on-brand content.
            </p>
            <Field error={uploadError} htmlFor="guideline-name" label="Guideline name">
              <Input id="guideline-name" maxLength={100} minLength={3} onChange={(event) => setName(event.target.value)} value={name} />
            </Field>
            <Field htmlFor="guideline-file" label="PDF file" hint="PDF, up to 500 MB">
              <Input accept="application/pdf" id="guideline-file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required type="file" />
            </Field>
            <div className="flex items-center gap-3">
              <Button disabled={uploading || !canEdit} type="submit">
                {uploading ? "Processing…" : "Upload guideline"}
              </Button>
              {hasGuideline ? (
                <Button onClick={() => setShowUpload(false)} type="button" variant="ghost">
                  Cancel
                </Button>
              ) : null}
            </div>
            {!canEdit ? (
              <p className="text-sm text-[var(--tri-text-secondary)]">
                Only workspace owners and admins can upload brand guidelines.
              </p>
            ) : null}
          </form>
        </Card>
      ) : null}

      {activeWorkspace && hasGuideline && !showUpload && !fetching ? (
        <Card>
          <div className="space-y-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--tri-text)]">{displayed.name ?? "Brand guideline"}</h2>
              <Badge tone={badge.tone}>{badge.label}</Badge>
            </div>

            {displayed.errorMessage ? (
              <p className="text-sm text-[var(--tri-error)]">{displayed.errorMessage}</p>
            ) : null}

            {displayed.colorPalette?.length ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[var(--tri-text-secondary)]">Color Palette</p>
                <div className="flex flex-wrap gap-2">
                  {displayed.colorPalette.map((color) => (
                    <span
                      key={color}
                      className="size-8 rounded-full border border-white/20"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {displayed.toneOfVoiceSummary ? (
              <GuidelineSummary
                expanded={toneExpanded}
                label="Tone of Voice"
                onToggle={() => setToneExpanded((value) => !value)}
                text={displayed.toneOfVoiceSummary}
              />
            ) : null}

            {displayed.visualStyleSummary ? (
              <GuidelineSummary
                expanded={styleExpanded}
                label="Visual Style"
                onToggle={() => setStyleExpanded((value) => !value)}
                text={displayed.visualStyleSummary}
              />
            ) : null}

            {displayed.presignedSourcePdfUrls?.length ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[var(--tri-text-secondary)]">Source Documents</p>
                <ul className="space-y-1">
                  {displayed.presignedSourcePdfUrls.map((url, index) => (
                    <li key={url}>
                      <a
                        className="text-sm text-[var(--tri-text-link,#4f9cff)] hover:underline"
                        href={url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Brand_Guideline_{index + 1}.pdf
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {canEdit ? (
              <div className="flex justify-end gap-2">
                <Button disabled={deleting} onClick={() => setConfirmOpen(true)} variant="danger">
                  {deleting ? "Deleting…" : "Delete"}
                </Button>
                <Button onClick={() => setShowUpload(true)} variant="secondary">
                  Replace
                </Button>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      <ConfirmDialog
        confirmLabel="Delete"
        message="This permanently deletes the brand guideline and its source PDFs. This action cannot be undone."
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmDelete}
        open={confirmOpen}
        title="Delete brand guideline"
        tone="danger"
      />
    </section>
  );
}

interface GuidelineSummaryProps {
  label: string;
  text: string;
  expanded: boolean;
  onToggle: () => void;
}

/** Plain-text summary block with show more / less (no markdown dependency). */
function GuidelineSummary({ expanded, label, onToggle, text }: GuidelineSummaryProps) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold text-[var(--tri-text-secondary)]">{label}</p>
      <p className={`whitespace-pre-wrap text-sm text-[var(--tri-text-secondary)] ${expanded ? "" : "line-clamp-3"}`}>{text}</p>
      <button className="text-sm text-[var(--tri-text-link,#4f9cff)] hover:underline" onClick={onToggle} type="button">
        {expanded ? "Show less" : "Show more"}
      </button>
    </div>
  );
}
