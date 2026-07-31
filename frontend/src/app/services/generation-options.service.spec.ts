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

import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {GenerationOptionsService} from './generation-options.service';
import {VideoGenerationOptions} from '../common/models/generation-options.model';

const payload: VideoGenerationOptions = {
  defaultModelKey: 'veo-3.1-generate-001',
  models: [
    {
      modelKey: 'veo-3.1-generate-001',
      displayName: 'Veo 3.1 Generate',
      vendorModelId: 'veo-3.1-generate-001',
      providerKey: 'google_veo',
      providerType: 'GOOGLE_VEAN',
      environment: 'PRODUCTION',
      priority: 100,
      capabilities: {
        textToVideo: true,
        imageToVideo: true,
        referenceImages: true,
        durations: [4, 6, 8],
        aspectRatios: ['16:9', '9:16'],
        resolutions: ['1K', '2K', '4K'],
        maxOutputs: 1,
      },
      defaults: {
        durationSeconds: 8,
        aspectRatio: '16:9',
        resolution: '1K',
      },
    },
  ],
};

describe('GenerationOptionsService', () => {
  let service: GenerationOptionsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({imports: [HttpClientTestingModule]});
    service = TestBed.inject(GenerationOptionsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads and caches video options', () => {
    let receivedDefault: string | undefined;
    service.loadVideoOptions().subscribe(options => {
      receivedDefault = options.defaultModelKey;
    });

    http.expectOne('/api/options/video-generation').flush(payload);

    expect(receivedDefault).toBe(payload.defaultModelKey);
    expect(service.videoOptions()).toEqual(payload);
    expect(service.getVideoModel(payload.defaultModelKey)).toEqual(
      payload.models[0],
    );
  });
});
