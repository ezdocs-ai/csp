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
"""Public video generation capability DTOs."""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from src.ai_providers.constants import EnvironmentEnum, ProviderTypeEnum
from src.ai_providers.dto.ai_provider_dto import (
    ModelDefaultsDto,
    VideoCapabilitiesDto,
)


class VideoGenerationOptionsDto(BaseModel):
    """Shared Pydantic configuration for video generation options."""

    model_config = ConfigDict(
        use_enum_values=True,
        populate_by_name=True,
        from_attributes=True,
        alias_generator=to_camel,
    )


class VideoModelOption(VideoGenerationOptionsDto):
    """Public video model capability metadata."""

    model_key: str
    display_name: str
    vendor_model_id: str
    provider_key: str
    provider_type: ProviderTypeEnum
    environment: EnvironmentEnum
    priority: int
    capabilities: VideoCapabilitiesDto
    defaults: ModelDefaultsDto


class VideoGenerationOptionsResponse(VideoGenerationOptionsDto):
    """Video generation models available to public clients."""

    default_model_key: str | None
    models: list[VideoModelOption]
