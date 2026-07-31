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

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from httpx import Response

from src.common.schema.media_item_model import AssetRoleEnum
from src.workflows.schema.workflow_model import (
    ReferenceMediaOrAsset,
    StepOutputReference,
)
from src.workflows_executor.workflows_executor_service import (
    WorkflowsExecutorService,
)


@pytest.fixture(name="service")
def fixture_service():
    with (
        patch(
            "src.workflows_executor.workflows_executor_service.RestClient",
        ) as mock_rest_client_class,
        patch(
            "src.workflows_executor.workflows_executor_service.GenAIModelSetup.init",
        ) as mock_genai_init,
    ):
        mock_rest_client = AsyncMock()
        mock_rest_client_class.return_value = mock_rest_client

        mock_genai_client = MagicMock()
        mock_genai_init.return_value = mock_genai_client

        service = WorkflowsExecutorService()
        # Attach the mocks to the service object to allow assertion later
        service.mock_rest_client = mock_rest_client
        service.mock_genai_client = mock_genai_client
        yield service


def test_normalize_asset_inputs_single_int(service):
    media_items, asset_ids = service._normalize_asset_inputs(123)
    assert len(media_items) == 1
    assert media_items[0]["media_item_id"] == 123
    assert media_items[0]["role"] == AssetRoleEnum.INPUT.value
    assert len(asset_ids) == 0


def test_normalize_asset_inputs_list_mixed(service):
    mock_ref = ReferenceMediaOrAsset(
        previewUrl="",
        sourceMediaItem={"mediaItemId": 456, "mediaIndex": 1, "role": "OUTPUT"},
        sourceAssetId=None,
    )
    mock_asset_ref = ReferenceMediaOrAsset(
        previewUrl="",
        sourceMediaItem=None,
        sourceAssetId=789,
    )

    inputs = [123, mock_ref, mock_asset_ref]
    media_items, asset_ids = service._normalize_asset_inputs(inputs)

    assert len(media_items) == 2
    assert media_items[0]["media_item_id"] == 123
    assert media_items[1]["media_item_id"] == 456
    assert media_items[1]["role"] == "OUTPUT"

    assert len(asset_ids) == 1
    assert asset_ids[0] == 789


@pytest.mark.anyio
async def test_poll_job_status_success(service):
    # Mock rest_client.get to return completed immediately
    mock_response = Response(200, json={"status": "completed"})
    service.mock_rest_client.get.return_value = mock_response

    # Patch asyncio.sleep to speed up tests
    with patch("asyncio.sleep", AsyncMock()) as mock_sleep:
        result = await service._poll_job_status(123)
        assert result is True
        # Verify it was called once on target URL
        service.mock_rest_client.get.assert_called_once()


@pytest.mark.anyio
async def test_poll_job_status_timeout(service):
    # Mock rest_client.get to return running forever
    mock_response = Response(200, json={"status": "running"})
    service.mock_rest_client.get.return_value = mock_response

    # Speed up sleep to avoid 600s stall
    with (
        patch("asyncio.sleep", AsyncMock()),
        patch(
            "asyncio.get_event_loop",
        ) as mock_loop,
    ):
        mock_loop_instance = MagicMock()
        # Simulate time advancing 600s immediately to trigger timeout
        mock_loop_instance.time.side_effect = [0, 601]
        mock_loop.return_value = mock_loop_instance

        with pytest.raises(HTTPException) as exc:
            await service._poll_job_status(123)
        assert exc.value.status_code == 504


@pytest.mark.anyio
async def test_poll_job_status_failed(service):
    mock_response = Response(
        200,
        json={"status": "failed", "error_message": "Generation Error"},
    )
    service.mock_rest_client.get.return_value = mock_response

    with patch("asyncio.sleep", AsyncMock()):
        with pytest.raises(HTTPException) as exc:
            await service._poll_job_status(123)
        assert exc.value.status_code == 500
        assert "Generation Error" in exc.value.detail


