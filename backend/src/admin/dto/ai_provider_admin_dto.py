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
"""Admin DTOs for AI provider registry management."""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from src.ai_providers.constants import (
    EnvironmentEnum,
    MediaTypeEnum,
    ProviderTypeEnum,
)
from src.ai_providers.dto.ai_provider_dto import (
    CostMetadataDto,
    ModelDefaultsDto,
    VideoCapabilitiesDto,
)


class AdminAiProviderDto(BaseModel):
    """Shared Pydantic configuration for admin provider DTOs."""

    model_config = ConfigDict(
        use_enum_values=True,
        populate_by_name=True,
        from_attributes=True,
        alias_generator=to_camel,
    )


class AiProviderAdminResponseDto(AdminAiProviderDto):
    """Redacted AI provider response for administrators."""

    id: int
    key: str
    display_name: str
    provider_type: ProviderTypeEnum
    enabled: bool
    base_url: str | None = None
    timeout_seconds: int
    has_secret: bool
    # ponytail: add Secret Manager version lookup when secret plumbing exists.
    secret_version: str | None = None


class AiProviderUpdateDto(AdminAiProviderDto):
    """Partial AI provider update request."""

    key: str | None = None
    display_name: str | None = None
    provider_type: str | None = None
    enabled: bool | None = None
    secret_ref: str | None = None
    base_url: str | None = None
    timeout_seconds: int | None = None


class AiModelAdminResponseDto(AdminAiProviderDto):
    """AI model response for administrators."""

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


class AiModelCreateDto(AdminAiProviderDto):
    """AI model create request."""

    key: str
    provider_id: int
    vendor_model_id: str
    media_type: str
    display_name: str
    enabled: bool = True
    capabilities: VideoCapabilitiesDto
    defaults: ModelDefaultsDto
    cost_metadata: CostMetadataDto | None = None
    environment: EnvironmentEnum
    priority: int = 100


class AiModelUpdateDto(AdminAiProviderDto):
    """Partial AI model update request."""

    key: str | None = None
    provider_id: int | None = None
    vendor_model_id: str | None = None
    media_type: str | None = None
    display_name: str | None = None
    enabled: bool | None = None
    capabilities: VideoCapabilitiesDto | None = None
    defaults: ModelDefaultsDto | None = None
    cost_metadata: CostMetadataDto | None = None
    environment: EnvironmentEnum | None = None
    priority: int | None = None


class ProviderTestResultDto(AdminAiProviderDto):
    """Provider connection test result."""

    success: bool
    message: str
