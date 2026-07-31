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
"""ArkAdapter unit tests (httpx mocked; no network)."""

import logging
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from src.ai_providers.adapters.ark_adapter import ArkAdapter
from src.ai_providers.constants import ProviderTypeEnum
from src.ai_providers.contract import (
    ModelConfig,
    ProviderJob,
    VideoCapabilities,
    VideoGenerationRequest,
)
from src.common.schema.media_item_model import JobStatusEnum
from src.config.config_service import config_service

_ARK_KEY = "secret-key-DO-NOT-LEAK"
_ARK_BASE = "https://ark.example.com/api/v3"


class MockResponse:
    """Minimal httpx.Response stand-in for the adapter's call sites."""

    def __init__(
        self,
        status_code: int = 200,
        json_data: dict | None = None,
        content: bytes = b"",
    ) -> None:
        self.status_code = status_code
        self._json = json_data or {}
        self.content = content

    def json(self) -> dict:
        return self._json

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(
                "mock error",
                request=MagicMock(),
                response=self,
            )


@pytest.fixture(name="ark_config")
def fixture_ark_config(monkeypatch) -> None:
    """Injects fake Ark credentials into config_service (raising=False so
    the fixture stays green even before the parallel config_service change
    lands the real ARK_API_KEY/ARK_API_BASE_URL fields)."""
    monkeypatch.setattr(config_service, "ARK_API_KEY", _ARK_KEY, raising=False)
    monkeypatch.setattr(
        config_service, "ARK_API_BASE_URL", _ARK_BASE, raising=False
    )


@pytest.fixture(name="mock_client")
def fixture_mock_client(monkeypatch) -> MagicMock:
    """Replaces httpx.AsyncClient with a controllable async mock."""
    client = MagicMock()
    client.post = AsyncMock()
    client.get = AsyncMock()
    client.delete = AsyncMock()
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)
    monkeypatch.setattr(
        "src.ai_providers.adapters.ark_adapter.httpx.AsyncClient",
        MagicMock(return_value=client),
    )
    return client


@pytest.fixture(name="mock_gcs")
def fixture_mock_gcs() -> MagicMock:
    gcs = MagicMock()

    def fake_upload(content_bytes, destination_blob_name, mime_type):
        del content_bytes, mime_type
        return f"gs://bucket/{destination_blob_name}"

    gcs.upload_bytes_to_gcs.side_effect = fake_upload
    return gcs


@pytest.fixture(name="adapter")
def fixture_adapter(mock_gcs) -> ArkAdapter:
    return ArkAdapter(gcs_service=mock_gcs)


@pytest.fixture(name="model_config")
def fixture_model_config() -> ModelConfig:
    # provider_type is irrelevant to ArkAdapter; using GOOGLE_VEAN keeps
    # these tests decoupled from the parallel ProviderTypeEnum.ARK addition.
    return ModelConfig(
        key="ark-seedance",
        provider_key="byteplus",
        provider_type=ProviderTypeEnum.GOOGLE_VEAN,
        vendor_model_id="seedance-1-0-pro-250528",
        capabilities=VideoCapabilities(),
    )


# --- capabilities ---


def test_capabilities_reports_supported_controls(adapter, model_config):
    caps = adapter.capabilities(model_config)
    assert caps.text_to_video is True
    assert caps.image_to_video is True
    assert caps.reference_images is False
    assert caps.resolutions == ["480p", "720p", "1080p", "4k"]
    assert caps.aspect_ratios == [
        "16:9",
        "4:3",
        "1:1",
        "3:4",
        "9:16",
        "21:9",
    ]
    assert caps.durations == [5, 10]


# --- submit ---


@pytest.mark.asyncio
async def test_submit_returns_provider_job_and_maps_fields(
    adapter, mock_client, ark_config, model_config
):
    mock_client.post.return_value = MockResponse(200, {"id": "cgt-123"})
    request = VideoGenerationRequest(
        prompt="a cat playing piano",
        duration_seconds=5,
        aspect_ratio="16:9",
        resolution="720p",
    )

    job = await adapter.submit(request, model_config)

    assert job.provider_job_id == "cgt-123"
    assert job.status == JobStatusEnum.PROCESSING

    mock_client.post.assert_awaited_once()
    args, kwargs = mock_client.post.call_args
    body = kwargs["json"]
    assert body["model"] == "seedance-1-0-pro-250528"
    assert body["content"] == [{"type": "text", "text": "a cat playing piano"}]
    assert body["duration"] == 5
    assert body["ratio"] == "16:9"
    assert body["resolution"] == "720p"
    assert body["generate_audio"] is True
    assert body["watermark"] is False
    assert kwargs["headers"]["Authorization"] == f"Bearer {_ARK_KEY}"
    assert kwargs["headers"]["Content-Type"] == "application/json"
    assert args[0] == f"{_ARK_BASE}/contents/generations/tasks"


