/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";
import { useCallback } from "react";
import { useToast } from "@/src/components/ui/toast-provider";

async function csrfFetch(path: string, init: RequestInit = {}) {
  const csrf = await fetch("/api/auth/csrf").then((response) => response.json());
  return fetch(path, { ...init, headers: { ...init.headers, "Content-Type": "application/json", "x-csrf-token": csrf.csrfToken } });
}

export function useGalleryMutations(onSuccess?: () => void) {
  const toast = useToast();
  const call = useCallback(async (action: string, body: unknown) => {
    try {
      const response = await csrfFetch(`/api/gallery/${action}`, { method: "POST", body: JSON.stringify(body) });
      if (!response.ok) throw new Error(await response.text());
      toast.show(`${action} succeeded`, "success");
      onSuccess?.();
    } catch {
      toast.show(`${action} failed`, "danger");
    }
  }, [onSuccess, toast]);

  return {
    deleteMedia: (ids: string[]) => call("delete", { mediaIds: ids }),
    restoreMedia: (ids: string[], itemType: string) => call("restore", { mediaIds: ids, itemType }),
    copyMedia: (ids: string[], workspaceId: string) => call("copy", { mediaIds: ids, workspaceId }),
    tagMedia: (ids: string[], tags: string[]) => call("tag", { mediaIds: ids, tags }),
  };
}
