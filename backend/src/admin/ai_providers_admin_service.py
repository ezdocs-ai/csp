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
"""Admin service for AI provider registry management."""

from fastapi import Depends, HTTPException, status

from src.admin.dto.ai_provider_admin_dto import (
    AiProviderAdminResponseDto,
    AiProviderUpdateDto,
    ProviderTestResultDto,
)
from src.admin.repository.ai_provider_admin_repository import (
    AiProviderAdminRepository,
)
from src.ai_providers.constants import ProviderTypeEnum
from src.ai_providers.dto.ai_provider_dto import AiProviderCreateDto
from src.ai_providers.schema.ai_provider_model import AiProviderModel


class AiProvidersAdminService:
    """Coordinates AI provider administration."""

    def __init__(self, provider_repo: AiProviderAdminRepository = Depends()):
        self.provider_repo = provider_repo

    @staticmethod
    def _response(provider: AiProviderModel) -> AiProviderAdminResponseDto:
        return AiProviderAdminResponseDto(
            id=provider.id,
            key=provider.key,
            display_name=provider.display_name,
            provider_type=provider.provider_type,
            enabled=provider.enabled,
            base_url=provider.base_url,
            timeout_seconds=provider.timeout_seconds,
            has_secret=bool(provider.secret_ref),
        )

    @staticmethod
    def _validate_provider_type(provider_type: str | ProviderTypeEnum) -> None:
        try:
            ProviderTypeEnum(provider_type)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid provider_type.",
            ) from exc

    async def list_providers(self) -> list[AiProviderAdminResponseDto]:
        providers = await self.provider_repo.list_all()
        return [self._response(provider) for provider in providers]

    async def get_provider(
        self, provider_id: int
    ) -> AiProviderAdminResponseDto:
        provider = await self.provider_repo.get_by_id(provider_id)
        if not provider:
            raise HTTPException(status_code=404, detail="Provider not found.")
        return self._response(provider)

    async def create_provider(
        self, create_dto: AiProviderCreateDto
    ) -> AiProviderAdminResponseDto:
        self._validate_provider_type(create_dto.provider_type)
        # ponytail: reject private/loopback base_url literals with Replicate adapter.
        providers = await self.provider_repo.list_all()
        if any(provider.key == create_dto.key for provider in providers):
            raise HTTPException(
                status_code=400, detail="Provider key already exists."
            )
        return self._response(await self.provider_repo.create(create_dto))

    async def update_provider(
        self, provider_id: int, update_dto: AiProviderUpdateDto
    ) -> AiProviderAdminResponseDto:
        values = update_dto.model_dump(exclude_unset=True)
        if "provider_type" in values:
            self._validate_provider_type(values["provider_type"])
        if values.get("secret_ref") == "":
            values["secret_ref"] = None
        # ponytail: reject private/loopback base_url literals with Replicate adapter.
        provider = await self.provider_repo.update(provider_id, values)
        if not provider:
            raise HTTPException(status_code=404, detail="Provider not found.")
        return self._response(provider)

    async def delete_provider(self, provider_id: int) -> None:
        if not await self.provider_repo.get_by_id(provider_id):
            raise HTTPException(status_code=404, detail="Provider not found.")
        if await self.provider_repo.count_models_for_provider(provider_id):
            raise HTTPException(
                status_code=409,
                detail="Cannot delete provider with active models.",
            )
        await self.provider_repo.delete(provider_id)

    async def test_provider(self, provider_id: int) -> ProviderTestResultDto:
        provider = await self.provider_repo.get_by_id(provider_id)
        if not provider:
            raise HTTPException(status_code=404, detail="Provider not found.")
        # ponytail: add provider adapter connection tests without live calls in CRUD.
        return ProviderTestResultDto(
            success=False,
            message=(
                "Connection test not implemented for provider type "
                f"'{provider.provider_type}'."
            ),
        )
