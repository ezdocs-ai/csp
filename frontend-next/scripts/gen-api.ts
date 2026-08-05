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
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const OUT = "src/lib/api/types.ts";

const result = spawnSync("bunx", ["openapi-typescript", "openapi.json", "-o", OUT], {
  cwd: root,
  stdio: "inherit",
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

// openapi-typescript emits no license header, but the repo-wide addlicense gate
// (.github/workflows/license-check.yml) requires one on every *.ts file. Without
// this, `license-check` and the `Verify generated API types` diff gate in
// frontend-next.yml can never both pass. Keep the text byte-identical to what
// `addlicense -c "Google LLC" -l apache` produces.
const HEADER = `/**
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

`;

const path = new URL(OUT, root);
const body = readFileSync(path, "utf8");
if (!body.includes("Licensed under the Apache License")) writeFileSync(path, HEADER + body);
