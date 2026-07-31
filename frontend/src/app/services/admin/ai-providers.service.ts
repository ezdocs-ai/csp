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

import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {environment} from '../../../environments/environment';
import {
  AiProvider,
  AiProviderCreate,
  AiProviderUpdate,
  ProviderTestResult,
} from '../../common/models/ai-providers.model';

@Injectable({providedIn: 'root'})
export class AiProvidersService {
  private readonly baseUrl = `${environment.backendURL}/admin/ai-providers`;

  constructor(private readonly http: HttpClient) {}

  listProviders(): Observable<AiProvider[]> {
    return this.http.get<AiProvider[]>(this.baseUrl);
  }

  getProvider(id: number): Observable<AiProvider> {
    return this.http.get<AiProvider>(`${this.baseUrl}/${id}`);
  }

  createProvider(dto: AiProviderCreate): Observable<AiProvider> {
    return this.http.post<AiProvider>(this.baseUrl, dto);
  }

  updateProvider(id: number, dto: AiProviderUpdate): Observable<AiProvider> {
    return this.http.patch<AiProvider>(`${this.baseUrl}/${id}`, dto);
  }

  deleteProvider(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  testProvider(id: number): Observable<ProviderTestResult> {
    return this.http.post<ProviderTestResult>(`${this.baseUrl}/${id}/test`, {});
  }
}
