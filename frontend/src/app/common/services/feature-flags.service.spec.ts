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

import {TestBed} from '@angular/core/testing';
import {FeatureFlagsService} from './feature-flags.service';

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FeatureFlagsService);
  });

  it('keeps AI registry administration disabled by default', () => {
    expect(service.isEnabled('aiProviderRegistryAdmin')()).toBeFalse();
  });

  it('updates runtime flags', () => {
    service.setEnabled('aiProviderRegistryAdmin', true);

    expect(service.isEnabled('aiProviderRegistryAdmin')()).toBeTrue();
  });
});
