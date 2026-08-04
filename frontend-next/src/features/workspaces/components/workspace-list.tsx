/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import { EmptyState } from "@/src/components/ui/empty-state";
import { LoadingState } from "@/src/components/ui/loading";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/components/ui/table";
import { useWorkspace } from "@/src/lib/workspace";
import { WorkspaceCreateDialog } from "./workspace-create-dialog";
import { WorkspaceInviteDialog } from "./workspace-invite-dialog";

export function WorkspaceList() {
  const { workspaces, activeWorkspace, loading, error } = useWorkspace();
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button onClick={() => setCreating(true)}>Create workspace</Button>
      </div>
      {error ? <p className="text-sm text-[var(--tri-state-error)]">{error.message}</p> : null}
      {loading ? (
        <LoadingState label="Loading workspaces" />
      ) : workspaces.length === 0 ? (
        <EmptyState description="Create workspace to start collaborating." title="No workspaces" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Workspace</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workspaces.map((workspace) => (
              <TableRow key={workspace.id}>
                <TableCell>{workspace.name}</TableCell>
                <TableCell>—</TableCell>
                <TableCell>Member</TableCell>
                <TableCell>
                  <Button
                    disabled={activeWorkspace?.id !== workspace.id}
                    onClick={() => setInviting(true)}
                    variant="secondary"
                  >
                    Invite
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <WorkspaceCreateDialog onClose={() => setCreating(false)} open={creating} />
      {activeWorkspace ? (
        <WorkspaceInviteDialog
          onClose={() => setInviting(false)}
          open={inviting}
          workspaceId={activeWorkspace.id}
        />
      ) : null}
    </section>
  );
}
