/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { workflowSearchToUi } from "../mapper";
import type { Workflow, WorkflowSearchResponseDto } from "../types";
import { buildSearchParams, parseSearchMeta } from "./workflows-query";

const SEARCH_DEBOUNCE_MS = 500;
const SEARCH_PAGE_SIZE = 12;

const csrf = () => document.cookie.split("; ").find((item) => item.startsWith("csp_csrf="))?.split("=")[1] ?? "";

export function useWorkflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const nameRef = useRef("");
  const pageRef = useRef(1);

  // Fetch a specific page for the current query. Page 1 replaces; >1 appends.
  const fetchPage = useCallback(async (name: string, targetPage: number, append: boolean) => {
    const body = buildSearchParams({ name, page: targetPage, pageSize: SEARCH_PAGE_SIZE });
    const response = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf() },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Workflow search failed");
    const responseDto = (data ?? {}) as WorkflowSearchResponseDto;
    const ui = workflowSearchToUi(responseDto);
    const meta = parseSearchMeta(responseDto, SEARCH_PAGE_SIZE);
    setWorkflows((current) => (append ? [...current, ...ui] : ui));
    setPage(meta.page);
    setTotalPages(meta.totalPages);
    pageRef.current = meta.page;
  }, []);

  const load = useCallback(
    async (name: string, targetPage: number, append: boolean) => {
      if (append) setLoadingMore(true); else { setLoading(true); setError(null); }
      try {
        await fetchPage(name, targetPage, append);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Workflow search failed");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [fetchPage],
  );

  // Debounced search: a query change schedules a page-1 search 500ms later
  // (Angular studio-search-filter uses debounceTime(500) + distinctUntilChanged).
  useEffect(() => {
    nameRef.current = query;
    const timer = window.setTimeout(() => { void load(query, 1, false); }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, load]);

  const loadMore = useCallback(() => {
    const next = pageRef.current + 1;
    if (next > totalPages || loadingMore) return;
    void load(nameRef.current, next, true);
  }, [load, totalPages, loadingMore]);

  const remove = useCallback(async (id: string) => {
    const response = await fetch(`/api/workflows/${encodeURIComponent(id)}`, { method: "DELETE", headers: { "x-csrf-token": csrf() } });
    if (!response.ok) { const data = await response.json(); throw new Error(data.error ?? "Workflow delete failed"); }
    setWorkflows((current) => current.filter((workflow) => workflow.id !== id));
  }, []);

  const hasMore = page < totalPages;

  return { workflows, loading, loadingMore, error, query, setQuery, page, totalPages, hasMore, loadMore, remove };
}
