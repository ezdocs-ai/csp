// Copyright 2025 Google LLC — Apache-2.0
"use client";

import { useState } from "react";
import { Badge, Button, Dialog } from "@/src/components/ui";
import { useToast } from "@/src/components/ui/toast-provider";
import { USER_ROLES } from "../hooks/use-admin-users";
import { MultiSelect as RoleMultiSelect, roleTone } from "./admin-controls";
import type { AdminRole, AdminUser } from "../types";

export function UserEditDialog({ user, onClose, onSaved }: { user: AdminUser; onClose: () => void; onSaved: (roles: AdminRole[]) => void }) {
  const [roles, setRoles] = useState<AdminRole[]>(user.roles ?? (user.role ? [user.role] : []));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { show } = useToast();
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (roles.length === 0) { setError("At least one role must be selected."); return; }
    setSaving(true);
    try { onSaved(roles); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Role update failed."); show("Role update failed.", "danger"); }
    finally { setSaving(false); }
  };
  const options = USER_ROLES.map((role) => ({ value: role, label: role.charAt(0).toUpperCase() + role.slice(1) }));
  return (
    <Dialog description={user.email} onClose={onClose} open size="sm" title="Edit roles">
      <form className="mt-[var(--tri-space-4)] grid gap-[var(--tri-space-4)]" onSubmit={save}>
        <RoleMultiSelect error={error} label="Roles" onChange={setRoles} options={options} value={roles} />
        {roles.length > 0 ? (
          <div className="flex flex-wrap gap-[var(--tri-space-1)]" aria-label="Selected roles">
            {roles.map((role) => <Badge key={role} tone={roleTone(role)}>{role}</Badge>)}
          </div>
        ) : null}
        <div className="flex justify-end gap-[var(--tri-space-3)]">
          <Button onClick={onClose} type="button" variant="ghost">Cancel</Button>
          <Button disabled={saving} type="submit">Save</Button>
        </div>
      </form>
    </Dialog>
  );
}
