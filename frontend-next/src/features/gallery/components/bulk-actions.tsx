/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";
import { useState } from "react";
import { Button, Dialog } from "@/src/components/ui";
import { downloadZip } from "../mutations";
import { useGalleryMutations } from "../hooks/use-gallery-mutations";
import { CopyToWorkspaceDialog } from "./copy-to-workspace-dialog";
import { SelectionBar } from "./selection-bar";
import { TagAssigner } from "./tag-assigner";

export function BulkActions({ canRestore, onSuccess, selection, clear }: { canRestore?: boolean; onSuccess?: () => void; selection: string[]; clear: () => void }) {
  const { deleteMedia, restoreMedia } = useGalleryMutations(onSuccess);
  const [action, setAction] = useState("");
  const run = () => {
    if (action === "delete") deleteMedia(selection);
    if (action === "restore") restoreMedia(selection, "image");
    setAction("");
  };
  return (
    <>
      <SelectionBar
        canRestore={canRestore}
        onAction={(next) => {
          if (next === "clear") clear();
          else if (next === "download") downloadZip(selection);
          else setAction(next);
        }}
        selection={selection}
      />
      <Dialog onClose={() => setAction("")} open={action === "delete" || action === "restore"} title={`${action === "delete" ? "Delete" : "Restore"} selected media`}>
        <div className="mt-[var(--tri-space-4)] grid gap-[var(--tri-space-3)]">
          <p>{action === "delete" ? "Delete selected media? This cannot be undone here." : "Restore selected media?"}</p>
          <div className="flex justify-end gap-[var(--tri-space-2)]">
            <Button onClick={() => setAction("")} variant="ghost">Cancel</Button>
            <Button onClick={run} variant={action === "delete" ? "danger" : "primary"}>{action === "delete" ? "Delete" : "Restore"}</Button>
          </div>
        </div>
      </Dialog>
      <TagAssigner mediaIds={selection} onClose={() => setAction("")} onSuccess={onSuccess} open={action === "tag"} />
      {/* key remounts the dialog when the action changes so its internal
          selection state resets without setState-in-effect. */}
      <CopyToWorkspaceDialog key={action} mediaIds={selection} onClose={() => setAction("")} onSuccess={onSuccess} open={action === "copy"} />
    </>
  );
}