@pytest.mark.anyio
async def test_resolve_media_to_parts_success(service):
    # Mock responses for gallery and source asset
    mock_gallery_response = Response(
        200,
        json={"gcsUris": ["gs://bucket/gallery.png"], "mimeType": "image/png"},
    )
    mock_source_asset_response = Response(
        200,
        json={"gcsUri": "gs://bucket/asset.jpg", "mimeType": "image/jpeg"},
    )
    service.mock_rest_client.get.side_effect = [
        mock_gallery_response,
        mock_source_asset_response,
    ]

    # Reference item
    mock_ref = ReferenceMediaOrAsset(
        previewUrl="",
        sourceMediaItem=None,
        sourceAssetId=456,
    )

    inputs = [123, mock_ref]

    with patch(
        "src.workflows_executor.workflows_executor_service.types.Part.from_uri",
    ) as mock_from_uri:
        # Mock Part objects
        mock_part1 = MagicMock()
        mock_part2 = MagicMock()
        mock_from_uri.side_effect = [mock_part1, mock_part2]

        parts = await service._resolve_media_to_parts(inputs)

        assert len(parts) == 2
        # Verify from_uri was called with correct values
        mock_from_uri.assert_any_call(
            file_uri="gs://bucket/gallery.png",
            mime_type="image/png",
        )
        mock_from_uri.assert_any_call(
            file_uri="gs://bucket/asset.jpg",
            mime_type="image/jpeg",
        )


@pytest.mark.anyio
async def test_generate_text_stream(service):
    # Create request mock DTO
    request = MagicMock()
    request.config.temperature = 0.7
    request.config.model = "gemini-1.5-pro"
    request.inputs.prompt = "Write a story"
    request.inputs.input_images = None
    request.inputs.input_videos = None

    # Mock chunk generators
    mock_chunk1 = MagicMock()
    mock_chunk1.text = "Hello "
    mock_chunk2 = MagicMock()
    mock_chunk2.text = "World!"

    # Mock stream method
    service.mock_genai_client.models.generate_content_stream.return_value = [
        mock_chunk1,
        mock_chunk2,
    ]

    result = await service.generate_text(request)

    assert result["generated_text"] == "Hello World!"
    # Verify client call
    service.mock_genai_client.models.generate_content_stream.assert_called_once()
    args, kwargs = (
        service.mock_genai_client.models.generate_content_stream.call_args
    )
    assert kwargs["model"] == "gemini-1.5-pro"
    # Prompt is wrapped as Part.from_text inside contents
    assert len(kwargs["contents"]) == 1


@pytest.mark.anyio
async def test_generate_image(service):
    request = MagicMock()
    request.workspace_id = 1
    request.inputs.prompt = "A cat"
    request.inputs.input_images = None
    request.config.model = "gemini-3.1-flash-image"
    request.config.aspect_ratio = "1:1"
    request.config.brand_guidelines = False

    service.mock_rest_client.post.return_value = Response(200, json={"id": 999})

    with patch.object(
        service,
        "_poll_job_status",
        AsyncMock(return_value=True),
    ) as mock_poll:
        result = await service.generate_image(request)
        assert result["generated_image"] == 999
        service.mock_rest_client.post.assert_called_once()
        posted_body = service.mock_rest_client.post.call_args.kwargs["json"]
        assert "source_media_items" not in posted_body
        assert "source_asset_ids" not in posted_body
        mock_poll.assert_called_once_with(999, None)


@pytest.mark.anyio
async def test_generate_image_with_ingredients_forwards_inputs(service):
    """Ingredients-to-Image: resolved inputs forwarded to provider endpoint."""
    request = MagicMock()
    request.workspace_id = 1
    request.inputs.prompt = "Combine ingredients"
    request.inputs.input_images = [123, 456]
    request.config.model = "gemini-3.1-flash-image"
    request.config.aspect_ratio = "1:1"
    request.config.brand_guidelines = False
    request.config.resolution = "1K"

    service.mock_rest_client.post.return_value = Response(200, json={"id": 999})

    normalized_media = [
        {"media_item_id": 123, "media_index": 0, "role": "INPUT"},
        {"media_item_id": 456, "media_index": 0, "role": "INPUT"},
    ]
    with (
        patch.object(
            service,
            "_normalize_asset_inputs",
            return_value=(normalized_media, []),
        ),
        patch.object(
            service,
            "_poll_job_status",
            AsyncMock(return_value=True),
        ),
    ):
        result = await service.generate_image(request)
        assert result["generated_image"] == 999

    posted_body = service.mock_rest_client.post.call_args.kwargs["json"]
    assert posted_body["source_media_items"] == normalized_media
    assert "source_asset_ids" not in posted_body
    # Ordered list preserved.
    assert [m["media_item_id"] for m in posted_body["source_media_items"]] == [
        123,
        456,
    ]


@pytest.mark.anyio
async def test_generate_image_capability_rejects_unsupported_model(service):
    """Non Gemini-image model with inputs rejected clearly at executor."""
    request = MagicMock()
    request.workspace_id = 1
    request.inputs.prompt = "x"
    request.inputs.input_images = [123]
    request.config.model = "imagen-4.0-generate-001"
    request.config.aspect_ratio = "1:1"
    request.config.brand_guidelines = False
    request.config.resolution = "1K"

    with patch.object(
        service,
        "_normalize_asset_inputs",
        return_value=([{"media_item_id": 123}], []),
    ):
        with pytest.raises(HTTPException) as exc:
            await service.generate_image(request)
        assert exc.value.status_code == 400
        assert "does not support" in exc.value.detail
    service.mock_rest_client.post.assert_not_called()


