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
"""Provider job persistence model."""

import datetime


from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.common.base_repository import BaseDocument
from src.common.schema.media_item_model import JobStatusEnum
from src.database import Base


class ProviderJob(Base):
    """SQLAlchemy model for external provider job audit records."""

    __tablename__ = "provider_jobs"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    media_item_id: Mapped[int] = mapped_column(
        ForeignKey("media_items.id"), index=True, nullable=False
    )
    provider_id: Mapped[int] = mapped_column(
        ForeignKey("ai_providers.id"), nullable=False
    )
    model_id: Mapped[int] = mapped_column(
        ForeignKey("ai_models.id"), nullable=False
    )
    provider_job_id: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[JobStatusEnum] = mapped_column(String, nullable=False)
    request_metadata: Mapped[dict] = mapped_column(JSONB, nullable=False)
    provider_metrics: Mapped[dict] = mapped_column(JSONB, nullable=False)
    error: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class ProviderJobModel(BaseDocument):
    """Provider job audit schema. Metadata must exclude credentials."""

    id: int | None = None
    media_item_id: int
    provider_id: int
    model_id: int
    provider_job_id: str
    status: JobStatusEnum
    request_metadata: dict
    provider_metrics: dict
    error: dict | None = None
