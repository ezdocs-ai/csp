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
"""Admin service for AI model registry management."""

from fastapi import Depends, HTTPException, status

from src.admin.dto.ai_provider_admin_dto import (
    AiModelAdminResponseDto,
    AiModelCreateDto,
    AiModelUpdateDto,
)
from src.admin.repository.ai_model_admin_repository import (
    AiModelAdminRepository,
)
from src.admin.repository.ai_provider_admin_repository import (
    AiProviderAdminRepository,
)
from src.ai_providers.constants import MediaTypeEnum
from src.ai_providers.schema.ai_model_model import AiModelModel


class AiModelsAdminService:
    """Coordinates AI model administration."""

    def __init__(
        self,
        model_repo: AiModelAdminRepository = Depends(),
        provider_repo: AiProviderAdminRepository = Depends(),
    ):
        self.model_repo = model_repo
        self.provider_repo = provider_repo

    @staticmethod
    def _response(model: AiModelModel) -> AiModelAdminResponseDto:
        return AiModelAdminResponseDto.model_validate(model)

    @staticmethod
    def _validate_media_type(media_type: str | MediaTypeEnum) -> None:
        try:
            MediaTypeEnum(media_type)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid media_type.",
            ) from exc

    async def list_models(
        self, provider_id: int | None
    ) -> list[AiModelAdminResponseDto]:
        models = await self.model_repo.list_for_provider(provider_id)
        return [self._response(model) for model in models]

    async def get_model(self, model_id: int) -> AiModelAdminResponseDto:
        model = await self.model_repo.get_by_id(model_id)
        if not model:
            raise HTTPException(status_code=404, detail="AI model not found.")
        return self._response(model)

    async def create_model(
        self, create_dto: AiModelCreateDto
    ) -> AiModelAdminResponseDto:
        self._validate_media_type(create_dto.media_type)
        if not await self.provider_repo.get_by_id(create_dto.provider_id):
            raise HTTPException(
                status_code=400, detail="Provider does not exist."
            )
        models = await self.model_repo.list_for_provider(None)
        if any(model.key == create_dto.key for model in models):
            raise HTTPException(
                status_code=400, detail="AI model key already exists."
            )
        return self._response(await self.model_repo.create(create_dto))

    async def update_model(
        self, model_id: int, update_dto: AiModelUpdateDto
    ) -> AiModelAdminResponseDto:
        values = update_dto.model_dump(exclude_unset=True)
        if "media_type" in values:
            self._validate_media_type(values["media_type"])
        if "provider_id" in values and not await self.provider_repo.get_by_id(
            values["provider_id"]
        ):
            raise HTTPException(
                status_code=400, detail="Provider does not exist."
            )
        model = await self.model_repo.update(model_id, values)
        if not model:
            raise HTTPException(status_code=404, detail="AI model not found.")
        return self._response(model)

    async def delete_model(self, model_id: int) -> None:
        if not await self.model_repo.delete(model_id):
            raise HTTPException(status_code=404, detail="AI model not found.")
