/* Copyright 2025 Google LLC
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use client";

import { useCallback, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Menu, MenuItem } from "./menu";
import { Tooltip } from "./tooltip";

export interface SidebarItem {
  label: string;
  href: string;
  icon?: ReactNode;
  active?: boolean;
}

export interface SidebarProps {
  items: SidebarItem[];
  brand: ReactNode;
  footer?: ReactNode;
  className?: string;
  userPicture?: string;
  userEmail?: string;
  userName?: string;
}

// Angular `header.component.html` Tools submenu order. Workflows is intentionally
// excluded: it renders as its own top-level floating item (role-provided upstream
// by the studio layout, not grouped under Tools).
const TOOLS_ORDER = ["/vto", "/fun-templates", "/imagen-upscale"];

// Synthetic href marking the unified Tools flyout entry in `groupSidebarItems().desktop`.
export const TOOLS_GROUP_HREF = "__tools__";

export interface GroupedSidebar {
  /** Desktop floating-pill render order. The Tools flyout is a synthetic item whose
   *  href === TOOLS_GROUP_HREF; everything else is a real top-level item. */
  desktop: SidebarItem[];
  /** Items rendered inside the Tools flyout, in TOOLS_ORDER. */
  toolsSubItems: SidebarItem[];
}

/** Pure grouping of sidebar items into the desktop floating-pill order plus the
 *  Tools flyout. Exported so the navigation contract is unit-testable without DOM/RTL. */
export function groupSidebarItems(items: SidebarItem[]): GroupedSidebar {
  const toolsSet = new Set(TOOLS_ORDER);
  const mainItems = items.filter((item) => !toolsSet.has(item.href));
  const toolsSubItems = TOOLS_ORDER.map((href) => items.find((item) => item.href === href)).filter(
    (item): item is SidebarItem => Boolean(item)
  );

  // Insert the unified Tools entry after Audio (Angular order).
  const audioIndex = mainItems.findIndex((item) => item.href === "/audio");
  const desktop = [...mainItems];
  if (toolsSubItems.length > 0) {
    const toolsItem: SidebarItem = { label: "Tools", href: TOOLS_GROUP_HREF };
    if (audioIndex !== -1) desktop.splice(audioIndex + 1, 0, toolsItem);
    else desktop.push(toolsItem);
  }
  return { desktop, toolsSubItems };
}

// menuFixed is persisted to localStorage — read via useSyncExternalStore to avoid
// hydration mismatch (server snapshot = false) and effect-setState cascades.
const MENU_FIXED_KEY = "menuFixed";
const menuFixedListeners = new Set<() => void>();
function subscribeMenuFixed(cb: () => void) {
  menuFixedListeners.add(cb);
  return () => {
    menuFixedListeners.delete(cb);
  };
}
function getMenuFixedSnapshot() {
  try {
    return localStorage.getItem(MENU_FIXED_KEY) === "true";
  } catch {
    return false;
  }
}

