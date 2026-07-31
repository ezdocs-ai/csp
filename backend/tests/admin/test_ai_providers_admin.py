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
"""Admin AI provider API tests."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from src.admin.ai_providers_admin_service import AiProvidersAdminService
from src.admin.repository.ai_provider_admin_repository import (
    AiProviderAdminRepository,
)
from src.ai_providers.constants import ProviderTypeEnum
from src.ai_providers.schema.ai_provider_model import AiProviderModel
from main import app


@pytest.fixture(name="provider_repo")
def fixture_provider_repo():
    """Provides a mocked provider repository."""
    return AsyncMock()


@pytest.fixture(name="provider_client")
def fixture_provider_client(admin_client, provider_repo):
    """Overrides provider service dependency."""
    app.dependency_overrides[AiProvidersAdminService] = (
        lambda: AiProvidersAdminService(provider_repo)
    )
    yield admin_client
    app.dependency_overrides.pop(AiProvidersAdminService, None)


def provider(secret_ref: str | None = "secret") -> AiProviderModel:
    """Builds a provider fixture."""
    return AiProviderModel(
        id=1,
        key="replicate",
        display_name="Replicate",
        provider_type=ProviderTypeEnum.REPLICATE,
        secret_ref=secret_ref,
    )


def create_body(provider_type: str = "REPLICATE") -> dict:
    """Builds a provider create payload."""
    return {
        "key": "replicate",
        "displayName": "Replicate",
        "providerType": provider_type,
    }


@pytest.mark.asyncio
async def test_provider_repository_list_and_count():
    db = AsyncMock()
    list_result = MagicMock()
    list_result.scalars.return_value.all.return_value = []
    count_result = MagicMock()
    count_result.scalar_one.return_value = 0
    db.execute.side_effect = [list_result, count_result]
    repo = AiProviderAdminRepository(db)

    assert await repo.list_all() == []
    assert await repo.count_models_for_provider(1) == 0


def test_list_providers(provider_client, provider_repo):
    provider_repo.list_all.return_value = [provider()]

    response = provider_client.get("/api/admin/ai-providers")

    assert response.status_code == 200
    assert response.json()[0]["hasSecret"] is True
    assert "secretRef" not in response.json()[0]


def test_get_provider_missing(provider_client, provider_repo):
    provider_repo.get_by_id.return_value = None

    response = provider_client.get("/api/admin/ai-providers/99")

    assert response.status_code == 404


def test_get_provider(provider_client, provider_repo):
    provider_repo.get_by_id.return_value = provider()

    response = provider_client.get("/api/admin/ai-providers/1")

    assert response.status_code == 200
    assert response.json()["key"] == "replicate"


def test_create_provider_duplicate_key(provider_client, provider_repo):
    provider_repo.list_all.return_value = [provider()]

    response = provider_client.post(
        "/api/admin/ai-providers", json=create_body()
    )

    assert response.status_code == 400


def test_create_provider_bad_type(provider_client, provider_repo):
    response = provider_client.post(
        "/api/admin/ai-providers", json=create_body("UNKNOWN")
    )

    assert response.status_code == 400


def test_update_provider_bad_type(provider_client):
    response = provider_client.patch(
        "/api/admin/ai-providers/1", json={"providerType": "UNKNOWN"}
    )

    assert response.status_code == 400


def test_update_provider_redacts_secret(provider_client, provider_repo):
    provider_repo.update.return_value = provider("new-secret")

    response = provider_client.patch(
        "/api/admin/ai-providers/1", json={"secretRef": "new-secret"}
    )

    assert response.status_code == 200
    assert response.json()["hasSecret"] is True
    assert "secretRef" not in response.json()


def test_delete_provider_with_models(provider_client, provider_repo):
    provider_repo.get_by_id.return_value = provider()
    provider_repo.count_models_for_provider.return_value = 1

    response = provider_client.delete("/api/admin/ai-providers/1")

    assert response.status_code == 409
    assert (
        response.json()["detail"]
        == "Cannot delete provider with active models."
    )


def test_delete_provider_without_models(provider_client, provider_repo):
    provider_repo.get_by_id.return_value = provider()
    provider_repo.count_models_for_provider.return_value = 0
    provider_repo.delete.return_value = True

    response = provider_client.delete("/api/admin/ai-providers/1")

    assert response.status_code == 204


def test_delete_provider_missing(provider_client, provider_repo):
    provider_repo.get_by_id.return_value = None

    response = provider_client.delete("/api/admin/ai-providers/99")

    assert response.status_code == 404


def test_provider_test_missing(provider_client, provider_repo):
    provider_repo.get_by_id.return_value = None

    response = provider_client.post("/api/admin/ai-providers/99/test")

    assert response.status_code == 404


def test_provider_test_stub(provider_client, provider_repo):
    provider_repo.get_by_id.return_value = provider()

    response = provider_client.post("/api/admin/ai-providers/1/test")

    assert response.status_code == 200
    assert response.json() == {
        "success": False,
        "message": "Connection test not implemented for provider type 'REPLICATE'.",
    }
