// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { ReactNode } from "react";
import { AdminSubnav } from "./admin-subnav";

import { Footer, LoadingBar, Sidebar } from "@/src/components/ui";
import type { SidebarItem } from "@/src/components/ui";
import { requireRole } from "@/src/lib/auth/server";
import { WorkspaceSwitcher } from "@/src/features/workspaces";

// Angular treats /admin as another route in the same shell (same pill nav).
const STUDIO_NAV: SidebarItem[] = [
  { label: "Images", href: "/" },
  { label: "Video", href: "/video" },
  { label: "Audio", href: "/audio" },
  { label: "Virtual Try-On", href: "/vto" },
  { label: "Fun Templates", href: "/fun-templates" },
  { label: "Imagen Upscale", href: "/imagen-upscale" },
  { label: "Media Gallery", href: "/gallery" },
  { label: "Workbench", href: "/workbench" },
  { label: "Workflows", href: "/workflows" },
];

const ADMIN_NAV: SidebarItem = { label: "Admin", href: "/admin" };

export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await requireRole(["admin"]);
  const items: SidebarItem[] = [
    ...STUDIO_NAV,
    ...(session.roles.includes("admin") ? [ADMIN_NAV] : []),
  ];

  return (
    <div
      className="flex min-h-dvh flex-col bg-[var(--tri-bg-page)] text-[var(--tri-text-primary)] bg-[radial-gradient(circle_at_80%_10%,rgba(38,208,124,0.08),transparent_34%),radial-gradient(circle_at_20%_90%,rgba(97,93,244,0.05),transparent_36%)]"
      data-theme="dark"
    >
      <a className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-[var(--tri-radius-md)] focus:bg-[var(--tri-bg-surface)] focus:px-[var(--tri-space-4)] focus:py-[var(--tri-space-2)] focus:text-[var(--tri-text-primary)]" href="#main-content">
        Skip to content
      </a>
      <LoadingBar />
      <WorkspaceSwitcher isAdmin userId={session.sub} />
      <Sidebar
        brand={
          <span className="font-[var(--tri-font-display)] text-[length:var(--tri-text-h3-size)] font-[var(--tri-font-weight-bold)] text-[#F4FBF8]">
            Creative Studio
          </span>
        }
        items={items}
        userPicture={session.picture}
        userEmail={session.email}
        userName={session.name}
      />
      <div className="flex min-w-0 flex-1 flex-col md:pl-[calc(5vw+5.5rem)] xl:pl-[calc(3vw+6rem)] transition-all duration-300">
        <main className="flex-1 px-[var(--tri-layout-gutter)] py-[var(--tri-space-8)]" id="main-content">
          <AdminSubnav />
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}
