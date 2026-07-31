/* Copyright 2026 Google LLC
 * Licensed under Apache-2.0
 */
"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export interface PaginationProps { currentPage: number; totalPages: number; }

export function Pagination({ currentPage, totalPages }: PaginationProps) {
  // Preserve all current filters (type/status/tags/query/…) and only change the page.
  const search = useSearchParams();
  if (totalPages <= 1) return null;
  const pageHref = (page: number) => { const params = new URLSearchParams(search ?? undefined); params.set("page", String(page)); return `?${params.toString()}`; };
  return <nav aria-label="Gallery pages" className="flex flex-wrap items-center justify-center gap-[var(--tri-space-2)]"><Link aria-disabled={currentPage === 1} className="grid min-h-[44px] min-w-[44px] place-items-center rounded-[var(--tri-button-radius)] border border-[var(--tri-button-secondary-border)] text-[var(--tri-text-primary)] aria-disabled:pointer-events-none aria-disabled:opacity-[var(--tri-opacity-disabled)]" href={pageHref(Math.max(1, currentPage - 1))}>Previous</Link>{Array.from({ length: totalPages }, (_, index) => index + 1).slice(Math.max(0, currentPage - 3), currentPage + 2).map((page) => <Link aria-current={page === currentPage ? "page" : undefined} className="grid size-[44px] place-items-center rounded-[var(--tri-button-radius)] border border-[var(--tri-button-secondary-border)] text-[var(--tri-text-primary)] aria-current:bg-[var(--tri-button-primary-bg)] aria-current:text-[var(--tri-button-primary-fg)]" href={pageHref(page)} key={page}>{page}</Link>)}<Link aria-disabled={currentPage === totalPages} className="grid min-h-[44px] min-w-[44px] place-items-center rounded-[var(--tri-button-radius)] border border-[var(--tri-button-secondary-border)] text-[var(--tri-text-primary)] aria-disabled:pointer-events-none aria-disabled:opacity-[var(--tri-opacity-disabled)]" href={pageHref(Math.min(totalPages, currentPage + 1))}>Next</Link></nav>;
}
