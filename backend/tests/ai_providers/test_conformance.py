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
"""Conformance tests required for every video provider adapter."""

import pytest

from src.ai_providers.adapters.veo_adapter import VeoAdapter
from src.ai_providers.constants import ProviderTypeEnum
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
from src.common.schema.media_item_model import JobStatusEnum


class FakeAdapter:
    """Complete deterministic adapter used to enforce contract boundaries."""

    def capabilities(self, model: ModelConfig) -> VideoCapabilities:
        return model.capabilities

    async def submit(
        self, request: VideoGenerationRequest, model: ModelConfig
    ) -> ProviderJob:
        del request, model
        return ProviderJob(
            provider_job_id="fake-provider-job-1",
            status=JobStatusEnum.PROCESSING,
        )

    async def status(self, provider_job_id: str) -> ProviderJobStatus:
        return ProviderJobStatus(
            provider_job_id=provider_job_id,
            status=JobStatusEnum.COMPLETED,
        )

    async def cancel(self, provider_job_id: str) -> None:
        del provider_job_id

    async def collect(self, job: ProviderJob) -> list[ProviderOutput]:
        del job
        return [ProviderOutput(uri="gs://fake-bucket/result.mp4")]


@pytest.fixture(name="model_config")
def fixture_model_config() -> ModelConfig:
    """Provides enabled-model configuration for adapter calls."""
    return ModelConfig(
        key="fake-video",
        provider_key="fake-provider",
        provider_type=ProviderTypeEnum.GOOGLE_VEAN,
        vendor_model_id="fake-video-v1",
        capabilities=VideoCapabilities(durations=[8], resolutions=["1080p"]),
    )


@pytest.fixture(name="generation_request")
def fixture_generation_request() -> VideoGenerationRequest:
    """Provides credential-free provider-neutral request."""
    return VideoGenerationRequest(prompt="A credential-free fake prompt")


@pytest.fixture(name="adapter")
def fixture_adapter() -> FakeAdapter:
    """Provides complete fake adapter."""
    return FakeAdapter()


def test_fake_adapter_implements_every_protocol_method(adapter):
    for method_name in (
        "capabilities",
        "submit",
        "status",
        "cancel",
        "collect",
    ):
        assert callable(getattr(adapter, method_name))
    assert isinstance(adapter, VideoProviderAdapter)


@pytest.mark.asyncio
async def test_submit_returns_provider_job(
    adapter, generation_request, model_config
):
    job = await adapter.submit(generation_request, model_config)
    assert isinstance(job, ProviderJob)
    assert job.provider_job_id
    assert job.status in JobStatusEnum


@pytest.mark.asyncio
async def test_status_returns_normalized_provider_status(adapter):
    status = await adapter.status("fake-provider-job-1")
    assert isinstance(status, ProviderJobStatus)
    assert status.status in JobStatusEnum


@pytest.mark.asyncio
async def test_cancel_fake_adapter_does_not_raise(adapter):
    await adapter.cancel("fake-provider-job-1")


@pytest.mark.asyncio
async def test_veo_cancel_remains_explicitly_unavailable():
    with pytest.raises(NotImplementedError, match="cancellation unavailable"):
        await VeoAdapter().cancel("veo-job-1")


@pytest.mark.asyncio
async def test_collect_returns_safe_media_outputs(adapter):
    outputs = await adapter.collect(
        ProviderJob(
            provider_job_id="fake-provider-job-1",
            status=JobStatusEnum.COMPLETED,
        )
    )
    assert isinstance(outputs, list)
    for output in outputs:
        assert isinstance(output, ProviderOutput)
        assert output.uri
        assert output.mime_type.startswith(("video/", "image/", "audio/"))


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (" COMPLETE ", JobStatusEnum.COMPLETED),
        ("error", JobStatusEnum.FAILED),
        ("CANCELED", JobStatusEnum.STOPPED),
        ("queued", JobStatusEnum.PROCESSING),
        ("", JobStatusEnum.PROCESSING),
    ],
)
def test_normalize_state_maps_synonyms_and_safe_fallbacks(raw, expected):
    assert normalize_state(raw) == expected


def test_model_config_capabilities_round_trip_as_json(model_config):
    serialized = model_config.model_dump(mode="json")
    restored = ModelConfig.model_validate(serialized)
    assert restored.capabilities == model_config.capabilities
    assert isinstance(serialized["capabilities"], dict)


@pytest.mark.asyncio
async def test_submit_does_not_leak_credentials(
    adapter, generation_request, model_config
):
    job = await adapter.submit(generation_request, model_config)
    sensitive_tokens = (
        "authorization",
        "x-api-key",
        "api_key",
        "token",
        "secret",
    )
    job_id = job.provider_job_id.lower()
    request_payload = generation_request.model_dump(mode="json")
    payload_text = str(request_payload).lower()
    assert not any(token in job_id for token in sensitive_tokens)
    assert not any(token in payload_text for token in sensitive_tokens)
