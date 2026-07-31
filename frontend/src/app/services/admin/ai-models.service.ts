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

import {HttpClient, HttpParams} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {environment} from '../../../environments/environment';
import {
  AiModel,
  AiModelCreate,
  AiModelUpdate,
} from '../../common/models/ai-providers.model';

@Injectable({providedIn: 'root'})
export class AiModelsService {
  private readonly baseUrl = `${environment.backendURL}/admin/ai-models`;

  constructor(private readonly http: HttpClient) {}

  listModels(providerId?: number): Observable<AiModel[]> {
    const params =
      providerId === undefined
        ? undefined
        : new HttpParams().set('provider_id', providerId);
    return this.http.get<AiModel[]>(this.baseUrl, {params});
  }

  getModel(id: number): Observable<AiModel> {
    return this.http.get<AiModel>(`${this.baseUrl}/${id}`);
  }

  createModel(dto: AiModelCreate): Observable<AiModel> {
    return this.http.post<AiModel>(this.baseUrl, dto);
  }

  updateModel(id: number, dto: AiModelUpdate): Observable<AiModel> {
    return this.http.patch<AiModel>(`${this.baseUrl}/${id}`, dto);
  }

  deleteModel(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
