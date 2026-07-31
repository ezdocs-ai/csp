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
"""AI model persistence model."""

import datetime
from typing import Any


from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.ai_providers.constants import EnvironmentEnum, MediaTypeEnum
from src.ai_providers.dto.ai_provider_dto import (
    CostMetadataDto,
    ModelDefaultsDto,
    VideoCapabilitiesDto,
)
from src.common.base_repository import BaseDocument
from src.database import Base


class AiModel(Base):
    """SQLAlchemy model for provider model configuration."""

    __tablename__ = "ai_models"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    key: Mapped[str] = mapped_column(
        String, unique=True, index=True, nullable=False
    )
    provider_id: Mapped[int] = mapped_column(
        ForeignKey("ai_providers.id"), nullable=False
    )
    vendor_model_id: Mapped[str] = mapped_column(String, nullable=False)
    media_type: Mapped[MediaTypeEnum] = mapped_column(String, nullable=False)
    display_name: Mapped[str] = mapped_column(String, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    capabilities: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    defaults: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    cost_metadata: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, nullable=True
    )
    environment: Mapped[EnvironmentEnum] = mapped_column(String, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class AiModelModel(BaseDocument):
    """Internal provider model schema."""

    id: int | None = None
    key: str
    provider_id: int
    vendor_model_id: str
    media_type: MediaTypeEnum
    display_name: str
    enabled: bool = True
    capabilities: VideoCapabilitiesDto
    defaults: ModelDefaultsDto
    cost_metadata: CostMetadataDto | None = None
    environment: EnvironmentEnum
    priority: int = 100
