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
"""BytePlus ModelArk (Ark) video provider adapter."""

import logging

import httpx

from src.ai_providers.contract import (
    ModelConfig,
    ProviderJob,
    ProviderJobStatus,
    ProviderOutput,
    VideoCapabilities,
    VideoGenerationRequest,
    normalize_state,
)
from src.common.schema.media_item_model import JobStatusEnum
from src.common.storage_service import GcsService
from src.config.config_service import config_service

logger = logging.getLogger(__name__)

_ARK_TASKS_PATH = "/contents/generations/tasks"


class ArkAdapter:
    """Video provider adapter for the BytePlus ModelArk (Ark) API."""

    def __init__(self, gcs_service: GcsService | None = None) -> None:
        self._gcs = gcs_service

    # --- internal helpers ---

    def _base_url(self) -> str:
        return config_service.ARK_API_BASE_URL.rstrip("/")

    def _headers(self) -> dict[str, str]:
        # Bearer token stays in the header only; never logged elsewhere.
        return {
            "Authorization": f"Bearer {config_service.ARK_API_KEY}",
            "Content-Type": "application/json",
        }

    @staticmethod
    def _ensure_ok(resp: httpx.Response, label: str) -> None:
        """Raises RuntimeError carrying Ark's error code/message.

        Only the structured `error` object is surfaced; the raw body is never
        logged, so no credential echoed back by the provider can leak.
        """
        try:
            resp.raise_for_status()
        except httpx.HTTPStatusError:
            try:
                err = resp.json().get("error") or {}
                detail = f"{err.get('code')}: {err.get('message')}"
            except ValueError:
                detail = "unparseable error body"
            logger.error(
                "Ark %s failed with HTTP %s - %s",
                label,
                resp.status_code,
                detail,
            )
            raise RuntimeError(
                f"Ark {label} failed with HTTP {resp.status_code} - {detail}"
            ) from None

    def _task_url(self, provider_job_id: str | None = None) -> str:
        url = f"{self._base_url()}{_ARK_TASKS_PATH}"
        if provider_job_id:
            return f"{url}/{provider_job_id}"
        return url

    # --- VideoProviderAdapter protocol ---

    def capabilities(self, model: ModelConfig) -> VideoCapabilities:
        """Returns Ark model capabilities (fixed by provider spec)."""
        del model
        return VideoCapabilities(
            text_to_video=True,
            image_to_video=True,
            # Ark supports first/last frame only, not ingredients mode.
            reference_images=False,
            durations=[5, 10],
            aspect_ratios=[
                "16:9",
                "4:3",
                "1:1",
                "3:4",
                "9:16",
                "21:9",
            ],
            resolutions=["480p", "720p", "1080p", "4k"],
            max_outputs=1,
        )

    async def submit(
        self, request: VideoGenerationRequest, model: ModelConfig
    ) -> ProviderJob:
        """Submits an Ark content generation task."""
        content: list[dict] = [{"type": "text", "text": request.prompt}]
        if request.input_image_uri:
            content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": request.input_image_uri},
                    "role": "first_frame",
                }
            )
        if request.last_frame_image_uri:
            content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": request.last_frame_image_uri},
                    "role": "last_frame",
                }
            )
        body: dict = {
            "model": model.vendor_model_id,
            "content": content,
            # ponytail: audio/watermark are fixed provider defaults;
            # expose when the contract grows.
            "generate_audio": True,
            "watermark": False,
            "return_last_frame": False,
            "service_tier": "default",
        }
        if request.duration_seconds is not None:
            body["duration"] = request.duration_seconds
        if request.aspect_ratio:
            body["ratio"] = request.aspect_ratio
        if request.resolution:
            body["resolution"] = request.resolution

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    self._task_url(),
                    headers=self._headers(),
                    json=body,
                )
        except httpx.HTTPError:
            logger.error("Ark submit network error")
            raise RuntimeError("Ark submit network error") from None

        self._ensure_ok(resp, "submit")
        provider_job_id = resp.json().get("id")
        if not provider_job_id:
            raise RuntimeError("Ark submit response missing task id")
        return ProviderJob(
            provider_job_id=provider_job_id,
            status=JobStatusEnum.PROCESSING,
        )

    async def status(self, provider_job_id: str) -> ProviderJobStatus:
        """Returns normalized Ark task status."""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    self._task_url(provider_job_id),
                    headers=self._headers(),
                )
        except httpx.HTTPError:
            logger.error("Ark status network error")
            raise RuntimeError("Ark status network error") from None

        self._ensure_ok(resp, "status")
        data = resp.json()
        status = normalize_state(data.get("status", ""))
        error_message: str | None = None
        if status == JobStatusEnum.FAILED:
            error = data.get("error") or {}
            error_message = error.get("message")
        return ProviderJobStatus(
            provider_job_id=provider_job_id,
            status=status,
            error_message=error_message,
        )

    async def cancel(self, provider_job_id: str) -> None:
        """Cancels (or deletes) an Ark task; swallows already-gone errors."""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.delete(
                    self._task_url(provider_job_id),
                    headers=self._headers(),
                )
        except httpx.HTTPError as exc:
            logger.warning(
                "Ark cancel network error for '%s': %s",
                provider_job_id,
                type(exc).__name__,
            )
            return
        if resp.status_code >= 400 and resp.status_code != 404:
            logger.warning(
                "Ark cancel for '%s' returned HTTP %s",
                provider_job_id,
                resp.status_code,
            )

    async def collect(self, job: ProviderJob) -> list[ProviderOutput]:
        """Downloads the Ark result video and persists it to GCS."""
        video_bytes: bytes
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.get(
                    self._task_url(job.provider_job_id),
                    headers=self._headers(),
                )
                self._ensure_ok(resp, "collect:status")
                content = resp.json().get("content") or {}
                video_url = content.get("video_url")
                if not video_url:
                    raise RuntimeError(
                        f"Ark job '{job.provider_job_id}' produced no "
                        "video_url"
                    )
                download = await client.get(video_url)
                self._ensure_ok(download, "collect:download")
                video_bytes = download.content
        except httpx.HTTPError:
            logger.error("Ark collect network error")
            raise RuntimeError("Ark collect network error") from None

        gcs = self._gcs or GcsService()
        destination = f"videos/ark/{job.provider_job_id}.mp4"
        gcs_uri = gcs.upload_bytes_to_gcs(video_bytes, destination, "video/mp4")
        if not gcs_uri:
            raise RuntimeError(
                f"GCS upload failed for Ark job '{job.provider_job_id}'"
            )
        return [ProviderOutput(uri=gcs_uri, mime_type="video/mp4")]
