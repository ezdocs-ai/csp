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

export const GIS_SCRIPT_URL = "https://accounts.google.com/gsi/client";

export const GIS_CONFIG = {
  client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
  auto_select: false,
  cancel_on_tap_outside: true,
  use_fedcm_for_prompt: true,
} as const;

export type GoogleCredentialResponse = {
  credential: string;
  select_by: string;
};
