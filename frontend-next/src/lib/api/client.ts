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

import { ApiError } from "./errors";

export type ApiClientOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  getHeaders?: () => HeadersInit | Promise<HeadersInit>;
};

export type RequestOptions = Omit<RequestInit, "body" | "headers" | "method"> & {
  headers?: HeadersInit;
};

export type Paginated<T> = {
  data: T[] | null;
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ApiClient = {
  get<T>(path: string, init?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: BodyInit | null, init?: RequestOptions): Promise<T>;
  put<T>(path: string, body?: BodyInit | null, init?: RequestOptions): Promise<T>;
  patch<T>(path: string, body?: BodyInit | null, init?: RequestOptions): Promise<T>;
  delete<T>(path: string, init?: RequestOptions): Promise<T>;
  getBlob(path: string, init?: RequestOptions): Promise<Blob>;
  postBlob(path: string, body?: BodyInit | null, init?: RequestOptions): Promise<Blob>;
};

export function createApiClient({
  baseUrl = defaultBaseUrl(),
  fetchImpl = fetch,
  getHeaders,
}: ApiClientOptions = {}): ApiClient {
  async function request<T>(method: string, path: string, body?: BodyInit | null, init: RequestOptions = {}): Promise<T> {
    const headers = new Headers(await getHeaders?.());
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if (body !== undefined && body !== null && !headers.has("content-type") && !(body instanceof FormData)) {
      headers.set("content-type", "application/json");
    }

    let response: Response;
    try {
      response = await fetchImpl(resolveUrl(baseUrl, path), { ...init, method, headers, body });
    } catch (cause) {
      console.error("Backend API request failed", {
        method,
        path,
        baseUrl,
        error: cause instanceof Error ? { name: cause.name, message: cause.message } : String(cause),
      });
      throw ApiError.network(cause);
    }
    if (!response.ok) throw await ApiError.fromResponse(response);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  return {
    get: <T>(path: string, init?: RequestOptions) => request<T>("GET", path, undefined, init),
    post: <T>(path: string, body?: BodyInit | null, init?: RequestOptions) => request<T>("POST", path, body, init),
    put: <T>(path: string, body?: BodyInit | null, init?: RequestOptions) => request<T>("PUT", path, body, init),
    patch: <T>(path: string, body?: BodyInit | null, init?: RequestOptions) => request<T>("PATCH", path, body, init),
    delete: <T>(path: string, init?: RequestOptions) => request<T>("DELETE", path, undefined, init),
    async getBlob(path: string, init?: RequestOptions): Promise<Blob> {
      const headers = new Headers(await getHeaders?.());
      new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
      try {
        const response = await fetchImpl(resolveUrl(baseUrl, path), { ...init, method: "GET", headers });
        if (!response.ok) throw await ApiError.fromResponse(response);
        return response.blob();
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw ApiError.network(error);
      }
    },
    async postBlob(path: string, body?: BodyInit | null, init?: RequestOptions): Promise<Blob> {
      const headers = new Headers(await getHeaders?.());
      new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
      if (body !== undefined && body !== null && !headers.has("content-type") && !(body instanceof FormData)) headers.set("content-type", "application/json");
      try {
        const response = await fetchImpl(resolveUrl(baseUrl, path), { ...init, method: "POST", headers, body });
        if (!response.ok) throw await ApiError.fromResponse(response);
        return response.blob();
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw ApiError.network(error);
      }
    },
  };
}

function defaultBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.BACKEND_URL ?? "";
}

function resolveUrl(baseUrl: string, path: string): string {
  if (!baseUrl) return path;
  return new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}