@pytest.mark.asyncio
async def test_submit_tags_first_frame_image_with_role(
    adapter, mock_client, ark_config, model_config
):
    mock_client.post.return_value = MockResponse(200, {"id": "cgt-1"})
    request = VideoGenerationRequest(
        prompt="animate this",
        input_image_uri="https://img.example.com/a.png",
    )

    await adapter.submit(request, model_config)

    body = mock_client.post.call_args.kwargs["json"]
    assert len(body["content"]) == 2
    assert body["content"][1] == {
        "type": "image_url",
        "image_url": {"url": "https://img.example.com/a.png"},
        "role": "first_frame",
    }


@pytest.mark.asyncio
async def test_submit_emits_first_and_last_frame_roles(
    adapter, mock_client, ark_config, model_config
):
    mock_client.post.return_value = MockResponse(200, {"id": "cgt-2"})
    request = VideoGenerationRequest(
        prompt="interpolate between the two frames",
        input_image_uri="https://img.example.com/first.png",
        last_frame_image_uri="https://img.example.com/last.png",
    )

    await adapter.submit(request, model_config)

    body = mock_client.post.call_args.kwargs["json"]
    assert len(body["content"]) == 3
    assert body["content"][1] == {
        "type": "image_url",
        "image_url": {"url": "https://img.example.com/first.png"},
        "role": "first_frame",
    }
    assert body["content"][2] == {
        "type": "image_url",
        "image_url": {"url": "https://img.example.com/last.png"},
        "role": "last_frame",
    }


@pytest.mark.asyncio
async def test_submit_error_surfaces_ark_code_and_message(
    adapter, mock_client, ark_config, model_config
):
    mock_client.post.return_value = MockResponse(
        404,
        {
            "error": {
                "code": "ModelNotOpen",
                "message": "model not activated",
            }
        },
    )
    with pytest.raises(RuntimeError, match="ModelNotOpen: model not activated"):
        await adapter.submit(VideoGenerationRequest(prompt="x"), model_config)


@pytest.mark.asyncio
async def test_submit_network_error_raises_sanitized_runtime_error(
    adapter, mock_client, ark_config, model_config
):
    mock_client.post.side_effect = httpx.ConnectError("boom")
    with pytest.raises(RuntimeError, match="network error"):
        await adapter.submit(VideoGenerationRequest(prompt="x"), model_config)


@pytest.mark.asyncio
async def test_submit_http_error_raises_runtime_error_without_body(
    adapter, mock_client, ark_config, model_config
):
    mock_client.post.return_value = MockResponse(500, {"detail": _ARK_KEY})
    with pytest.raises(RuntimeError, match="HTTP 500"):
        await adapter.submit(VideoGenerationRequest(prompt="x"), model_config)


@pytest.mark.asyncio
async def test_submit_missing_id_raises(
    adapter, mock_client, ark_config, model_config
):
    mock_client.post.return_value = MockResponse(200, {})
    with pytest.raises(RuntimeError, match="missing task id"):
        await adapter.submit(VideoGenerationRequest(prompt="x"), model_config)


# --- status ---


@pytest.mark.parametrize(
    ("ark_status", "expected"),
    [
        ("queued", JobStatusEnum.PROCESSING),
        ("running", JobStatusEnum.PROCESSING),
        ("succeeded", JobStatusEnum.COMPLETED),
        ("failed", JobStatusEnum.FAILED),
    ],
)
@pytest.mark.asyncio
async def test_status_maps_provider_states(
    adapter, mock_client, ark_config, ark_status, expected
):
    mock_client.get.return_value = MockResponse(
        200, {"id": "cgt-1", "status": ark_status}
    )

    result = await adapter.status("cgt-1")

    assert result.provider_job_id == "cgt-1"
    assert result.status == expected
    assert result.error_message is None or expected == JobStatusEnum.FAILED


@pytest.mark.asyncio
async def test_status_failed_includes_error_message(
    adapter, mock_client, ark_config
):
    mock_client.get.return_value = MockResponse(
        200,
        {
            "id": "cgt-1",
            "status": "failed",
            "error": {"code": "QUOTA", "message": "quota exceeded"},
        },
    )

    result = await adapter.status("cgt-1")

    assert result.status == JobStatusEnum.FAILED
    assert result.error_message == "quota exceeded"


