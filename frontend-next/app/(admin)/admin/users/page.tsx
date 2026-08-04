// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

import { UsersTable } from "@/src/features/admin/components/users-table";
import type { AdminUsersResponse } from "@/src/features/admin";
import { requireApiClient } from "@/src/lib/api/server";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = new URLSearchParams(Object.entries(params).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : [])).toString();
  let users: AdminUsersResponse = { items: [] };
  try {
    users = await (await requireApiClient()).get<AdminUsersResponse>(`/api/users?${query}`);
  } catch (error) {
    console.error("Admin users request failed", error);
  }
  return <section><header className="mb-6"><h1 className="font-[var(--tri-font-display)] text-[length:var(--tri-text-h2-size)] leading-[var(--tri-text-h2-line-height)]">Users</h1><p className="text-[var(--tri-text-secondary)]">Manage access and account status.</p></header><UsersTable initial={users} /></section>;
}
