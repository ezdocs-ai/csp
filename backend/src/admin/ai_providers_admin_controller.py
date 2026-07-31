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
"""Admin API routes for AI provider and model registries."""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import ValidationError

from src.admin.ai_models_admin_service import AiModelsAdminService
from src.admin.ai_providers_admin_service import AiProvidersAdminService
from src.admin.dto.ai_provider_admin_dto import (
    AiModelAdminResponseDto,
    AiModelCreateDto,
    AiModelUpdateDto,
    AiProviderAdminResponseDto,
    AiProviderUpdateDto,
    ProviderTestResultDto,
)
from src.ai_providers.dto.ai_provider_dto import AiProviderCreateDto
from src.auth.auth_guard import RoleChecker
from src.users.user_model import UserRoleEnum

router = APIRouter(
    prefix="/api/admin",
    tags=["Admin AI Providers"],
    dependencies=[Depends(RoleChecker(allowed_roles=[UserRoleEnum.ADMIN]))],
)


@router.get("/ai-providers", response_model=list[AiProviderAdminResponseDto])
async def list_providers(service: AiProvidersAdminService = Depends()):
    """Lists all configured providers."""
    return await service.list_providers()


@router.get(
    "/ai-providers/{provider_id}", response_model=AiProviderAdminResponseDto
)
async def get_provider(
    provider_id: int, service: AiProvidersAdminService = Depends()
):
    """Gets one configured provider."""
    return await service.get_provider(provider_id)


@router.post(
    "/ai-providers",
    response_model=AiProviderAdminResponseDto,
    status_code=status.HTTP_201_CREATED,
)
async def create_provider(
    create_data: dict,
    service: AiProvidersAdminService = Depends(),
):
    """Creates a provider registry entry."""
    try:
        create_dto = AiProviderCreateDto.model_validate(create_data)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=exc.errors()) from exc
    return await service.create_provider(create_dto)


@router.patch(
    "/ai-providers/{provider_id}", response_model=AiProviderAdminResponseDto
)
async def update_provider(
    provider_id: int,
    update_dto: AiProviderUpdateDto,
    service: AiProvidersAdminService = Depends(),
):
    """Partially updates a provider registry entry."""
    return await service.update_provider(provider_id, update_dto)


@router.delete(
    "/ai-providers/{provider_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_provider(
    provider_id: int, service: AiProvidersAdminService = Depends()
) -> Response:
    """Deletes a provider without configured models."""
    await service.delete_provider(provider_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/ai-providers/{provider_id}/test", response_model=ProviderTestResultDto
)
async def test_provider(
    provider_id: int, service: AiProvidersAdminService = Depends()
):
    """Returns current provider connection test capability."""
    return await service.test_provider(provider_id)


@router.get("/ai-models", response_model=list[AiModelAdminResponseDto])
async def list_models(
    provider_id: int | None = None, service: AiModelsAdminService = Depends()
):
    """Lists configured models, optionally by provider."""
    return await service.list_models(provider_id)


@router.get("/ai-models/{model_id}", response_model=AiModelAdminResponseDto)
async def get_model(model_id: int, service: AiModelsAdminService = Depends()):
    """Gets one configured model."""
    return await service.get_model(model_id)


@router.post(
    "/ai-models",
    response_model=AiModelAdminResponseDto,
    status_code=status.HTTP_201_CREATED,
)
async def create_model(
    create_dto: AiModelCreateDto, service: AiModelsAdminService = Depends()
):
    """Creates a model registry entry."""
    return await service.create_model(create_dto)


@router.patch("/ai-models/{model_id}", response_model=AiModelAdminResponseDto)
async def update_model(
    model_id: int,
    update_dto: AiModelUpdateDto,
    service: AiModelsAdminService = Depends(),
):
    """Partially updates a model registry entry."""
    return await service.update_model(model_id, update_dto)


@router.delete("/ai-models/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_model(
    model_id: int, service: AiModelsAdminService = Depends()
) -> Response:
    """Deletes a model registry entry."""
    await service.delete_model(model_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
