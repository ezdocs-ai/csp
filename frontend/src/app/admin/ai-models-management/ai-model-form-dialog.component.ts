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

import {Component, Inject} from '@angular/core';
import {FormBuilder, Validators} from '@angular/forms';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {
  AiModel,
  AiModelCreate,
  Environment,
  MediaType,
} from '../../common/models/ai-providers.model';

export interface AiModelFormDialogData {
  model?: AiModel;
  providerId?: number;
}

@Component({
  selector: 'app-ai-model-form-dialog',
  templateUrl: './ai-model-form-dialog.component.html',
})
export class AiModelFormDialogComponent {
  readonly model: AiModel | undefined;
  readonly mediaTypes = Object.values(MediaType);
  readonly environments = Object.values(Environment);
  readonly form;
  jsonError = '';

  constructor(
    private readonly fb: FormBuilder,
    private readonly dialogRef: MatDialogRef<AiModelFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) private readonly data: AiModelFormDialogData,
  ) {
    this.model = data.model;
    this.form = fb.group({
      key: [this.model?.key ?? '', Validators.required],
      providerId: [
        this.model?.providerId ?? data.providerId ?? null,
        Validators.required,
      ],
      vendorModelId: [this.model?.vendorModelId ?? '', Validators.required],
      mediaType: [
        this.model?.mediaType ?? MediaType.VIDEO,
        Validators.required,
      ],
      displayName: [this.model?.displayName ?? '', Validators.required],
      enabled: [this.model?.enabled ?? true],
      capabilities: [
        JSON.stringify(
          this.model?.capabilities ?? {
            textToVideo: false,
            imageToVideo: false,
            durations: [],
            aspectRatios: [],
            resolutions: [],
            maxOutputs: 1,
          },
          null,
          2,
        ),
        Validators.required,
      ],
      defaults: [
        JSON.stringify(this.model?.defaults ?? {}, null, 2),
        Validators.required,
      ],
      costMetadata: [JSON.stringify(this.model?.costMetadata ?? null, null, 2)],
      environment: [
        this.model?.environment ?? Environment.PRODUCTION,
        Validators.required,
      ],
      priority: [this.model?.priority ?? 0, Validators.required],
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    try {
      this.dialogRef.close({
        ...value,
        providerId: Number(value.providerId),
        priority: Number(value.priority),
        capabilities: JSON.parse(value.capabilities ?? '{}'),
        defaults: JSON.parse(value.defaults ?? '{}'),
        costMetadata: JSON.parse(value.costMetadata || 'null'),
      } as AiModelCreate);
    } catch {
      this.jsonError =
        'Capabilities, defaults, and cost metadata must be valid JSON.';
    }
  }
}