@pytest.mark.anyio
async def test_generate_image_capability_rejects_over_limit(service):
    """Inputs exceeding model max_total_inputs rejected clearly."""
    request = MagicMock()
    request.workspace_id = 1
    request.inputs.prompt = "x"
    # gemini-2.5-flash-image has max_total_inputs == 2.
    request.config.model = "gemini-2.5-flash-image"
    request.config.aspect_ratio = "1:1"
    request.config.brand_guidelines = False
    request.config.resolution = "1K"
    request.inputs.input_images = [1, 2, 3]

    normalized = [
        {"media_item_id": i, "media_index": 0, "role": "INPUT"}
        for i in (1, 2, 3)
    ]
    with patch.object(
        service,
        "_normalize_asset_inputs",
        return_value=(normalized, []),
    ):
        with pytest.raises(HTTPException) as exc:
            await service.generate_image(request)
        assert exc.value.status_code == 400
        assert "at most 2" in exc.value.detail
    service.mock_rest_client.post.assert_not_called()


def test_validate_image_input_capability_unknown_model(service):
    with pytest.raises(HTTPException) as exc:
        service._validate_image_input_capability("not-a-real-model", 1)
    assert exc.value.status_code == 400
    assert "Unknown image model" in exc.value.detail


def test_validate_image_input_capability_allows_supported_combo(service):
    # gemini-3.1-flash-image supports multi-image (max 14).
    service._validate_image_input_capability("gemini-3.1-flash-image", 10)
    # gemini-2.5-flash-image supports up to 2.
    service._validate_image_input_capability("gemini-2.5-flash-image", 2)


@pytest.mark.anyio
async def test_edit_image(service):
    request = MagicMock()
    request.workspace_id = 1
    request.inputs.prompt = "Add hat"
    request.inputs.input_images = [123]
    request.config.model = "gemini-3.1-flash-image"
    request.config.aspect_ratio = "1:1"
    request.config.brand_guidelines = False

    service.mock_rest_client.post.return_value = Response(200, json={"id": 888})

    with (
        patch.object(
            service,
            "_normalize_asset_inputs",
            return_value=([{"media_item_id": 123}], []),
        ),
        patch.object(
            service,
            "_poll_job_status",
            AsyncMock(return_value=True),
        ) as mock_poll,
    ):
        result = await service.edit_image(request)
        assert result["edited_image"] == 888
        service.mock_rest_client.post.assert_called_once()
        mock_poll.assert_called_once_with(888, None)


@pytest.mark.anyio
async def test_generate_video(service):
    request = MagicMock()
    request.workspace_id = 1
    request.inputs.prompt = "A running dog"
    request.inputs.input_images = [123]
    request.inputs.start_frame = None
    request.inputs.end_frame = None
    request.config.model = "veo-3.1-generate-001"
    request.config.brand_guidelines = False

    service.mock_rest_client.post.return_value = Response(200, json={"id": 777})

    with patch.object(
        service,
        "_poll_job_status",
        AsyncMock(return_value=True),
    ) as mock_poll:
        result = await service.generate_video(request)
        assert result["generated_video"] == 777
        service.mock_rest_client.post.assert_called_once()
        mock_poll.assert_called_once_with(777, None)


@pytest.mark.anyio
async def test_virtual_try_on(service):
    request = MagicMock()
    request.workspace_id = 1
    request.inputs.model_image = 123
    request.inputs.top_image = None
    request.inputs.bottom_image = None
    request.inputs.dress_image = None
    request.inputs.shoes_image = None

    service.mock_rest_client.post.return_value = Response(200, json={"id": 666})

    with patch.object(
        service,
        "_poll_job_status",
        AsyncMock(return_value=True),
    ) as mock_poll:
        result = await service.virtual_try_on(request)
        assert result["generated_image"] == 666
        service.mock_rest_client.post.assert_called_once()
        mock_poll.assert_called_once_with(666, None)


