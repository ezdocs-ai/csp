/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useState } from "react";

import { Button } from "@/src/components/ui/button";
import { useToast } from "@/src/components/ui/toast-provider";

function csrfToken() {
  return (
    document.cookie
      .split("; ")
      .find((item) => item.startsWith("csp_csrf="))
      ?.split("=")
      .slice(1)
      .join("=") ?? ""
  );
}

export function CleanupStuckJobsButton() {
  const [loading, setLoading] = useState(false);
  const { show } = useToast();

  const cleanup = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/dashboard", {
        method: "POST",
        headers: { "x-csrf-token": csrfToken() },
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Cleanup failed");
      }
      show(body?.message ?? "Stuck jobs cleaned up.", "success");
    } catch (error) {
      show(error instanceof Error ? error.message : "Cleanup failed", "danger");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button disabled={loading} onClick={() => void cleanup()} variant="secondary">
      {loading ? "Cleaning…" : "Clean stuck jobs"}
    </Button>
  );
}
