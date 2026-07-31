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
"""Tests for public video generation capability options."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.ai_providers.capability_service import CapabilityService
from src.ai_providers.constants import (
    EnvironmentEnum,
    MediaTypeEnum,
    ProviderTypeEnum,
)
from src.ai_providers.schema.ai_model_model import AiModelModel
from src.ai_providers.schema.ai_provider_model import AiProviderModel
from src.generation_options.generation_options_controller import router


class FakeRepository:
    """In-memory registry repository."""

    def __init__(self, items):
        self.items = items

    async def find_all(self):
        return self.items


def provider(provider_id=1, enabled=True):
    """Builds a provider registry record."""
    return AiProviderModel(
        id=provider_id,
        key=f"provider-{provider_id}",
        display_name=f"Provider {provider_id}",
        provider_type=ProviderTypeEnum.GOOGLE_VEAN,
        enabled=enabled,
        secret_ref="secret-ref",
        base_url="https://internal.example",
    )


def model(
    key="veo",
    provider_id=1,
    enabled=True,
    priority=100,
    display_name="Veo",
):
    """Builds a video model registry record."""
    return AiModelModel(
        id=1,
        key=key,
        provider_id=provider_id,
        vendor_model_id=key,
        media_type=MediaTypeEnum.VIDEO,
        display_name=display_name,
        enabled=enabled,
        capabilities={
            "text_to_video": True,
            "image_to_video": True,
            "reference_images": True,
            "durations": [4, 6, 8],
            "aspect_ratios": ["16:9", "9:16"],
            # User-facing aliases matching CreateVeoDto.resolution.
            "resolutions": ["1K", "2K", "4K"],
            "max_outputs": 1,
        },
        defaults={
            "duration_seconds": 8,
            "aspect_ratio": "16:9",
            "resolution": "1K",
        },
        environment=EnvironmentEnum.PRODUCTION,
        priority=priority,
    )


def client(models=None, providers=None):
    """Builds public options client with in-memory registry records."""
    app = FastAPI()
    app.include_router(router)
    service = CapabilityService(
        model_repo=FakeRepository(models or []),
        provider_repo=FakeRepository(providers or []),
    )
    app.dependency_overrides[CapabilityService] = lambda: service
    return TestClient(app)


def test_video_options_empty_registry():
    response = client().get("/api/options/video-generation")
    assert response.status_code == 200
    assert response.json() == {"defaultModelKey": None, "models": []}


def test_video_options_returns_public_camel_case_shape():
    response = client([model()], [provider()]).get(
        "/api/options/video-generation"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["defaultModelKey"] == "veo"
    assert data["models"] == [
        {
            "modelKey": "veo",
            "displayName": "Veo",
            "vendorModelId": "veo",
            "providerKey": "provider-1",
            "providerType": "GOOGLE_VEAN",
            "environment": "PRODUCTION",
            "priority": 100,
            "capabilities": {
                "textToVideo": True,
                "imageToVideo": True,
                "referenceImages": True,
                "durations": [4, 6, 8],
                "aspectRatios": ["16:9", "9:16"],
                "resolutions": ["1K", "2K", "4K"],
                "maxOutputs": 1,
            },
            "defaults": {
                "durationSeconds": 8,
                "aspectRatio": "16:9",
                "resolution": "1K",
            },
        }
    ]
    assert "secret_ref" not in str(data)
    assert "base_url" not in str(data)
    assert "cost_metadata" not in str(data)


def test_video_options_excludes_disabled_model():
    response = client([model(enabled=False)], [provider()]).get(
        "/api/options/video-generation"
    )
    assert response.json() == {"defaultModelKey": None, "models": []}


def test_video_options_excludes_disabled_provider():
    response = client([model()], [provider(enabled=False)]).get(
        "/api/options/video-generation"
    )
    assert response.json() == {"defaultModelKey": None, "models": []}


def test_video_options_excludes_non_video_model():
    image_model = model()
    image_model.media_type = MediaTypeEnum.IMAGE
    response = client([image_model], [provider()]).get(
        "/api/options/video-generation"
    )
    assert response.json() == {"defaultModelKey": None, "models": []}


def test_video_options_sorts_by_priority_then_display_name():
    response = client(
        [
            model(key="second", priority=20, display_name="Zulu"),
            model(key="first", priority=10, display_name="Zulu"),
            model(key="tie", priority=10, display_name="Alpha"),
        ],
        [provider()],
    ).get("/api/options/video-generation")
    data = response.json()
    assert data["defaultModelKey"] == "tie"
    assert [item["modelKey"] for item in data["models"]] == [
        "tie",
        "first",
        "second",
    ]
