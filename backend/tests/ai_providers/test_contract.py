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
"""Provider adapter contract tests."""

import pytest

from src.ai_providers.adapters.veo_adapter import VeoAdapter
from src.ai_providers.contract import (
    ModelConfig,
    ProviderJob,
    ProviderJobStatus,
    ProviderOutput,
    VideoCapabilities,
    VideoGenerationRequest,
    VideoProviderAdapter,
    normalize_state,
)
from src.ai_providers.constants import ProviderTypeEnum
from src.common.schema.media_item_model import JobStatusEnum


class FakeAdapter:
    """Minimal contract implementation."""

    def capabilities(self, model: ModelConfig) -> VideoCapabilities:
        return model.capabilities

    async def submit(
        self, request: VideoGenerationRequest, model: ModelConfig
    ) -> ProviderJob:
        return ProviderJob(
            provider_job_id="job", status=JobStatusEnum.PROCESSING
        )

    async def status(self, provider_job_id: str) -> ProviderJobStatus:
        return ProviderJobStatus(
            provider_job_id=provider_job_id, status=JobStatusEnum.COMPLETED
        )

    async def cancel(self, provider_job_id: str) -> None:
        return None

    async def collect(self, job: ProviderJob) -> list[ProviderOutput]:
        return [ProviderOutput(uri="gs://bucket/video.mp4")]


def test_fake_adapter_satisfies_protocol():
    assert isinstance(FakeAdapter(), VideoProviderAdapter)


def test_veo_adapter_satisfies_protocol():
    assert isinstance(VeoAdapter(), VideoProviderAdapter)


@pytest.mark.asyncio
async def test_veo_adapter_legacy_boundaries():
    adapter = VeoAdapter()
    model = ModelConfig(
        key="veo",
        provider_key="google_veo",
        provider_type=ProviderTypeEnum.GOOGLE_VEAN,
        vendor_model_id="veo",
        capabilities=VideoCapabilities(durations=[8]),
    )
    assert adapter.capabilities(model).durations == [8]
    assert (await adapter.status("job")).status == JobStatusEnum.PROCESSING
    assert (
        await adapter.collect(
            ProviderJob(provider_job_id="job", status=JobStatusEnum.COMPLETED)
        )
        == []
    )
    with pytest.raises(NotImplementedError, match="cancellation unavailable"):
        await adapter.cancel("job")
    with pytest.raises(NotImplementedError, match="needs legacy request"):
        await adapter.submit(VideoGenerationRequest(prompt="video"), model)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("succeeded", JobStatusEnum.COMPLETED),
        ("FAILED", JobStatusEnum.FAILED),
        ("cancelled", JobStatusEnum.STOPPED),
        ("unknown", JobStatusEnum.PROCESSING),
        ("", JobStatusEnum.PROCESSING),
    ],
)
def test_normalize_state(raw, expected):
    assert normalize_state(raw) == expected
