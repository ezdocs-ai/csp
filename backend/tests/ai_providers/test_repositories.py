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
"""AI provider repository tests."""

from unittest.mock import MagicMock

import pytest

from src.ai_providers.constants import (
    EnvironmentEnum,
    MediaTypeEnum,
    ProviderTypeEnum,
)
from src.ai_providers.repository.ai_model_repository import AiModelRepository
from src.ai_providers.repository.ai_provider_repository import (
    AiProviderRepository,
)
from src.ai_providers.repository.provider_job_repository import (
    ProviderJobRepository,
)
from src.ai_providers.schema.ai_model_model import AiModelModel
from src.ai_providers.schema.ai_provider_model import AiProviderModel
from src.ai_providers.schema.provider_job_model import ProviderJobModel
from src.common.schema.media_item_model import JobStatusEnum


@pytest.mark.asyncio
async def test_provider_repository_get_by_key(db_session_mock):
    provider = AiProviderModel(
        id=1,
        key="google_veo",
        display_name="Google Veo",
        provider_type=ProviderTypeEnum.GOOGLE_VEAN,
    )
    result = MagicMock()
    result.scalar_one_or_none.return_value = provider
    db_session_mock.execute.return_value = result
    found = await AiProviderRepository(db_session_mock).get_by_key("google_veo")
    assert found == provider
    db_session_mock.execute.assert_awaited_once()


@pytest.mark.asyncio
async def test_model_repository_get_by_key(db_session_mock):
    model = AiModelModel(
        id=1,
        key="veo",
        provider_id=1,
        vendor_model_id="veo",
        media_type=MediaTypeEnum.VIDEO,
        display_name="Veo",
        capabilities={},
        defaults={},
        environment=EnvironmentEnum.LOCAL,
    )
    result = MagicMock()
    result.scalar_one_or_none.return_value = model
    db_session_mock.execute.return_value = result
    found = await AiModelRepository(db_session_mock).get_by_key("veo")
    assert found == model


@pytest.mark.asyncio
async def test_provider_job_repository_get_by_provider_job_id(db_session_mock):
    job = ProviderJobModel(
        id=1,
        media_item_id=1,
        provider_id=1,
        model_id=1,
        provider_job_id="job-1",
        status=JobStatusEnum.PROCESSING,
        request_metadata={},
        provider_metrics={},
    )
    result = MagicMock()
    result.scalar_one_or_none.return_value = job
    db_session_mock.execute.return_value = result
    found = await ProviderJobRepository(db_session_mock).get_by_provider_job_id(
        "job-1"
    )
    assert found == job