@pytest.mark.anyio
async def test_generate_audio(service):
    request = MagicMock()
    request.workspace_id = 1
    request.inputs.prompt = "Birds chirping"
    request.config.model = "audio-generator"
    request.config.voice_name = "narrator"
    request.config.language_code = "en"
    request.config.negative_prompt = None
    request.config.seed = None

    service.mock_rest_client.post.return_value = Response(200, json={"id": 555})

    with patch.object(
        service,
        "_poll_job_status",
        AsyncMock(return_value=True),
    ) as mock_poll:
        result = await service.generate_audio(request)
        assert result["generated_audio"] == 555
        service.mock_rest_client.post.assert_called_once()
        mock_poll.assert_called_once_with(555, None)


def test_normalize_asset_inputs_rejects_unresolved_step_reference(service):
    """An unresolved StepOutputReference must fail loudly, not be dropped."""
    ref = StepOutputReference(step="gen1", output="generated_image")
    with pytest.raises(HTTPException) as exc:
        service._normalize_asset_inputs(ref)
    assert exc.value.status_code == 422
    assert "Unresolved step output reference" in exc.value.detail
    assert "gen1.generated_image" in exc.value.detail


def test_normalize_asset_inputs_rejects_unsupported_type(service):
    """Any unhandled type fails clearly rather than being silently dropped."""
    with pytest.raises(HTTPException) as exc:
        service._normalize_asset_inputs([123, "not-an-asset"])
    assert exc.value.status_code == 422
    assert "Unsupported image input type" in exc.value.detail


def test_normalize_asset_inputs_preserves_order_and_mixed_array(service):
    """Within-list order is preserved across media-item ids, refs and assets."""
    media_ref = ReferenceMediaOrAsset(
        previewUrl="",
        sourceMediaItem={
            "mediaItemId": 11,
            "mediaIndex": 0,
            "role": "OUTPUT",
        },
        sourceAssetId=None,
    )
    asset_ref = ReferenceMediaOrAsset(
        previewUrl="",
        sourceMediaItem=None,
        sourceAssetId=22,
    )
    media_items, asset_ids = service._normalize_asset_inputs(
        [1, media_ref, 2, asset_ref, 3],
    )
    assert [m["media_item_id"] for m in media_items] == [1, 11, 2, 3]
    assert [m["role"] for m in media_items] == [
        AssetRoleEnum.INPUT.value,
        "OUTPUT",
        AssetRoleEnum.INPUT.value,
        AssetRoleEnum.INPUT.value,
    ]
    assert asset_ids == [22]


@pytest.mark.anyio
async def test_generate_image_imagen_no_ingredients_backward_compat(service):
    """Imagen model with zero ingredients must still generate (no input gate).

    Backward compatibility: generate_image historically had no reference-image
    input, so Imagen (non gemini-image) models were valid. The capability gate
    is skipped entirely when total_inputs == 0.
    """
    request = MagicMock()
    request.workspace_id = 1
    request.inputs.prompt = "A cat"
    request.inputs.input_images = None
    request.config.model = "imagen-4.0-generate-001"
    request.config.aspect_ratio = "1:1"
    request.config.brand_guidelines = False
    request.config.resolution = "1K"

    service.mock_rest_client.post.return_value = Response(
        200, json={"id": 4321}
    )

    with patch.object(
        service,
        "_poll_job_status",
        AsyncMock(return_value=True),
    ):
        result = await service.generate_image(request)

    assert result["generated_image"] == 4321
    posted_body = service.mock_rest_client.post.call_args.kwargs["json"]
    assert posted_body["generation_model"] == "imagen-4.0-generate-001"
    assert "source_media_items" not in posted_body
    assert "source_asset_ids" not in posted_body


@pytest.mark.anyio
async def test_generate_image_unpatched_normalize_and_forward(service):
    """Full path: real _normalize_asset_inputs runs (unpatched) and result is
    forwarded to the provider endpoint, preserving order.
    """
    request = MagicMock()
    request.workspace_id = 1
    request.inputs.prompt = "Combine ingredients"
    request.inputs.input_images = [
        111,
        ReferenceMediaOrAsset(
            previewUrl="",
            sourceMediaItem=None,
            sourceAssetId=222,
        ),
        333,
    ]
    request.config.model = "gemini-3.1-flash-image"
    request.config.aspect_ratio = "1:1"
    request.config.brand_guidelines = False
    request.config.resolution = "1K"

    service.mock_rest_client.post.return_value = Response(
        200, json={"id": 8800}
    )

    with patch.object(
        service,
        "_poll_job_status",
        AsyncMock(return_value=True),
    ):
        result = await service.generate_image(request)

    assert result["generated_image"] == 8800
    posted_body = service.mock_rest_client.post.call_args.kwargs["json"]
    assert [m["media_item_id"] for m in posted_body["source_media_items"]] == [
        111,
        333,
    ]
    assert posted_body["source_asset_ids"] == [222]
