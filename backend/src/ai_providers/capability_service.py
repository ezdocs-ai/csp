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
"""Public capability lookup service."""

from fastapi import Depends

from src.ai_providers.constants import MediaTypeEnum
from src.ai_providers.repository.ai_model_repository import AiModelRepository
from src.ai_providers.repository.ai_provider_repository import (
    AiProviderRepository,
)
from src.generation_options.dto.video_generation_options_dto import (
    VideoGenerationOptionsResponse,
    VideoModelOption,
)


class CapabilityService:
    """Builds public capability responses from provider registry records."""

    def __init__(
        self,
        model_repo: AiModelRepository = Depends(),
        provider_repo: AiProviderRepository = Depends(),
    ):
        self.model_repo = model_repo
        self.provider_repo = provider_repo

    async def get_video_options(self) -> VideoGenerationOptionsResponse:
        """Returns enabled video models whose providers are also enabled."""
        (
            models,
            providers,
        ) = await self.model_repo.find_all(), await (
            self.provider_repo.find_all()
        )
        providers_by_id = {provider.id: provider for provider in providers}
        options = [
            VideoModelOption(
                model_key=model.key,
                display_name=model.display_name,
                vendor_model_id=model.vendor_model_id,
                provider_key=provider.key,
                provider_type=provider.provider_type,
                environment=model.environment,
                priority=model.priority,
                capabilities=model.capabilities,
                defaults=model.defaults,
            )
            for model in models
            if model.media_type == MediaTypeEnum.VIDEO
            and model.enabled
            and (provider := providers_by_id.get(model.provider_id))
            and provider.enabled
        ]
        options.sort(key=lambda option: (option.priority, option.display_name))
        return VideoGenerationOptionsResponse(
            default_model_key=options[0].model_key if options else None,
            models=options,
        )
