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
"""Provider job repository."""

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai_providers.schema.provider_job_model import (
    ProviderJob,
    ProviderJobModel,
)
from src.common.base_repository import BaseRepository
from src.database import get_db


class ProviderJobRepository(BaseRepository[ProviderJob, ProviderJobModel]):
    """Database operations for provider job audit records."""

    def __init__(self, db: AsyncSession = Depends(get_db)):
        super().__init__(model=ProviderJob, schema=ProviderJobModel, db=db)

    async def get_by_provider_job_id(
        self, provider_job_id: str
    ) -> ProviderJobModel | None:
        """Finds a provider job by provider-issued ID."""
        result = await self.db.execute(
            select(self.model).where(
                self.model.provider_job_id == provider_job_id
            ),
        )
        job = result.scalar_one_or_none()
        return self.schema.model_validate(job) if job else None
