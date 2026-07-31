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
"""Stable provider adapter contract and shared generation values."""

from typing import Protocol, runtime_checkable

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from src.ai_providers.constants import ProviderTypeEnum
from src.common.schema.media_item_model import JobStatusEnum


class ContractModel(BaseModel):
    """Shared provider contract model configuration."""

    model_config = ConfigDict(
        use_enum_values=True,
        populate_by_name=True,
        from_attributes=True,
        alias_generator=to_camel,
    )


class VideoCapabilities(ContractModel):
    """Video controls supported by a provider model."""

    text_to_video: bool = True
    image_to_video: bool = False
    # Multi-reference "ingredients" input; distinct from first/last frame.
    reference_images: bool = False
    durations: list[int] = []
    aspect_ratios: list[str] = []
    resolutions: list[str] = []
    max_outputs: int = 1


class VideoGenerationRequest(ContractModel):
    """Provider-neutral video request with no credentials."""

    prompt: str
    duration_seconds: int | None = None
    aspect_ratio: str | None = None
    resolution: str | None = None
    input_image_uri: str | None = None
    last_frame_image_uri: str | None = None


class ModelConfig(ContractModel):
    """Resolved enabled model configuration."""

    key: str
    provider_key: str
    provider_type: ProviderTypeEnum
    vendor_model_id: str
    capabilities: VideoCapabilities


class ProviderJob(ContractModel):
    """Provider job state without sensitive request data."""

    provider_job_id: str
    status: JobStatusEnum


class ProviderJobStatus(ContractModel):
    """Normalized provider job status."""

    provider_job_id: str
    status: JobStatusEnum
    error_message: str | None = None


class ProviderOutput(ContractModel):
    """Provider output URI and media metadata."""

    uri: str
    mime_type: str = "video/mp4"


def normalize_state(raw: str) -> JobStatusEnum:
    """Maps provider-specific states into MediaItem lifecycle states."""
    value = raw.strip().lower()
    if value in {"completed", "complete", "succeeded", "success", "done"}:
        return JobStatusEnum.COMPLETED
    if value in {"failed", "error", "rejected", "expired"}:
        return JobStatusEnum.FAILED
    if value in {"stopped", "cancelled", "canceled", "canceling"}:
        return JobStatusEnum.STOPPED
    return JobStatusEnum.PROCESSING


@runtime_checkable
class VideoProviderAdapter(Protocol):
    """Runtime-checkable contract for video provider adapters."""

    def capabilities(self, model: ModelConfig) -> VideoCapabilities:
        """Returns provider model capabilities."""

    async def submit(
        self, request: VideoGenerationRequest, model: ModelConfig
    ) -> ProviderJob:
        """Submits a generation request."""

    async def status(self, provider_job_id: str) -> ProviderJobStatus:
        """Returns normalized provider job status."""

    async def cancel(self, provider_job_id: str) -> None:
        """Cancels a provider job."""

    async def collect(self, job: ProviderJob) -> list[ProviderOutput]:
        """Collects completed provider outputs."""
