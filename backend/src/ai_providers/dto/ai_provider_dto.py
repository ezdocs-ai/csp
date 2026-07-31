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
"""Typed provider API DTOs."""

from typing import Any

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from src.ai_providers.constants import (
    EnvironmentEnum,
    MediaTypeEnum,
    ProviderTypeEnum,
)


class ProviderDto(BaseModel):
    """Shared Pydantic configuration for provider DTOs."""

    model_config = ConfigDict(
        use_enum_values=True,
        populate_by_name=True,
        from_attributes=True,
        alias_generator=to_camel,
    )


class VideoCapabilitiesDto(ProviderDto):
    """Supported video controls for a configured model."""

    text_to_video: bool = True
    image_to_video: bool = False
    # True means the model supports multi-reference "ingredients" input,
    # distinct from first/last-frame image-to-video.
    reference_images: bool = False
    durations: list[int] = []
    aspect_ratios: list[str] = []
    resolutions: list[str] = []
    max_outputs: int = 1


class ModelDefaultsDto(ProviderDto):
    """Default generation controls for a configured model."""

    duration_seconds: int | None = None
    aspect_ratio: str | None = None
    resolution: str | None = None


class CostMetadataDto(ProviderDto):
    """Optional model cost metadata."""

    currency: str | None = None
    per_second: float | None = None
    notes: str | None = None


class AiProviderCreateDto(ProviderDto):
    """Provider create request. secret_ref names a secret, never its value."""

    key: str
    display_name: str
    provider_type: ProviderTypeEnum
    enabled: bool = True
    secret_ref: str | None = None
    base_url: str | None = None
    timeout_seconds: int = 60


class AiProviderResponseDto(ProviderDto):
    """Redacted provider response."""

    id: int
    key: str
    display_name: str
    provider_type: ProviderTypeEnum
    enabled: bool
    base_url: str | None = None
    timeout_seconds: int


class AiModelResponseDto(ProviderDto):
    """Public model configuration response."""

    id: int
    key: str
    provider_id: int
    vendor_model_id: str
    media_type: MediaTypeEnum
    display_name: str
    enabled: bool
    capabilities: VideoCapabilitiesDto
    defaults: ModelDefaultsDto
    cost_metadata: CostMetadataDto | None = None
    environment: EnvironmentEnum
    priority: int


class ProviderJobResponseDto(ProviderDto):
    """Safe provider job response."""

    id: int
    media_item_id: int
    provider_id: int
    model_id: int
    provider_job_id: str
    status: str
    request_metadata: dict[str, Any]
    provider_metrics: dict[str, Any]
    error: dict[str, Any] | None = None
