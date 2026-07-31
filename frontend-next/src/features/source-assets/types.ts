/** Copyright 2026 Google LLC — Apache-2.0 */

export type SourceAssetType = "image" | "video" | "audio";

export type SourceAsset = {
  id: string;
  name: string;
  type: SourceAssetType;
  url?: string;
  thumbnailUrl?: string;
  size?: number;
  createdAt?: string;
  status?: string;
  metadata?: Record<string, unknown>;
  // Admin browse fields (camelCased by backend BaseDto, spread through BFF).
  originalFilename?: string;
  mimeType?: string;
  scope?: string;
  assetType?: string;
  gcsUri?: string;
  workspaceId?: number | string;
  userId?: number | string;
};

export type UploadUrlResponse = { uploadUrl: string; assetId: string };

export type SourceAssetPage = { data: SourceAsset[]; count: number; page: number; pageSize: number; totalPages: number };
