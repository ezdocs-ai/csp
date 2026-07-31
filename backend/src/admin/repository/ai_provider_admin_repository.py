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
"""Admin persistence operations for AI providers."""

from fastapi import Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai_providers.schema.ai_model_model import AiModel
from src.ai_providers.schema.ai_provider_model import (
    AiProvider,
    AiProviderModel,
)
from src.common.base_repository import BaseRepository
from src.database import get_db


class AiProviderAdminRepository(BaseRepository[AiProvider, AiProviderModel]):
    """Database operations for AI provider administration."""

    def __init__(self, db: AsyncSession = Depends(get_db)):
        super().__init__(model=AiProvider, schema=AiProviderModel, db=db)

    async def list_all(self) -> list[AiProviderModel]:
        """Lists every provider, including disabled providers."""
        return await self.find_all(limit=10_000)

    async def count_models_for_provider(self, provider_id: int) -> int:
        """Counts models that reference a provider."""
        result = await self.db.execute(
            select(func.count()).where(AiModel.provider_id == provider_id),
        )
        return result.scalar_one()
