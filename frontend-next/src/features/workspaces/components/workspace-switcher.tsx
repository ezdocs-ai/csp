/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/src/lib/workspace";
import { Menu, MenuDivider, MenuItem, Tooltip } from "@/src/components/ui";
import { WorkspaceCreateDialog } from "./workspace-create-dialog";
import { WorkspaceInviteDialog } from "./workspace-invite-dialog";

// Angular `workspace-switcher.component.ts` — opens in a new tab.
const FEEDBACK_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSceWvu7G354h-dTbOGvNGEraEjcUAgPE300WNY5qr-WJbh3Eg/viewform";

export interface WorkspaceSwitcherProps {
  /** `session.sub` — compared against `activeWorkspace.ownerId` for invite gating. */
  userId: string;
  /** `session.roles.includes("admin")` — owners/admins may invite to private workspaces. */
  isAdmin: boolean;
}

const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fill: "none",
};

function IconPublic() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
    </svg>
  );
}
function IconLock() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" {...stroke}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 018 0v3.5" />
    </svg>
  );
}
function IconUnfold() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" {...stroke}>
      <path d="M9 4l3-3 3 3M9 20l3 3 3-3" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" {...stroke}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}
function IconAdd() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" {...stroke}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function IconPersonAdd() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" {...stroke}>
      <path d="M15 8a4 4 0 11-8 0 4 4 0 018 0zM3 21a7 7 0 0111.5-5.3M19 8v6M16 11h6" />
    </svg>
  );
}
function IconStyle() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" {...stroke}>
      <path d="M12 3l2 5h5l-4 3 1.5 5L12 13l-4.5 3L9 11 5 8h5z" />
    </svg>
  );
}
function IconFeedback() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" {...stroke}>
      <path d="M4 5h16v11H8l-4 4z" />
    </svg>
  );
}

export function WorkspaceSwitcher({ userId, isAdmin }: WorkspaceSwitcherProps) {
  const router = useRouter();
  const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspace();
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  // Preserve the ?workspaceId URL sync (verbatim from the original switcher).
  useEffect(() => {
    if (!activeWorkspace) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("workspaceId") === activeWorkspace.id) return;
    url.searchParams.set("workspaceId", activeWorkspace.id);
    router.replace(`${url.pathname}${url.search}`);
  }, [activeWorkspace, router]);

  function selectWorkspace(id: string) {
    const workspace = workspaces.find((item) => item.id === id);
    if (!workspace) return;
    setActiveWorkspace(workspace);
    const url = new URL(window.location.href);
    url.searchParams.set("workspaceId", workspace.id);
    router.replace(`${url.pathname}${url.search}`);
  }

  const scope = activeWorkspace?.scope ?? "private";
  const canInvite =
    scope === "private" &&
    !!activeWorkspace &&
    (activeWorkspace.ownerId === userId || isAdmin);
  const tooltip = `You are on a ${scope} workspace. Click to switch workspaces!`;

  return (
    <div className="fixed left-[5vw] top-[3vh] z-[101] xl:left-[3vw] max-md:bottom-[10vh] max-md:left-[20vw] max-md:top-auto max-md:w-[80vw]">
      <Menu
        align="start"
        label="Switch workspace"
        side="bottom"
        trigger={
          <Tooltip content={tooltip} position="bottom">
            <span className="flex w-full items-center gap-2 rounded-[24px] border border-white/20 bg-gradient-to-b from-zinc-500/50 to-neutral-700/20 px-4 py-2 text-[length:var(--tri-text-small-size)] font-[var(--tri-font-weight-medium)] text-white shadow-[2px_2px_12px_0px_rgba(0,0,0,0.10)] backdrop-blur-[10px]">
              {scope === "public" ? <IconPublic /> : <IconLock />}
              <span className="max-w-[180px] flex-1 truncate text-left">
                {activeWorkspace?.name || "Select workspace"}
              </span>
              <IconUnfold />
            </span>
          </Tooltip>
        }
      >
        {workspaces.map((workspace) => (
          <MenuItem
            icon={
              <span className="flex gap-1">
                {workspace.scope === "public" ? <IconPublic /> : <IconLock />}
              </span>
            }
            key={workspace.id}
            onClick={() => selectWorkspace(workspace.id)}
            selected={workspace.id === activeWorkspace?.id}
            trailing={workspace.id === activeWorkspace?.id ? <IconCheck /> : null}
          >
            {workspace.name}
          </MenuItem>
        ))}
        <MenuDivider />
        <MenuItem icon={<IconAdd />} onClick={() => setCreateOpen(true)}>
          Create New Private Workspace
        </MenuItem>
        <MenuItem
          disabled={!canInvite}
          icon={<IconPersonAdd />}
          onClick={() => setInviteOpen(true)}
          title={canInvite ? undefined : "You can invite users in your Private Workspaces!"}
        >
          Invite Users
        </MenuItem>
        <MenuItem href="/settings/brand-guidelines" icon={<IconStyle />}>
          Brand Guidelines
        </MenuItem>
        <MenuDivider />
        <MenuItem href={FEEDBACK_URL} icon={<IconFeedback />}>
          Feedback
        </MenuItem>
      </Menu>
      <WorkspaceCreateDialog onClose={() => setCreateOpen(false)} open={createOpen} />
      <WorkspaceInviteDialog
        onClose={() => setInviteOpen(false)}
        open={inviteOpen}
        workspaceId={activeWorkspace?.id ?? ""}
      />
    </div>
  );
}
