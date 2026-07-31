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
"""Admin AI model API tests."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from src.admin.ai_models_admin_service import AiModelsAdminService
from src.ai_providers.constants import (
    EnvironmentEnum,
    MediaTypeEnum,
    ProviderTypeEnum,
)
from src.admin.repository.ai_model_admin_repository import (
    AiModelAdminRepository,
)
from src.ai_providers.schema.ai_model_model import AiModelModel
from src.ai_providers.schema.ai_provider_model import AiProviderModel
from main import app


@pytest.fixture(name="model_repo")
def fixture_model_repo():
    """Provides a mocked model repository."""
    return AsyncMock()


@pytest.fixture(name="model_provider_repo")
def fixture_model_provider_repo():
    """Provides a mocked provider repository."""
    return AsyncMock()


@pytest.fixture(name="model_client")
def fixture_model_client(admin_client, model_repo, model_provider_repo):
    """Overrides model service dependency."""
    app.dependency_overrides[AiModelsAdminService] = (
        lambda: AiModelsAdminService(model_repo, model_provider_repo)
    )
    yield admin_client
    app.dependency_overrides.pop(AiModelsAdminService, None)


def model() -> AiModelModel:
    """Builds a model fixture."""
    return AiModelModel(
        id=1,
        key="veo",
        provider_id=1,
        vendor_model_id="veo-3",
        media_type=MediaTypeEnum.VIDEO,
        display_name="Veo",
        capabilities={},
        defaults={},
        environment=EnvironmentEnum.LOCAL,
    )


def provider() -> AiProviderModel:
    """Builds a provider fixture."""
    return AiProviderModel(
        id=1,
        key="google",
        display_name="Google",
        provider_type=ProviderTypeEnum.GOOGLE_VEAN,
    )


def create_body(media_type: str = "VIDEO") -> dict:
    """Builds a model create payload."""
    return {
        "key": "veo",
        "providerId": 1,
        "vendorModelId": "veo-3",
        "mediaType": media_type,
        "displayName": "Veo",
        "capabilities": {},
        "defaults": {},
        "environment": "LOCAL",
    }


def test_list_models_filtered(model_client, model_repo):
    model_repo.list_for_provider.return_value = [model()]

    response = model_client.get("/api/admin/ai-models?provider_id=1")

    assert response.status_code == 200
    assert response.json()[0]["providerId"] == 1
    model_repo.list_for_provider.assert_awaited_once_with(1)


def test_get_model_missing(model_client, model_repo):
    model_repo.get_by_id.return_value = None

    response = model_client.get("/api/admin/ai-models/99")

    assert response.status_code == 404


def test_get_model(model_client, model_repo):
    model_repo.get_by_id.return_value = model()

    response = model_client.get("/api/admin/ai-models/1")

    assert response.status_code == 200
    assert response.json()["key"] == "veo"


def test_create_model_duplicate_key(
    model_client, model_repo, model_provider_repo
):
    model_provider_repo.get_by_id.return_value = provider()
    model_repo.list_for_provider.return_value = [model()]

    response = model_client.post("/api/admin/ai-models", json=create_body())

    assert response.status_code == 400


def test_create_model_bad_provider(model_client, model_provider_repo):
    model_provider_repo.get_by_id.return_value = None

    response = model_client.post("/api/admin/ai-models", json=create_body())

    assert response.status_code == 400


def test_create_model_bad_media_type(model_client):
    response = model_client.post(
        "/api/admin/ai-models", json=create_body("UNKNOWN")
    )

    assert response.status_code == 400


def test_update_model_bad_media_type(model_client):
    response = model_client.patch(
        "/api/admin/ai-models/1", json={"mediaType": "UNKNOWN"}
    )

    assert response.status_code == 400


def test_update_model_bad_provider(model_client, model_provider_repo):
    model_provider_repo.get_by_id.return_value = None

    response = model_client.patch(
        "/api/admin/ai-models/1", json={"providerId": 99}
    )

    assert response.status_code == 400


def test_update_model_missing(model_client, model_repo):
    model_repo.update.return_value = None

    response = model_client.patch(
        "/api/admin/ai-models/99", json={"enabled": False}
    )

    assert response.status_code == 404


def test_update_model_partial(model_client, model_repo):
    updated = model()
    updated.display_name = "Veo Fast"
    model_repo.update.return_value = updated

    response = model_client.patch(
        "/api/admin/ai-models/1", json={"displayName": "Veo Fast"}
    )

    assert response.status_code == 200
    assert response.json()["displayName"] == "Veo Fast"


@pytest.mark.asyncio
async def test_model_repository_list_for_provider():
    db = AsyncMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = []
    db.execute.return_value = result
    repo = AiModelAdminRepository(db)

    assert await repo.list_for_provider(None) == []
    assert await repo.list_for_provider(1) == []


def test_delete_model_missing(model_client, model_repo):
    model_repo.delete.return_value = False

    response = model_client.delete("/api/admin/ai-models/99")

    assert response.status_code == 404
