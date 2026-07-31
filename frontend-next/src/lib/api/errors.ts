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

export type ApiErrorKind = "network" | "unauthorized" | "forbidden" | "not-found" | "http";

export type ApiValidationDetail = {
  loc?: Array<string | number>;
  msg?: string;
  type?: string;
  [key: string]: unknown;
};

type ApiErrorOptions = {
  status: number;
  statusText: string;
  code?: string;
  message: string;
  details?: ApiValidationDetail[];
  response?: Response;
  cause?: unknown;
};

export class ApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly code?: string;
  readonly details?: ApiValidationDetail[];
  readonly response?: Response;
  readonly kind: ApiErrorKind;

  constructor({ status, statusText, code, message, details, response, cause }: ApiErrorOptions) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.code = code;
    this.details = details;
    this.response = response;
    this.kind = errorKind(status, code);
  }

  static async fromResponse(response: Response): Promise<ApiError> {
    const body: unknown = await response.json().catch(() => undefined);
    const detail = isRecord(body) ? body.detail : undefined;
    const details = Array.isArray(detail) ? detail.filter(isValidationDetail) : undefined;
    const code = typeof detail === "string" ? detail : undefined;
    const message = code ?? details?.map((item) => item.msg).filter(Boolean).join(", ") ?? response.statusText;

    return new ApiError({
      status: response.status,
      statusText: response.statusText,
      code,
      message,
      details,
      response,
    });
  }

  static network(cause: unknown): ApiError {
    const message = cause instanceof Error ? cause.message : "Network request failed";
    return new ApiError({
      // A network failure has no upstream HTTP response. Expose it to BFF
      // callers as 502 instead of the Fetch API's synthetic status 0, which
      // is not a valid status for Response/NextResponse.
      status: 502,
      statusText: "Bad Gateway",
      code: "NETWORK_ERROR",
      message,
      cause,
    });
  }
}

function errorKind(status: number, code?: string): ApiErrorKind {
  if (code === "NETWORK_ERROR") return "network";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  return "http";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidationDetail(value: unknown): value is ApiValidationDetail {
  return isRecord(value);
}
