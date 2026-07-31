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
"""AI provider schema tests."""

from src.ai_providers.constants import EnvironmentEnum, MediaTypeEnum
from src.ai_providers.dto.ai_provider_dto import (
    ModelDefaultsDto,
    VideoCapabilitiesDto,
)
from src.ai_providers.schema.ai_model_model import AiModelModel


def test_ai_model_round_trip_and_json_configuration():
    source = AiModelModel(
        id=1,
        key="veo",
        provider_id=1,
        vendor_model_id="veo-3.1-generate-001",
        media_type=MediaTypeEnum.VIDEO,
        display_name="Veo",
        capabilities=VideoCapabilitiesDto(durations=[4, 8]).model_dump(),
        defaults=ModelDefaultsDto(duration_seconds=8).model_dump(),
        environment=EnvironmentEnum.PRODUCTION,
    )
    restored = AiModelModel.model_validate(source.model_dump())
    assert restored.capabilities.durations == [4, 8]
    assert restored.defaults.duration_seconds == 8
