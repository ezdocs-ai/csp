/** Copyright 2025 Google LLC. Licensed under the Apache License, Version 2.0. */
import {AiProvidersManagementComponent} from './ai-providers-management.component';

describe('AiProvidersManagementComponent', () => {
  it('defines provider table columns', () => {
    const component = Object.create(
      AiProvidersManagementComponent.prototype,
    ) as AiProvidersManagementComponent;
    expect(component.displayedColumns).toContain('hasSecret');
  });
});
