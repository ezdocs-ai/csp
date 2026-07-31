/**
 * Copyright 2026 Google LLC
 *
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

import "server-only";

import { getSession } from "../auth/server";
import { createApiClient, type ApiClient } from "./client";
import { ApiError } from "./errors";

export async function getServerApiClient(): Promise<ApiClient | null> {
  const session = await getSession();
  if (!session) return null;
  return createApiClient({
    baseUrl: process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
    getHeaders: () => ({ Authorization: `Bearer ${session.idToken}` }),
  });
}

export async function requireApiClient(): Promise<ApiClient> {
  const client = await getServerApiClient();
  if (!client) {
    throw new ApiError({
      status: 401,
      statusText: "Unauthorized",
      code: "NO_SESSION",
      message: "Unauthorized: no active session",
    });
  }
  return client;
}
