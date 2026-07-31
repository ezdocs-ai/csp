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

import {HttpClient} from '@angular/common/http';
import {Injectable, signal} from '@angular/core';
import {Observable, shareReplay, tap} from 'rxjs';
import {
  VideoGenerationOptions,
  VideoModelOption,
} from '../common/models/generation-options.model';
import {environment} from '../../environments/environment';

@Injectable({providedIn: 'root'})
export class GenerationOptionsService {
  private readonly videoOptionsSignal = signal<VideoGenerationOptions | null>(
    null,
  );
  private readonly loadingSignal = signal(false);
  private videoOptionsRequest?: Observable<VideoGenerationOptions>;

  readonly videoOptions = this.videoOptionsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  constructor(private readonly http: HttpClient) {}

  loadVideoOptions(): Observable<VideoGenerationOptions> {
    if (this.videoOptionsSignal()) {
      return new Observable<VideoGenerationOptions>(subscriber => {
        subscriber.next(this.videoOptionsSignal()!);
        subscriber.complete();
      });
    }

    if (!this.videoOptionsRequest) {
      this.loadingSignal.set(true);
      this.videoOptionsRequest = this.http
        .get<VideoGenerationOptions>(
          `${environment.backendURL}/options/video-generation`,
        )
        .pipe(
          tap({
            next: options => this.videoOptionsSignal.set(options),
            finalize: () => this.loadingSignal.set(false),
          }),
          shareReplay(1),
        );
    }

    return this.videoOptionsRequest;
  }

  getVideoModel(modelKey: string): VideoModelOption | undefined {
    return this.videoOptionsSignal()?.models.find(
      model => model.modelKey === modelKey,
    );
  }
}
