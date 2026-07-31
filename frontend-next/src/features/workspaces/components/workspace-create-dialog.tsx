/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Dialog } from "@/src/components/ui/dialog";
import { Field } from "@/src/components/ui/field";
import { Input } from "@/src/components/ui/input";
import { useWorkspace } from "@/src/lib/workspace";

function csrfToken() {
  return document.cookie.split("; ").find((item) => item.startsWith("csp_csrf="))?.split("=").slice(1).join("=") ?? "";
}

export function WorkspaceCreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { refresh, setActiveWorkspace } = useWorkspace();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/workspaces", { method: "POST", headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken() }, body: JSON.stringify({ name }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to create workspace");
      await refresh();
      setActiveWorkspace(data);
      setName("");
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to create workspace");
    } finally {
      setSaving(false);
    }
  }

  return <Dialog open={open} onClose={onClose} title="Create workspace"><form className="space-y-4" onSubmit={submit}><Field error={error} htmlFor="workspace-name" label="Workspace name"><Input id="workspace-name" maxLength={100} minLength={3} onChange={(event) => setName(event.target.value)} required value={name} /></Field><div className="flex justify-end gap-2"><Button onClick={onClose} type="button" variant="secondary">Cancel</Button><Button disabled={saving} type="submit">{saving ? "Creating…" : "Create"}</Button></div></form></Dialog>;
}
