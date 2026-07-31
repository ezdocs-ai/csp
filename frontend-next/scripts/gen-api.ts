#!/usr/bin/env bun
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

/** Regenerate types: bun scripts/gen-api.ts */
import { spawnSync } from "node:child_process";

const result = spawnSync(
  "bunx",
  ["openapi-typescript", "openapi.json", "-o", "src/lib/api/types.ts"],
  { cwd: new URL("..", import.meta.url), stdio: "inherit" },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
