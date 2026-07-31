// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

// Valid backend roles — matches UserRolesEnum (user/creator/admin/workflows).
export type AdminRole = "admin" | "user" | "creator" | "workflows" | string;

export interface AdminUser {
  id: number;
  email: string;
  name?: string | null;
  display_name?: string | null;
  picture?: string | null;
  roles?: AdminRole[];
  role?: AdminRole;
  is_deleted?: boolean;
  deleted_at?: string | null;
  createdAt?: string;
  updatedAt?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AdminUsersResponse {
  items?: AdminUser[];
  data?: AdminUser[];
  total?: number;
  page?: number;
  limit?: number;
  total_pages?: number;
}

export interface DashboardData {
  overview: { totalUsers?: number; totalWorkspaces?: number; imagesGenerated?: number; videosGenerated?: number; audiosGenerated?: number; totalMedia?: number; userUploadedMedia?: number; overallTotalMedia?: number; [key: string]: number | undefined };
  mediaOverTime: { date?: string; label?: string; totalGenerated?: number; total?: number; count?: number; [key: string]: string | number | undefined }[];
  activeRoles: { role: string; count: number }[];
  generationHealth: { date?: string; status?: string; count?: number; [key: string]: string | number | undefined }[];
}
