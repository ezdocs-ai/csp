# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""In-memory adapter registry and enabled-model resolution."""

from collections.abc import Callable

from src.ai_providers.constants import ProviderTypeEnum
from src.ai_providers.contract import VideoProviderAdapter
from src.ai_providers.schema.ai_model_model import AiModelModel
from src.ai_providers.schema.ai_provider_model import AiProviderModel

AdapterFactory = Callable[[], VideoProviderAdapter]


class ProviderRegistryService:
    """Maps provider types to adapter factories."""

    def __init__(self) -> None:
        self._factories: dict[ProviderTypeEnum, AdapterFactory] = {}

    def register(
        self, provider_type: ProviderTypeEnum, factory: AdapterFactory
    ) -> None:
        """Registers adapter factory for an allowlisted provider type."""
        self._factories[provider_type] = factory

    def resolve(
        self, model: AiModelModel, provider: AiProviderModel
    ) -> VideoProviderAdapter:
        """Returns enabled provider adapter for an enabled configured model."""
        if not model.enabled:
            raise ValueError(f"AI model '{model.key}' is disabled.")
        if not provider.enabled:
            raise ValueError(f"AI provider '{provider.key}' is disabled.")
        if model.provider_id != provider.id:
            raise ValueError(
                f"AI model '{model.key}' does not belong to provider '{provider.key}'."
            )
        factory = self._factories.get(provider.provider_type)
        if factory is None:
            raise LookupError(
                f"No adapter registered for provider type "
                f"'{provider.provider_type}'."
            )
        adapter = factory()
        if not isinstance(adapter, VideoProviderAdapter):
            raise TypeError(
                f"Adapter for provider type '{provider.provider_type}' "
                "does not satisfy VideoProviderAdapter."
            )
        return adapter
