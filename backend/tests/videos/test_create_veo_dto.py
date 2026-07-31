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
"""Tests for Create Veo Dto."""


import pytest
from pydantic import ValidationError

from src.common.base_dto import (
    GenerationModelEnum,
    ReferenceImageTypeEnum,
)
from src.common.schema.media_item_model import SourceMediaItemLink
from src.videos.dto.create_veo_dto import CreateVeoDto, ReferenceImageDto


def test_create_veo_dto_valid():
    dto = CreateVeoDto(
        prompt="Test",
        workspace_id=1,
        generation_model=GenerationModelEnum.VEO_3_QUALITY,
        aspect_ratio="16:9",
    )
    assert dto.prompt == "Test"


def test_validate_video_aspect_ratio_error():
    with pytest.raises(ValidationError) as exc_info:
        CreateVeoDto(
            prompt="Test", workspace_id=1, aspect_ratio="1:1"
        )  # Invalid
    assert "Invalid aspect ratio for video" in str(exc_info.value)


def test_validate_source_media_items_invalid_role():
    with pytest.raises(ValidationError) as exc_info:
        CreateVeoDto(
            prompt="Test",
            workspace_id=1,
            source_media_items=[
                SourceMediaItemLink(
                    media_item_id=1,
                    media_index=0,
                    role="invalid_role",
                ),
            ],
        )
    # Pydantic validation error or enum validation error
    assert "invalid_role" in str(exc_info.value)


def test_validate_source_media_items_model_conflict():
    with pytest.raises(ValidationError) as exc_info:
        CreateVeoDto(
            prompt="Test",
            workspace_id=1,
            generation_model=GenerationModelEnum.VEO_3_QUALITY,
            reference_images=[
                ReferenceImageDto(
                    asset_id=1,
                    reference_type=ReferenceImageTypeEnum.ASSET,
                ),
            ],
            source_media_items=[],  # Force validator to run
        )
    assert "Reference images/media are only supported by" in str(exc_info.value)


def test_validate_source_media_items_conflicting_inputs():
    with pytest.raises(ValidationError) as exc_info:
        CreateVeoDto(
            prompt="Test",
            workspace_id=1,
            generation_model=GenerationModelEnum.VEO_3_1_PREVIEW,
            start_image_asset_id={"id": 1, "type": "source_asset"},
            reference_images=[
                ReferenceImageDto(
                    asset_id=2,
                    reference_type=ReferenceImageTypeEnum.ASSET,
                ),
            ],
            source_media_items=[],  # Force validator to run
        )
    assert "Reference media cannot be used at the same time" in str(
        exc_info.value
    )


def test_validate_video_generation_model_error():
    with pytest.raises(ValidationError) as exc_info:
        CreateVeoDto(
            prompt="Test", workspace_id=1, generation_model="invalid_model"
        )
    assert (
        "Invalid generation model for video" in str(exc_info.value)
        or "enum" in str(exc_info.value).lower()
    )


def test_create_veo_dto_with_omni_references():
    dto = CreateVeoDto(
        prompt="Test Omni",
        workspace_id=1,
        generation_model=GenerationModelEnum.GEMINI_OMNI,
        reference_video={"id": 10, "type": "media_item"},
        reference_audio={"id": 20, "type": "media_item"},
        parent_media_item_id=15,
    )
    assert dto.generation_model == GenerationModelEnum.GEMINI_OMNI
    assert dto.reference_video.id == 10
    assert dto.reference_video.type == "media_item"
    assert dto.reference_audio.id == 20
    assert dto.reference_audio.type == "media_item"
    assert dto.parent_media_item_id == 15


def test_validate_resolution_by_model():
    # Gemini Omni - 1K is OK
    CreateVeoDto(
        prompt="Test",
        workspace_id=1,
        generation_model=GenerationModelEnum.GEMINI_OMNI,
        resolution="1K",
    )

    # Gemini Omni - 2K is error
    with pytest.raises(ValidationError) as exc_info:
        CreateVeoDto(
            prompt="Test",
            workspace_id=1,
            generation_model=GenerationModelEnum.GEMINI_OMNI,
            resolution="2K",
        )
    assert "does not support resolution '2K'" in str(exc_info.value)

    # Veo 3.1 Lite - 2K is OK
    CreateVeoDto(
        prompt="Test",
        workspace_id=1,
        generation_model=GenerationModelEnum.VEO_3_1_LITE_GENERATE_001,
        resolution="2K",
    )

    # Veo 3.1 Lite - 4K is error
    with pytest.raises(ValidationError) as exc_info:
        CreateVeoDto(
            prompt="Test",
            workspace_id=1,
            generation_model=GenerationModelEnum.VEO_3_1_LITE_GENERATE_001,
            resolution="4K",
        )
    assert "does not support resolution '4K'" in str(exc_info.value)

    # Veo 3.1 Generate 001 - 4K is OK
    CreateVeoDto(
        prompt="Test",
        workspace_id=1,
        generation_model=GenerationModelEnum.VEO_3_1_GENERATE_001,
        resolution="4K",
    )

    # Ark Seedance - user-facing aliases are accepted (provider literals
    # are mapped at submit time via VIDEO_RESOLUTION_MAP).
    CreateVeoDto(
        prompt="Test",
        workspace_id=1,
        generation_model=GenerationModelEnum.ARK_SEEDANCE_1_0_PRO,
        resolution="1K",
    )
    CreateVeoDto(
        prompt="Test",
        workspace_id=1,
        generation_model=GenerationModelEnum.ARK_SEEDANCE_1_0_PRO,
        resolution="4K",
    )


def test_validate_duration_and_aspect_ratio_for_ark_models():
    # Ark Seedance supports up to 10s and non-Veo aspect ratios.
    dto = CreateVeoDto(
        prompt="Test",
        workspace_id=1,
        generation_model=GenerationModelEnum.ARK_DREAMINA_SEEDANCE_2_0,
        aspect_ratio="4:3",
        resolution="1K",
        duration_seconds=10,
    )
    assert dto.duration_seconds == 10
    assert dto.aspect_ratio == "4:3"

    # Non-Ark models still reject aspect ratios outside 16:9/9:16.
    with pytest.raises(ValidationError) as exc_info:
        CreateVeoDto(
            prompt="Test",
            workspace_id=1,
            generation_model=GenerationModelEnum.VEO_3_QUALITY,
            aspect_ratio="4:3",
        )
    assert "Invalid aspect ratio for video" in str(exc_info.value)


def test_ark_model_accepts_frames_rejects_references():
    # Ark Seedance accepts start/end frames (image-to-video).
    dto = CreateVeoDto(
        prompt="Test",
        workspace_id=1,
        generation_model=GenerationModelEnum.ARK_SEEDANCE_1_0_PRO,
        resolution="1K",
        start_image_asset_id={"id": 1, "type": "source_asset"},
        end_image_asset_id={"id": 2, "type": "source_asset"},
    )
    assert dto.start_image_asset_id.id == 1
    assert dto.end_image_asset_id.id == 2

    # Ark still rejects reference images (ingredients-to-video unsupported).
    with pytest.raises(ValidationError) as exc_info:
        CreateVeoDto(
            prompt="Test",
            workspace_id=1,
            generation_model=GenerationModelEnum.ARK_SEEDANCE_1_0_PRO,
            resolution="1K",
            reference_images=[
                ReferenceImageDto(
                    asset_id=3,
                    reference_type=ReferenceImageTypeEnum.ASSET,
                ),
            ],
            source_media_items=[],  # Force validator to run
        )
    assert "Reference images/media are only supported by" in str(exc_info.value)
