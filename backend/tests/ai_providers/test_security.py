# Copyright 2026 Google LLC
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
"""Security boundaries for provider DTOs, registry, and job metadata."""

import pytest

from src.ai_providers.constants import (
    EnvironmentEnum,
    MediaTypeEnum,
    ProviderTypeEnum,
)
from src.ai_providers.contract import normalize_state
from src.ai_providers.dto.ai_provider_dto import (
    AiModelResponseDto,
    AiProviderResponseDto,
)
from src.ai_providers.registry_service import ProviderRegistryService
from src.ai_providers.schema.ai_model_model import AiModelModel
from src.ai_providers.schema.ai_provider_model import AiProviderModel
from src.ai_providers.schema.provider_job_model import ProviderJobModel
from src.common.schema.media_item_model import JobStatusEnum


def provider() -> AiProviderModel:
    """Builds internal provider model containing a secret reference."""
    return AiProviderModel(
        id=1,
        key="fake-provider",
        display_name="Fake Provider",
        provider_type=ProviderTypeEnum.GOOGLE_VEAN,
        secret_ref="projects/x/secrets/y",
    )


def model(provider_id: int = 1) -> AiModelModel:
    """Builds enabled internal video model."""
    return AiModelModel(
        id=2,
        key="fake-video",
        provider_id=provider_id,
        vendor_model_id="fake-video-v1",
        media_type=MediaTypeEnum.VIDEO,
        display_name="Fake Video",
        capabilities={},
        defaults={},
        environment=EnvironmentEnum.LOCAL,
    )


def test_provider_response_does_not_expose_secret_ref():
    response = AiProviderResponseDto.model_validate(provider())
    dumped = response.model_dump(by_alias=True)
    assert not hasattr(response, "secret_ref")
    assert "secretRef" not in dumped
    assert "secret_ref" not in dumped


def test_model_response_cannot_embed_provider_secret_ref():
    response = AiModelResponseDto.model_validate(model())
    dumped = response.model_dump(mode="json", by_alias=True)
    assert "secretRef" not in str(dumped)
    assert "secret_ref" not in str(dumped)


def test_provider_job_metadata_accepts_arbitrary_dict():
    job = ProviderJobModel(
        media_item_id=1,
        provider_id=1,
        model_id=2,
        provider_job_id="fake-provider-job-1",
        status=JobStatusEnum.PROCESSING,
        request_metadata={"nested": {"arbitrary": ["value"]}},
        provider_metrics={},
    )
    assert job.request_metadata["nested"]["arbitrary"] == ["value"]


def test_request_metadata_redaction_helper_is_documented_for_future_wave():
    # ponytail: add redact_request_metadata before persisting provider job metadata.
    pytest.skip("redaction helper not yet implemented")


def test_registry_rejects_factory_returning_non_adapter():
    registry = ProviderRegistryService()
    registry.register(ProviderTypeEnum.GOOGLE_VEAN, object)
    with pytest.raises(
        TypeError, match="does not satisfy VideoProviderAdapter"
    ):
        registry.resolve(model(), provider())


def test_registry_rejects_model_owned_by_another_provider():
    registry = ProviderRegistryService()
    with pytest.raises(ValueError, match="does not belong to provider"):
        registry.resolve(model(provider_id=99), provider())


@pytest.mark.parametrize(
    "raw", ["success", "error", "cancelled", "unknown", ""]
)
def test_normalize_state_always_returns_job_status_member(raw):
    normalized = normalize_state(raw)
    assert isinstance(normalized, JobStatusEnum)
    assert normalized in JobStatusEnum
