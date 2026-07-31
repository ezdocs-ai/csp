/** Copyright 2026 Google LLC — Apache-2.0 */
import { describe, expect, test } from "bun:test";

import { groupSidebarItems, TOOLS_GROUP_HREF } from "../sidebar";
import type { SidebarItem } from "../sidebar";

// Mirrors `app/(studio)/layout.tsx` order; Workflows is appended last (role-provided).
const STUDIO_ITEMS: SidebarItem[] = [
  { label: "Images", href: "/" },
  { label: "Video", href: "/video" },
  { label: "Audio", href: "/audio" },
  { label: "Virtual Try-On", href: "/vto" },
  { label: "Fun Templates", href: "/fun-templates" },
  { label: "Imagen Upscale", href: "/imagen-upscale" },
  { label: "Media Gallery", href: "/gallery" },
  { label: "Workbench", href: "/workbench" },
  { label: "Workflows", href: "/workflows" },
  { label: "Admin", href: "/admin" },
];

describe("groupSidebarItems", () => {
  test("Workflows is a top-level item, NOT inside the Tools flyout", () => {
    const { toolsSubItems, desktop } = groupSidebarItems(STUDIO_ITEMS);

    expect(toolsSubItems.map((i) => i.href)).toEqual([
      "/vto",
      "/fun-templates",
      "/imagen-upscale",
    ]);
    expect(toolsSubItems.find((i) => i.href === "/workflows")).toBeUndefined();

    const workflows = desktop.find((i) => i.href === "/workflows");
    expect(workflows).toBeDefined();
    expect(workflows?.label).toBe("Workflows");
  });

  test("desktop order: Images, Video, Audio, Tools, Gallery, Workbench, Workflows, Admin", () => {
    const { desktop } = groupSidebarItems(STUDIO_ITEMS);
    expect(desktop.map((i) => (i.href === TOOLS_GROUP_HREF ? "Tools" : i.label))).toEqual([
      "Images",
      "Video",
      "Audio",
      "Tools",
      "Media Gallery",
      "Workbench",
      "Workflows",
      "Admin",
    ]);
  });

  test("Tools flyout preserves VTO / Fun Templates / Imagen Upscale order", () => {
    const { toolsSubItems } = groupSidebarItems(STUDIO_ITEMS);
    expect(toolsSubItems.map((i) => i.label)).toEqual([
      "Virtual Try-On",
      "Fun Templates",
      "Imagen Upscale",
    ]);
  });

  test("exactly one Tools group entry, placed right after Audio", () => {
    const { desktop } = groupSidebarItems(STUDIO_ITEMS);
    const groupCount = desktop.filter((i) => i.href === TOOLS_GROUP_HREF).length;
    expect(groupCount).toBe(1);

    const audioIdx = desktop.findIndex((i) => i.href === "/audio");
    const toolsIdx = desktop.findIndex((i) => i.href === TOOLS_GROUP_HREF);
    expect(toolsIdx).toBe(audioIdx + 1);
  });

  test("role-gated Workflows (absent) keeps Tools flyout intact", () => {
    const withoutWorkflows = STUDIO_ITEMS.filter((i) => i.href !== "/workflows");
    const { desktop, toolsSubItems } = groupSidebarItems(withoutWorkflows);

    expect(desktop.find((i) => i.href === "/workflows")).toBeUndefined();
    expect(toolsSubItems.map((i) => i.href)).toEqual([
      "/vto",
      "/fun-templates",
      "/imagen-upscale",
    ]);
  });

  test("no Tools items -> no synthetic Tools group entry", () => {
    const noTools: SidebarItem[] = [
      { label: "Images", href: "/" },
      { label: "Audio", href: "/audio" },
      { label: "Workflows", href: "/workflows" },
    ];
    const { desktop, toolsSubItems } = groupSidebarItems(noTools);
    expect(toolsSubItems).toEqual([]);
    expect(desktop.find((i) => i.href === TOOLS_GROUP_HREF)).toBeUndefined();
    expect(desktop.map((i) => i.href)).toEqual(["/", "/audio", "/workflows"]);
  });
});
