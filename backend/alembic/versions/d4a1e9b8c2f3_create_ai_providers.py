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
"""Create AI provider registry tables.

Revision ID: d4a1e9b8c2f3
Revises: cb3c4680571b
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "d4a1e9b8c2f3"
down_revision: Union[str, None] = "cb3c4680571b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


VIDEO_MODELS = [
    "gemini-omni-generate-preview",
    "gemini-omni-flash-preview",
    "veo-3.1-fast-generate-001",
    "veo-3.1-lite-generate-001",
    "veo-3.1-generate-001",
    "veo-3.1-generate-preview",
    "veo-3.0-fast-generate-001",
    "veo-3.0-generate-001",
    "veo-3.0-fast-generate-preview",
    "veo-3.0-generate-preview",
]
# Capabilities/defaults expose user-facing resolution aliases (1K/2K/4K)
# matching CreateVeoDto.resolution. VeoAdapter performs the inverse
# mapping (1K->720p, 2K->1080p, 4K->4k) at submit time.
CAPABILITIES = {
    "text_to_video": True,
    "image_to_video": True,
    "durations": [4, 6, 8],
    "aspect_ratios": ["16:9", "9:16"],
    "resolutions": ["1K", "2K", "4K"],
    "max_outputs": 1,
}
DEFAULTS = {"duration_seconds": 8, "aspect_ratio": "16:9", "resolution": "1K"}


def upgrade() -> None:
    op.create_table(
        "ai_providers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("display_name", sa.String(), nullable=False),
        sa.Column("provider_type", sa.String(), nullable=False),
        sa.Column(
            "enabled", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
        sa.Column("secret_ref", sa.String(), nullable=True),
        sa.Column("base_url", sa.String(), nullable=True),
        sa.Column(
            "timeout_seconds", sa.Integer(), nullable=False, server_default="60"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("key"),
    )
    op.create_index("ix_ai_providers_key", "ai_providers", ["key"], unique=True)
    op.create_table(
        "ai_models",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("key", sa.String(), nullable=False),
        sa.Column(
            "provider_id",
            sa.Integer(),
            sa.ForeignKey("ai_providers.id"),
            nullable=False,
        ),
        sa.Column("vendor_model_id", sa.String(), nullable=False),
        sa.Column("media_type", sa.String(), nullable=False),
        sa.Column("display_name", sa.String(), nullable=False),
        sa.Column(
            "enabled", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
        sa.Column("capabilities", postgresql.JSONB(), nullable=False),
        sa.Column("defaults", postgresql.JSONB(), nullable=False),
        sa.Column("cost_metadata", postgresql.JSONB(), nullable=True),
        sa.Column("environment", sa.String(), nullable=False),
        sa.Column(
            "priority", sa.Integer(), nullable=False, server_default="100"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("key"),
    )
    op.create_index("ix_ai_models_key", "ai_models", ["key"], unique=True)
    op.create_table(
        "provider_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "media_item_id",
            sa.Integer(),
            sa.ForeignKey("media_items.id"),
            nullable=False,
        ),
        sa.Column(
            "provider_id",
            sa.Integer(),
            sa.ForeignKey("ai_providers.id"),
            nullable=False,
        ),
        sa.Column(
            "model_id",
            sa.Integer(),
            sa.ForeignKey("ai_models.id"),
            nullable=False,
        ),
        sa.Column("provider_job_id", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("request_metadata", postgresql.JSONB(), nullable=False),
        sa.Column("provider_metrics", postgresql.JSONB(), nullable=False),
        sa.Column("error", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_provider_jobs_media_item_id", "provider_jobs", ["media_item_id"]
    )
    providers = sa.table(
        "ai_providers",
        sa.column("id", sa.Integer()),
        sa.column("key", sa.String()),
        sa.column("display_name", sa.String()),
        sa.column("provider_type", sa.String()),
        sa.column("enabled", sa.Boolean()),
    )
    op.bulk_insert(
        providers,
        [
            {
                "id": 1,
                "key": "google_veo",
                "display_name": "Google Veo",
                "provider_type": "GOOGLE_VEAN",
                "enabled": True,
            }
        ],
    )
    models = sa.table(
        "ai_models",
        sa.column("key", sa.String()),
        sa.column("provider_id", sa.Integer()),
        sa.column("vendor_model_id", sa.String()),
        sa.column("media_type", sa.String()),
        sa.column("display_name", sa.String()),
        sa.column("enabled", sa.Boolean()),
        sa.column("capabilities", postgresql.JSONB()),
        sa.column("defaults", postgresql.JSONB()),
        sa.column("environment", sa.String()),
        sa.column("priority", sa.Integer()),
    )
    op.bulk_insert(
        models,
        [
            {
                "key": model,
                "provider_id": 1,
                "vendor_model_id": model,
                "media_type": "VIDEO",
                "display_name": model,
                "enabled": True,
                "capabilities": CAPABILITIES,
                "defaults": DEFAULTS,
                "environment": "PRODUCTION",
                "priority": 100,
            }
            for model in VIDEO_MODELS
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_provider_jobs_media_item_id", table_name="provider_jobs")
    op.drop_table("provider_jobs")
    op.drop_index("ix_ai_models_key", table_name="ai_models")
    op.drop_table("ai_models")
    op.drop_index("ix_ai_providers_key", table_name="ai_providers")
    op.drop_table("ai_providers")
