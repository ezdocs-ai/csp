/** Copyright 2025 Google LLC. Licensed under the Apache License, Version 2.0. */
import {AiModelsManagementComponent} from './ai-models-management.component';

describe('AiModelsManagementComponent', () => {
  it('defines model table columns', () => {
    const component = Object.create(
      AiModelsManagementComponent.prototype,
    ) as AiModelsManagementComponent;
    expect(component.displayedColumns).toContain('vendorModelId');
  });
});
