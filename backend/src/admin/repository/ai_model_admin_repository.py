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
"""Admin persistence operations for AI models."""

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai_providers.schema.ai_model_model import AiModel, AiModelModel
from src.common.base_repository import BaseRepository
from src.database import get_db


class AiModelAdminRepository(BaseRepository[AiModel, AiModelModel]):
    """Database operations for AI model administration."""

    def __init__(self, db: AsyncSession = Depends(get_db)):
        super().__init__(model=AiModel, schema=AiModelModel, db=db)

    async def list_for_provider(
        self, provider_id: int | None
    ) -> list[AiModelModel]:
        """Lists models, optionally filtered by provider."""
        query = select(self.model)
        if provider_id is not None:
            query = query.where(self.model.provider_id == provider_id)
        result = await self.db.execute(query)
        return [
            self.schema.model_validate(model)
            for model in result.scalars().all()
        ]
