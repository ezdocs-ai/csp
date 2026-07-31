/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";
import { useState } from "react";
import { Button, Dialog, Input } from "@/src/components/ui";

function csrfToken() {
  return document.cookie.split("; ").find((item) => item.startsWith("csp_csrf="))?.split("=").slice(1).join("=") ?? "";
}

export function TagAssigner({ mediaIds, onClose, onSuccess, open }: { mediaIds: string[]; onClose: () => void; onSuccess?: () => void; open: boolean }) {
  const [tags, setTags] = useState("");
  const [error, setError] = useState("");
  const submit = async () => {
    const values = tags.split(",").map((tag) => tag.trim()).filter(Boolean);
    if (!values.length) return setError("Tag required");
    try {
      const response = await fetch("/api/gallery/tag", { method: "POST", headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken() }, body: JSON.stringify({ mediaIds, tags: values }) });
      if (!response.ok) throw new Error(await response.text());
      setTags(""); setError(""); onSuccess?.(); onClose();
    } catch { setError("Failed to assign tags"); }
  };
  return <Dialog open={open} onClose={onClose} title="Assign tags"><div className="mt-[var(--tri-space-4)] grid gap-[var(--tri-space-3)]"><Input aria-label="Tags" onChange={(event) => setTags(event.target.value)} placeholder="Search or create tags, comma separated" value={tags} />{error && <p role="alert" className="text-[var(--tri-button-danger-bg)]">{error}</p>}<div className="flex justify-end gap-[var(--tri-space-2)]"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit}>Assign tags</Button></div></div></Dialog>;
}
