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
"""Adapter boundary for existing Veo generation flow."""

from src.ai_providers.contract import (
    ModelConfig,
    ProviderJob,
    ProviderJobStatus,
    ProviderOutput,
    VideoCapabilities,
    VideoGenerationRequest,
)
from src.common.schema.media_item_model import JobStatusEnum
from src.videos.veo_service import VeoService


class VeoAdapter:
    """Provider adapter facade for existing Veo service."""

    def __init__(self, service: VeoService | None = None) -> None:
        self._service = service

    def capabilities(self, model: ModelConfig) -> VideoCapabilities:
        """Returns configured Veo capabilities without calling Vertex."""
        return model.capabilities

    async def submit(
        self, request: VideoGenerationRequest, model: ModelConfig
    ) -> ProviderJob:
        """Rejects direct contract submission until legacy request wiring exists."""
        await self.submit_via_veo_service(request, model)
        raise AssertionError("submit_via_veo_service must raise")

    async def status(self, provider_job_id: str) -> ProviderJobStatus:
        """Reports pending legacy lifecycle status."""
        # ponytail: legacy jobs expose no provider job ID; add persisted IDs and polling.
        return ProviderJobStatus(
            provider_job_id=provider_job_id,
            status=JobStatusEnum.PROCESSING,
        )

    async def cancel(self, provider_job_id: str) -> None:
        """Rejects cancellation until legacy worker exposes cancellation."""
        # ponytail: legacy worker has no cancellation handle; add cooperative cancellation.
        raise NotImplementedError(
            f"Veo cancellation unavailable for provider job '{provider_job_id}'."
        )

    async def collect(self, job: ProviderJob) -> list[ProviderOutput]:
        """Returns no outputs until legacy worker exposes provider result lookup."""
        # ponytail: legacy results live on MediaItem; add provider-job-to-media lookup.
        return []

    async def submit_via_veo_service(
        self, request: VideoGenerationRequest, model: ModelConfig
    ) -> None:
        """Intent shim for later mapping into VeoService public request DTO."""
        del request, model
        # ponytail: contract lacks user, executor, and CreateVeoDto fields; map them next.
        raise NotImplementedError(
            "Veo contract submission needs legacy request, user, and executor wiring."
        )
