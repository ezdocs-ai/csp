// Copyright 2025 Google LLC — Apache-2.0
"use client";

import { useCallback, useState } from "react";
import type { AdminRole, AdminUser, AdminUsersResponse } from "../types";
import { pageOffset, toQuery, type QueryParams } from "../components/admin-controls";

export const USER_ROLES: AdminRole[] = ["user", "creator", "admin", "workflows"];

const csrf = () => document.cookie.split("; ").find((item) => item.startsWith("csp_csrf="))?.split("=")[1] ?? "";
const options = (method: string, body?: unknown) => ({ method, headers: { "content-type": "application/json", "x-csrf-token": csrf() }, body: body === undefined ? undefined : JSON.stringify(body) });

export interface UsersQuery { email?: string; includeDeleted?: boolean; limit?: number; offset?: number; }
export function buildUsersQuery(query: UsersQuery): string {
  const params: QueryParams = { email: query.email ?? "", includeDeleted: query.includeDeleted ? true : null, limit: query.limit ?? 10, offset: query.offset };
  return toQuery(params);
}

export function useAdminUsers(initial: AdminUsersResponse) {
  const [result, setResult] = useState(initial);
  const refresh = useCallback(async (query: UsersQuery = {}) => {
    const response = await fetch(`/api/admin/users${buildUsersQuery(query)}`);
    if (!response.ok) throw new Error("Could not load users");
    const next = await response.json() as AdminUsersResponse;
    setResult(next);
    return next;
  }, []);
  // Backend UserUpdateRoleDto takes a roles ARRAY.
  const updateRoles = useCallback(async (id: number, roles: AdminRole[]) => {
    const response = await fetch(`/api/admin/users/${id}`, options("PATCH", { roles }));
    if (!response.ok) throw new Error("Could not update roles");
    const user = await response.json() as AdminUser;
    setResult((current) => ({ ...current, items: (current.items ?? current.data ?? []).map((item) => item.id === id ? user : item) }));
    return user;
  }, []);
  const remove = useCallback(async (id: number) => { const response = await fetch(`/api/admin/users/${id}`, options("DELETE")); if (!response.ok) throw new Error("Could not delete user"); await refresh(); }, [refresh]);
  const restore = useCallback(async (id: number) => { const response = await fetch(`/api/admin/users/${id}`, options("POST")); if (!response.ok) throw new Error("Could not restore user"); await refresh(); }, [refresh]);
  return { result, refresh, updateRoles, remove, restore };
}

export { pageOffset };