@pytest.mark.asyncio
async def test_status_network_error_raises_sanitized_runtime_error(
    adapter, mock_client, ark_config
):
    mock_client.get.side_effect = httpx.ReadTimeout("slow")
    with pytest.raises(RuntimeError, match="network error"):
        await adapter.status("cgt-1")


# --- cancel ---


@pytest.mark.asyncio
async def test_cancel_calls_delete_with_correct_url_and_headers(
    adapter, mock_client, ark_config
):
    mock_client.delete.return_value = MockResponse(200)

    await adapter.cancel("cgt-1")

    mock_client.delete.assert_awaited_once()
    args, kwargs = mock_client.delete.call_args
    assert args[0] == f"{_ARK_BASE}/contents/generations/tasks/cgt-1"
    assert kwargs["headers"]["Authorization"] == f"Bearer {_ARK_KEY}"


@pytest.mark.asyncio
async def test_cancel_swallows_already_deleted(
    adapter, mock_client, ark_config
):
    mock_client.delete.return_value = MockResponse(404)
    await adapter.cancel("cgt-1")  # must not raise


@pytest.mark.asyncio
async def test_cancel_swallows_network_error(adapter, mock_client, ark_config):
    mock_client.delete.side_effect = httpx.ConnectError("boom")
    await adapter.cancel("cgt-1")  # must not raise


# --- collect ---


@pytest.mark.asyncio
async def test_collect_downloads_video_and_uploads_to_gcs(
    adapter, mock_gcs, mock_client, ark_config
):
    video_bytes = b"\x00\x00\x00 mp4 data"
    mock_client.get.side_effect = [
        MockResponse(
            200,
            {"content": {"video_url": "https://cdn.example.com/v.mp4"}},
        ),
        MockResponse(200, {}, content=video_bytes),
    ]

    outputs = await adapter.collect(
        ProviderJob(
            provider_job_id="cgt-1",
            status=JobStatusEnum.COMPLETED,
        )
    )

    assert len(outputs) == 1
    assert outputs[0].uri == "gs://bucket/videos/ark/cgt-1.mp4"
    assert outputs[0].mime_type == "video/mp4"
    mock_gcs.upload_bytes_to_gcs.assert_called_once_with(
        video_bytes, "videos/ark/cgt-1.mp4", "video/mp4"
    )
    assert mock_client.get.await_count == 2
    # Second GET (download) has no auth header.
    second_args, _ = mock_client.get.call_args_list[1]
    assert second_args[0] == "https://cdn.example.com/v.mp4"


@pytest.mark.asyncio
async def test_collect_raises_when_video_url_missing(
    adapter, mock_client, ark_config
):
    mock_client.get.return_value = MockResponse(200, {"content": {}})
    with pytest.raises(RuntimeError, match="no"):
        await adapter.collect(
            ProviderJob(
                provider_job_id="cgt-1",
                status=JobStatusEnum.COMPLETED,
            )
        )


@pytest.mark.asyncio
async def test_collect_raises_when_gcs_upload_returns_none(
    adapter, mock_gcs, mock_client, ark_config
):
    mock_gcs.upload_bytes_to_gcs.side_effect = None
    mock_gcs.upload_bytes_to_gcs.return_value = None
    mock_client.get.side_effect = [
        MockResponse(
            200,
            {"content": {"video_url": "https://cdn.example.com/v.mp4"}},
        ),
        MockResponse(200, {}, content=b"data"),
    ]
    with pytest.raises(RuntimeError, match="GCS upload failed"):
        await adapter.collect(
            ProviderJob(
                provider_job_id="cgt-1",
                status=JobStatusEnum.COMPLETED,
            )
        )


# --- secret redaction ---


@pytest.mark.asyncio
async def test_api_key_never_appears_in_logs_or_exception(
    adapter, mock_client, ark_config, model_config, caplog
):
    caplog.set_level(logging.ERROR)
    # Body deliberately embeds the key to prove the adapter does not echo it.
    mock_client.post.return_value = MockResponse(500, {"detail": _ARK_KEY})

    with pytest.raises(RuntimeError) as exc:
        await adapter.submit(VideoGenerationRequest(prompt="x"), model_config)

    assert _ARK_KEY not in str(exc.value)
    for record in caplog.records:
        assert _ARK_KEY not in record.getMessage()
