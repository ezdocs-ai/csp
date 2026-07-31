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
  AiProvider,
  AiProviderCreate,
  ProviderType,
} from '../../common/models/ai-providers.model';

export interface AiProviderFormDialogData {
  provider?: AiProvider;
}

@Component({
  selector: 'app-ai-provider-form-dialog',
  templateUrl: './ai-provider-form-dialog.component.html',
})
export class AiProviderFormDialogComponent {
  readonly providerTypes = Object.values(ProviderType);
  readonly provider: AiProvider | undefined;
  readonly form;

  constructor(
    private readonly fb: FormBuilder,
    private readonly dialogRef: MatDialogRef<AiProviderFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) private readonly data: AiProviderFormDialogData,
  ) {
    this.provider = data.provider;
    this.form = fb.group({
      key: [this.provider?.key ?? '', Validators.required],
      displayName: [this.provider?.displayName ?? '', Validators.required],
      providerType: [
        this.provider?.providerType ?? ProviderType.GOOGLE_VEAN,
        Validators.required,
      ],
      enabled: [this.provider?.enabled ?? true],
      secretRef: [''],
      baseUrl: [this.provider?.baseUrl ?? ''],
      timeoutSeconds: [this.provider?.timeoutSeconds ?? null],
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    if (this.provider && !value.secretRef)
      delete (value as Partial<AiProviderCreate>).secretRef;
    this.dialogRef.close(value as AiProviderCreate);
  }
}
