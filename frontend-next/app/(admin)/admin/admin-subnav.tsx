// Copyright 2026 Google LLC — Apache-2.0
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";


const ADMIN_SUBNAV = [
  ["Dashboard", "/admin"],
  ["Users", "/admin/users"],
  ["Source Assets", "/admin/source-assets"],
  ["Templates", "/admin/templates"],
  ["Media Gallery", "/admin/media-gallery"],
  ["Tags", "/admin/tags"],
  ["AI Providers", "/admin/ai-providers"],
  ["AI Models", "/admin/ai-models"],
] as const;


export function AdminSubnav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin"
      className="mb-[var(--tri-space-6)] flex flex-wrap gap-2 border-b border-[var(--tri-border-default)] pb-[var(--tri-space-4)] md:ml-[7.5rem] xl:ml-[7rem]"
    >
      {ADMIN_SUBNAV.map(([label, href]) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`rounded-[var(--tri-radius-md)] px-[var(--tri-space-3)] py-[var(--tri-space-2)] text-[length:var(--tri-text-small-size)] hover:bg-white/10 hover:text-[var(--tri-text-primary)] ${active ? "bg-white/10 text-[var(--tri-text-primary)]" : "text-[var(--tri-text-secondary)]"}`}
            href={href}
            key={href}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
