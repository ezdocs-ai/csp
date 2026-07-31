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

import {Component, OnInit} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
import {firstValueFrom} from 'rxjs';
import {ConfirmationDialogComponent} from '../../common/components/confirmation-dialog/confirmation-dialog.component';
import {
  AiModel,
  AiModelCreate,
  AiProvider,
} from '../../common/models/ai-providers.model';
import {AiModelsService} from '../../services/admin/ai-models.service';
import {AiProvidersService} from '../../services/admin/ai-providers.service';
import {AiModelFormDialogComponent} from './ai-model-form-dialog.component';

@Component({
  selector: 'app-ai-models-management',
  templateUrl: './ai-models-management.component.html',
  styleUrls: ['./ai-models-management.component.scss'],
})
export class AiModelsManagementComponent implements OnInit {
  readonly displayedColumns = [
    'key',
    'displayName',
    'vendorModelId',
    'mediaType',
    'environment',
    'priority',
    'enabled',
    'actions',
  ];
  providers: AiProvider[] = [];
  models: AiModel[] = [];
  selectedProviderId?: number;
  isLoading = true;

  constructor(
    private readonly modelsService: AiModelsService,
    private readonly providersService: AiProvidersService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar,
  ) {}
  ngOnInit(): void {
    void this.loadProviders();
    void this.loadModels();
  }
  async loadProviders(): Promise<void> {
    try {
      this.providers = await firstValueFrom(
        this.providersService.listProviders(),
      );
    } catch (error) {
      this.showError('Load providers failed', error);
    }
  }
  async loadModels(): Promise<void> {
    this.isLoading = true;
    try {
      this.models = await firstValueFrom(
        this.modelsService.listModels(this.selectedProviderId),
      );
    } catch (error) {
      this.showError('Load models failed', error);
    } finally {
      this.isLoading = false;
    }
  }
  providerChanged(providerId: number | undefined): void {
    this.selectedProviderId = providerId;
    void this.loadModels();
  }
  openForm(model?: AiModel): void {
    this.dialog
      .open(AiModelFormDialogComponent, {
        width: '640px',
        data: {model, providerId: this.selectedProviderId},
      })
      .afterClosed()
      .subscribe(async (dto?: AiModelCreate) => {
        if (!dto) return;
        try {
          if (model)
            await firstValueFrom(this.modelsService.updateModel(model.id, dto));
          else await firstValueFrom(this.modelsService.createModel(dto));
          this.snackBar.open(
            `Model ${model ? 'updated' : 'created'}`,
            'Close',
            {duration: 3000},
          );
          await this.loadModels();
        } catch (error) {
          this.showError(
            `Model ${model ? 'update' : 'creation'} failed`,
            error,
          );
        }
      });
  }
  async toggle(model: AiModel, enabled: boolean): Promise<void> {
    try {
      await firstValueFrom(this.modelsService.updateModel(model.id, {enabled}));
      await this.loadModels();
    } catch (error) {
      this.showError('Model update failed', error);
    }
  }
  remove(model: AiModel): void {
    this.dialog
      .open(ConfirmationDialogComponent, {
        width: '400px',
        data: {title: 'Delete model', message: `Delete ${model.displayName}?`},
      })
      .afterClosed()
      .subscribe(async confirmed => {
        if (!confirmed) return;
        try {
          await firstValueFrom(this.modelsService.deleteModel(model.id));
          this.snackBar.open('Model deleted', 'Close', {duration: 3000});
          await this.loadModels();
        } catch (error) {
          this.showError('Model deletion failed', error);
        }
      });
  }
  private showError(message: string, error: unknown): void {
    console.error(message, error);
    this.snackBar.open(message, 'Close', {duration: 5000});
  }
}
