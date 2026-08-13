/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useState } from "react";

import { Button, Dialog, useToast } from "@/src/components/ui";
import { UploadDropzone } from "@/src/components/media/upload-dropzone";
import { useWorkspace } from "@/src/lib/workspace";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit
const ACCEPTED_TYPES = "image/*,video/*,audio/*";

export interface UploadMediaDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function UploadMediaDialog({
  open,
  onClose,
  onSuccess,
}: UploadMediaDialogProps) {
  const toast = useToast();
  const { activeWorkspace } = useWorkspace();
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleUpload = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    setStatus(`Uploading ${files.length} file(s)...`);

    try {
      let succeeded = 0;
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        if (activeWorkspace?.id) {
          formData.append("workspaceId", String(activeWorkspace.id));
        }

        const res = await fetch("/api/gallery/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Upload failed for ${file.name}`);
        }
        succeeded++;
      }

      toast.show(
        `Successfully uploaded ${succeeded} asset(s)!`,
        "success",
        "bottom-center",
      );
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.show(msg, "error", "bottom-center");
      setStatus(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog
      description="Upload image, video, or audio files to your workspace media gallery."
      onClose={onClose}
      open={open}
      size="md"
      title="Upload Media"
    >
      <div className="mt-[var(--tri-space-4)] space-y-[var(--tri-space-4)]">
        {uploading ? (
          <div className="grid place-items-center p-[var(--tri-space-8)] space-y-[var(--tri-space-2)]">
            <div className="size-8 animate-spin rounded-full border-4 border-[var(--tri-brand-primary)] border-t-transparent" />
            <p className="text-sm font-medium text-[var(--tri-text-secondary)]">
              {status}
            </p>
          </div>
        ) : (
          <UploadDropzone
            accept={ACCEPTED_TYPES}
            maxSize={MAX_FILE_SIZE}
            multiple
            onFiles={handleUpload}
          />
        )}
        <div className="flex justify-end gap-[var(--tri-space-2)]">
          <Button disabled={uploading} onClick={onClose} variant="ghost">
            Cancel
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
