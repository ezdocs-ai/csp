/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Dialog } from "@/src/components/ui/dialog";
import { Field } from "@/src/components/ui/field";
import { Input } from "@/src/components/ui/input";

function csrfToken() {
  return document.cookie.split("; ").find((item) => item.startsWith("csp_csrf="))?.split("=").slice(1).join("=") ?? "";
}

export function WorkspaceInviteDialog({ workspaceId, open, onClose }: { workspaceId: string; open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSaving(true);
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/invites`, { method: "POST", headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken() }, body: JSON.stringify({ email, role: "viewer" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to send invite");
      setEmail(""); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to send invite"); } finally { setSaving(false); }
  }

  return <Dialog open={open} onClose={onClose} title="Invite member"><form className="space-y-4" onSubmit={submit}><Field error={error} htmlFor="workspace-email" label="Email"><Input id="workspace-email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></Field><div className="flex justify-end gap-2"><Button onClick={onClose} type="button" variant="secondary">Cancel</Button><Button disabled={saving} type="submit">{saving ? "Sending…" : "Send invite"}</Button></div></form></Dialog>;
}
