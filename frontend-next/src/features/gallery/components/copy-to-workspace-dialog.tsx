/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";
import { useState } from "react";

import { Button, Dialog } from "@/src/components/ui";
import { useGalleryMutations } from "../hooks/use-gallery-mutations";
import { useWorkspace } from "@/src/lib/workspace";

export function CopyToWorkspaceDialog({
  mediaIds,
  onClose,
  onSuccess,
  open,
}: {
  mediaIds: string[];
  onClose: () => void;
  onSuccess?: () => void;
  open: boolean;
}) {
  const { workspaces } = useWorkspace();
  const { copyMedia } = useGalleryMutations(onSuccess);
  // State resets via remount key from parent (BulkActions passes key={action}),
  // so no setState-in-effect is needed here.
  const [targetId, setTargetId] = useState("");

  const submit = () => {
    const id = targetId || workspaces[0]?.id;
    if (!id) return;
    copyMedia(mediaIds, id);
    onClose();
  };

  return (
    <Dialog
      description="Copy the selected media into another workspace you belong to."
      onClose={onClose}
      open={open}
      title="Copy to workspace"
    >
      <div className="mt-[var(--tri-space-4)] grid gap-[var(--tri-space-3)]">
        {workspaces.length === 0 ? (
          <p className="text-[var(--tri-text-secondary)]">No workspaces available.</p>
        ) : (
          <label className="grid gap-[var(--tri-space-2)] font-[var(--tri-font-weight-semibold)] text-[length:var(--tri-text-small-size)] text-[var(--tri-text-secondary)]">
            Target workspace
            <select
              aria-label="Target workspace"
              className="h-[var(--tri-input-height)] w-full rounded-[var(--tri-input-radius)] border border-[var(--tri-input-border)] bg-[var(--tri-input-bg)] px-[var(--tri-input-padding-inline)] text-[var(--tri-text-primary)] transition-[var(--tri-button-transition)] hover:border-[var(--tri-input-hover-border)] focus:border-[var(--tri-input-focus-border)]"
              onChange={(event) => setTargetId(event.target.value)}
              value={(targetId || workspaces[0]?.id) ?? ""}
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex justify-end gap-[var(--tri-space-2)]">
          <Button onClick={onClose} variant="ghost">Cancel</Button>
          <Button disabled={workspaces.length === 0} onClick={submit}>Copy</Button>
        </div>
      </div>
    </Dialog>
  );
}
