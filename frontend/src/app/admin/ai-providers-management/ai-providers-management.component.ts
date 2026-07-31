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
  AiProvider,
  AiProviderCreate,
} from '../../common/models/ai-providers.model';
import {AiProvidersService} from '../../services/admin/ai-providers.service';
import {AiProviderFormDialogComponent} from './ai-provider-form-dialog.component';

@Component({
  selector: 'app-ai-providers-management',
  templateUrl: './ai-providers-management.component.html',
  styleUrls: ['./ai-providers-management.component.scss'],
})
export class AiProvidersManagementComponent implements OnInit {
  readonly displayedColumns = [
    'key',
    'displayName',
    'providerType',
    'enabled',
    'hasSecret',
    'actions',
  ];
  providers: AiProvider[] = [];
  isLoading = true;

  constructor(
    private readonly service: AiProvidersService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar,
  ) {}
  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.isLoading = true;
    try {
      this.providers = await firstValueFrom(this.service.listProviders());
    } catch (error) {
      this.showError('Load providers failed', error);
    } finally {
      this.isLoading = false;
    }
  }

  openForm(provider?: AiProvider): void {
    this.dialog
      .open(AiProviderFormDialogComponent, {width: '560px', data: {provider}})
      .afterClosed()
      .subscribe(async (dto?: AiProviderCreate) => {
        if (!dto) return;
        try {
          if (provider)
            await firstValueFrom(this.service.updateProvider(provider.id, dto));
          else await firstValueFrom(this.service.createProvider(dto));
          this.snackBar.open(
            `Provider ${provider ? 'updated' : 'created'}`,
            'Close',
            {duration: 3000},
          );
          await this.load();
        } catch (error) {
          this.showError(
            `Provider ${provider ? 'update' : 'creation'} failed`,
            error,
          );
        }
      });
  }

  async toggle(provider: AiProvider, enabled: boolean): Promise<void> {
    try {
      await firstValueFrom(this.service.updateProvider(provider.id, {enabled}));
      await this.load();
    } catch (error) {
      this.showError('Provider update failed', error);
    }
  }

  async test(provider: AiProvider): Promise<void> {
    try {
      const result = await firstValueFrom(
        this.service.testProvider(provider.id),
      );
      this.snackBar.open(
        `${result.success ? 'Success' : 'Failed'}: ${result.message}`,
        'Close',
        {duration: 5000},
      );
    } catch (error) {
      this.showError('Provider test failed', error);
    }
  }

  remove(provider: AiProvider): void {
    this.dialog
      .open(ConfirmationDialogComponent, {
        width: '400px',
        data: {
          title: 'Delete provider',
          message: `Delete ${provider.displayName}?`,
        },
      })
      .afterClosed()
      .subscribe(async confirmed => {
        if (!confirmed) return;
        try {
          await firstValueFrom(this.service.deleteProvider(provider.id));
          this.snackBar.open('Provider deleted', 'Close', {duration: 3000});
          await this.load();
        } catch (error: unknown) {
          this.showError(
            (error as {status?: number}).status === 409
              ? 'Provider has models. Delete or move them first.'
              : 'Provider deletion failed',
            error,
          );
        }
      });
  }

  private showError(message: string, error: unknown): void {
    console.error(message, error);
    this.snackBar.open(message, 'Close', {duration: 5000});
  }
}
