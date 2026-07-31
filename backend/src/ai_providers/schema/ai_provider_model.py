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
"""AI provider persistence model."""

import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from src.ai_providers.constants import ProviderTypeEnum
from src.common.base_repository import BaseDocument
from src.database import Base


class AiProvider(Base):
    """SQLAlchemy model for configured AI providers."""

    __tablename__ = "ai_providers"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    key: Mapped[str] = mapped_column(
        String, unique=True, index=True, nullable=False
    )
    display_name: Mapped[str] = mapped_column(String, nullable=False)
    provider_type: Mapped[ProviderTypeEnum] = mapped_column(
        String, nullable=False
    )
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    secret_ref: Mapped[str | None] = mapped_column(String, nullable=True)
    base_url: Mapped[str | None] = mapped_column(String, nullable=True)
    timeout_seconds: Mapped[int] = mapped_column(
        Integer, default=60, nullable=False
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class AiProviderModel(BaseDocument):
    """Internal provider schema. Do not expose secret_ref in API responses."""

    id: int | None = None
    key: str
    display_name: str
    provider_type: ProviderTypeEnum
    enabled: bool = True
    secret_ref: str | None = None
    base_url: str | None = None
    timeout_seconds: int = 60
