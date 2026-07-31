/**
 * Copyright 2025 Google LLC
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

import {Injectable, Signal, computed, signal} from '@angular/core';

@Injectable({providedIn: 'root'})
export class FeatureFlagsService {
  // ponytail: replace with centralized config when integration lane ships one.
  private readonly flags = signal<Record<string, boolean>>({
    aiProviderRegistryAdmin: false,
  });

  isEnabled(flag: string): Signal<boolean> {
    return computed(() => this.flags()[flag] ?? false);
  }

  setEnabled(flag: string, enabled: boolean): void {
    this.flags.update(flags => ({...flags, [flag]: enabled}));
  }
}