function getIconForHref(href: string) {
  const strokeProps = {
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };
  switch (href) {
    case "/": // Image
      return (
        <svg className="size-6" viewBox="0 0 24 24" {...strokeProps}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      );
    case "/video":
      return (
        <svg className="size-6" viewBox="0 0 24 24" {...strokeProps}>
          <path d="M23 7l-7 5 7 5V7z" />
          <rect x="1" y="5" width="15" height="14" rx="2" />
        </svg>
      );
    case "/vto": // Clothes hanger
      return (
        <svg className="size-6" viewBox="0 0 24 24" {...strokeProps}>
          <path d="M12 2a3 3 0 00-3 3h6a3 3 0 00-3-3z" />
          <path d="M12 5v3m0 0L3 17a2 2 0 002 2h14a2 2 0 002-2L12 8z" />
        </svg>
      );
    case "/audio":
      return (
        <svg className="size-6" viewBox="0 0 24 24" {...strokeProps}>
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      );
    case "/imagen-upscale":
      return (
        <svg className="size-6" viewBox="0 0 24 24" {...strokeProps}>
          <path d="M21 16V8a2 2 0 00-2-2h-6m-4 0H5a2 2 0 00-2 2v8a2 2 0 002 2h14a2 2 0 002-2" />
          <path d="M17 11l-5-5-5 5M12 6v12" />
        </svg>
      );
    case "/gallery":
      return (
        <svg className="size-6" viewBox="0 0 24 24" {...strokeProps}>
          <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
        </svg>
      );
    case "/fun-templates":
      return (
        <svg className="size-6" viewBox="0 0 24 24" {...strokeProps}>
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      );
    case "/workbench":
      return (
        <svg className="size-6" viewBox="0 0 24 24" {...strokeProps}>
          <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
        </svg>
      );
    case "/workflows":
      return (
        <svg className="size-6" viewBox="0 0 24 24" {...strokeProps}>
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      );
    case "/admin":
      return (
        <svg className="size-6" viewBox="0 0 24 24" {...strokeProps}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    default:
      return (
        <svg className="size-6" viewBox="0 0 24 24" {...strokeProps}>
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
}

const itemBase =
  "relative flex size-14 items-center justify-center rounded-full transition-all duration-[var(--tri-duration-base)]";

function navClass(isActive: boolean) {
  return isActive
    ? "bg-[var(--tri-nav-active-bg)] text-[var(--tri-nav-active-fg)] shadow-[var(--tri-shadow-sm)]"
    : "bg-transparent hover:bg-[var(--tri-nav-active-bg)] text-[var(--tri-nav-sidebar-fg)] hover:text-[var(--tri-nav-active-fg)] border border-[var(--tri-border-inverse)]";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Sidebar({ brand, className = "", footer, items, userPicture, userEmail, userName }: SidebarProps) {
  const menuFixed = useSyncExternalStore(subscribeMenuFixed, getMenuFixedSnapshot, () => false);
  const pathname = usePathname();

  const toggleMenu = useCallback(() => {
    try {
      const next = !(localStorage.getItem(MENU_FIXED_KEY) === "true");
      localStorage.setItem(MENU_FIXED_KEY, String(next));
    } catch {
      // Storage unavailable.
    }
    menuFixedListeners.forEach((listener) => listener());
  }, []);

  async function handleLogout() {
    try {
      const csrfResponse = await fetch("/api/auth/csrf");
      const csrf = await csrfResponse.json();
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "x-csrf-token": csrf.csrfToken,
        },
      });
    } catch (e) {
      console.error("Logout request failed:", e);
    } finally {
      window.location.href = "/login";
    }
  }

  // Tools flyout grouped via the exported pure helper (see groupSidebarItems).
  const { desktop: finalDesktopItems, toolsSubItems: subItems } = groupSidebarItems(items);

  const isToolsActive = subItems.some(
    (item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
  );

  const firstName = userName?.split(" ")[0] ?? "";
  const avatarTooltip = menuFixed
    ? `Hey there ${firstName}! Click to make the menu dynamic`
    : "Click to make the menu fixed";

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <>
      {/* Desktop floating vertical pill (Angular `header.component`) */}
      <aside
        className={`fixed left-[5vw] xl:left-[3vw] top-[10vh] xl:top-[11vh] z-[1000] hidden md:flex flex-col items-center gap-3 p-[7px_0_8px_0] rounded-[48px] border-[var(--tri-border-inverse)] bg-[var(--tri-nav-sidebar-bg)] backdrop-blur-[10px] shadow-xl transition-all duration-[var(--tri-duration-slow)] ease-in-out ${
          menuFixed
            ? "max-h-[850px] overflow-visible"
            : "max-h-[72px] overflow-hidden hover:max-h-[850px] hover:overflow-visible"
        } h-fit w-[72px] ${className}`}
      >
        {/* Profile avatar — toggles menuFixed (Angular `toggleMenu()`) */}
        <Tooltip content={avatarTooltip} multiline position="right">
          <button
            aria-label={menuFixed ? "Unpin menu" : "Pin menu"}
            className="size-14 rounded-full border-[var(--tri-border-inverse)] bg-[var(--tri-nav-active-bg)] overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer shadow-md select-none"
            onClick={toggleMenu}
            title={userEmail}
            type="button"
          >
            {userPicture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="User profile" className="size-full object-cover" src={userPicture} />
            ) : (
              <svg className="size-6 text-[var(--tri-nav-sidebar-fg)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </button>
        </Tooltip>

        <div className="flex flex-col gap-[10px] w-full items-center mt-[10px] flex-1">
          {finalDesktopItems.map((item) => {
            if (item.href === TOOLS_GROUP_HREF) {
              return (
                <Menu
                  closeGraceMs={200}
                  hover
                  key="tools-group"
                  label="Tools"
                  panelClassName="bg-[var(--tri-nav-sidebar-bg)]"
                  side="right"
                  trigger={
                    <span className={`${itemBase} ${navClass(isToolsActive)}`}>
                      <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
                      </svg>
                    </span>
                  }
                >
                  {subItems.map((subitem) => (
                    <MenuItem
                      href={subitem.href}
                      icon={getIconForHref(subitem.href)}
                      key={subitem.href}
                      selected={isActive(subitem.href)}
                    >
                      {subitem.label}
                    </MenuItem>
                  ))}
                </Menu>
              );
            }

            const active = item.active ?? isActive(item.href);
            return (
              <Tooltip content={item.label} key={item.href} position="right">
                <a className={`${itemBase} ${navClass(active)}`} href={item.href}>
                  {getIconForHref(item.href)}
                </a>
              </Tooltip>
            );
          })}

          <Tooltip content="Logout" position="right">
            <button
              className={`${itemBase} mt-auto bg-transparent hover:bg-[var(--tri-state-error)]/20 text-[var(--tri-nav-sidebar-fg)] hover:text-[var(--tri-state-error)] border-[var(--tri-border-inverse)] cursor-pointer`}
              onClick={handleLogout}
              type="button"
            >
              <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          </Tooltip>
        </div>
      </aside>

      {/* Mobile horizontal scrollable bar (Angular mobile `<768px`) */}
      <nav
        aria-label="Primary"
        className="tri-nav-scroll fixed bottom-[2.5vh] left-[2.5vw] z-[1000] flex w-[95vw] items-center gap-2 overflow-x-auto rounded-[48px] border-[var(--tri-border-inverse)] bg-[var(--tri-nav-sidebar-bg)] p-3 backdrop-blur-[10px] shadow-xl md:hidden"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <style>{`.tri-nav-scroll::-webkit-scrollbar{display:none}`}</style>
        {items.map((item) => {
          const active = item.active ?? isActive(item.href);
          return (
            <a
              aria-label={item.label}
              className={`${itemBase} flex-shrink-0 ${navClass(active)}`}
              href={item.href}
              key={item.href}
              title={item.label}
            >
              {getIconForHref(item.href)}
            </a>
          );
        })}
        <button
          aria-label="Logout"
          className={`${itemBase} flex-shrink-0 bg-transparent hover:bg-[var(--tri-state-error)]/20 text-[var(--tri-nav-sidebar-fg)] hover:text-[var(--tri-state-error)] border-[var(--tri-border-inverse)]`}
          onClick={handleLogout}
          title="Logout"
          type="button"
        >
          <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
        </button>
      </nav>
    </>
  );
}
