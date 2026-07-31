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
"""Provider registry tests."""

import pytest

from src.ai_providers.constants import (
    EnvironmentEnum,
    MediaTypeEnum,
    ProviderTypeEnum,
)
from src.ai_providers.registry_service import ProviderRegistryService
from src.ai_providers.schema.ai_model_model import AiModelModel
from src.ai_providers.schema.ai_provider_model import AiProviderModel
from tests.ai_providers.test_contract import FakeAdapter


def provider(enabled=True):
    return AiProviderModel(
        id=1,
        key="google_veo",
        display_name="Google Veo",
        provider_type=ProviderTypeEnum.GOOGLE_VEAN,
        enabled=enabled,
    )


def model(enabled=True):
    return AiModelModel(
        id=1,
        key="veo",
        provider_id=1,
        vendor_model_id="veo",
        media_type=MediaTypeEnum.VIDEO,
        display_name="Veo",
        enabled=enabled,
        capabilities={},
        defaults={},
        environment=EnvironmentEnum.LOCAL,
    )


def test_resolve_returns_registered_adapter():
    registry = ProviderRegistryService()
    registry.register(ProviderTypeEnum.GOOGLE_VEAN, FakeAdapter)
    assert isinstance(registry.resolve(model(), provider()), FakeAdapter)


@pytest.mark.parametrize(
    "disabled_model,disabled_provider", [(True, False), (False, True)]
)
def test_resolve_rejects_disabled_config(disabled_model, disabled_provider):
    registry = ProviderRegistryService()
    registry.register(ProviderTypeEnum.GOOGLE_VEAN, FakeAdapter)
    with pytest.raises(ValueError, match="disabled"):
        registry.resolve(model(disabled_model), provider(disabled_provider))


def test_resolve_rejects_missing_adapter():
    with pytest.raises(LookupError, match="No adapter"):
        ProviderRegistryService().resolve(model(), provider())
