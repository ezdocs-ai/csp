# Copyright 2026 Google LLC
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
"""normalize video resolution keys to user-facing aliases

Revision ID: f1a2b3c4d5e6
Revises: d4a1e9b8c2f3

Maps capability JSONB ``resolutions`` arrays and ``defaults.resolution``
from provider-side literals (``720p``/``1080p``/``4k``) to the
user-facing wire aliases (``1K``/``2K``/``4K``) that the Angular client
and ``CreateVeoDto.resolution`` already speak. ``VeoAdapter`` performs
the inverse mapping at submit time via ``VIDEO_RESOLUTION_MAP``.
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "d4a1e9b8c2f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_MAP_ENTRIES = [
    ("720p", "1K"),
    ("1080p", "2K"),
    ("4k", "4K"),
]

# Per-model allowed resolutions, mirroring
# CreateVeoDto.validate_cross_fields.
_MODEL_RESOLUTIONS: dict[tuple[str, ...], list[str]] = {
    ("gemini-omni-generate-preview", "gemini-omni-flash-preview"): ["1K"],
    ("veo-3.1-lite-generate-001",): ["1K", "2K"],
    (
        "veo-3.0-fast-generate-001",
        "veo-3.0-fast-generate-preview",
        "veo-3.0-generate-001",
        "veo-3.0-generate-preview",
        "veo-3.1-fast-generate-001",
        "veo-3.1-generate-001",
        "veo-3.1-generate-preview",
    ): ["1K", "2K", "4K"],
}


def upgrade() -> None:
    """Rewrites JSONB resolution arrays and scalar default values.

    Also expands per-model resolution lists to match the model-specific
    validator in ``CreateVeoDto.validate_cross_fields`` so the public
    capability endpoint accurately reflects what the backend accepts.
    """
    bind = op.get_bind()
    for provider_literal, user_alias in _MAP_ENTRIES:
        bind.execute(
            text(
                """
                UPDATE ai_models
                SET capabilities = jsonb_set(
                    capabilities,
                    '{resolutions}',
                    (
                        SELECT jsonb_agg(
                            CASE
                                WHEN elem = :provider_literal THEN :user_alias
                                ELSE elem
                            END
                        )
                        FROM jsonb_array_elements_text(
                            capabilities->'resolutions'
                        ) AS elem
                    )
                )
                WHERE media_type = 'VIDEO'
                  AND capabilities ? 'resolutions'
                  AND EXISTS (
                      SELECT 1
                      FROM jsonb_array_elements_text(
                          capabilities->'resolutions'
                      ) AS elem
                      WHERE elem = :provider_literal
                  )
                """,
            ),
            {"provider_literal": provider_literal, "user_alias": user_alias},
        )
        bind.execute(
            text(
                """
                UPDATE ai_models
                SET defaults = jsonb_set(
                    defaults,
                    '{resolution}',
                    to_jsonb(CAST(:user_alias AS text))
                )
                WHERE media_type = 'VIDEO'
                  AND defaults->>'resolution' = :provider_literal
                """,
            ),
            {"provider_literal": provider_literal, "user_alias": user_alias},
        )

    # Expand resolution lists to match CreateVeoDto.validate_cross_fields.
    for keys, resolutions in _MODEL_RESOLUTIONS.items():
        bind.execute(
            text(
                """
                UPDATE ai_models
                SET capabilities = jsonb_set(
                    capabilities,
                    '{resolutions}',
                    CAST(:resolutions AS jsonb)
                )
                WHERE media_type = 'VIDEO'
                  AND key = ANY(:keys)
                """,
            ),
            {
                "keys": list(keys),
                "resolutions": str(resolutions).replace("'", '"'),
            },
        )


def downgrade() -> None:
    """Reverts user-facing aliases back to provider-side literals."""
    bind = op.get_bind()
    for provider_literal, user_alias in _MAP_ENTRIES:
        bind.execute(
            text(
                """
                UPDATE ai_models
                SET capabilities = jsonb_set(
                    capabilities,
                    '{resolutions}',
                    (
                        SELECT jsonb_agg(
                            CASE
                                WHEN elem = :user_alias THEN :provider_literal
                                ELSE elem
                            END
                        )
                        FROM jsonb_array_elements_text(
                            capabilities->'resolutions'
                        ) AS elem
                    )
                )
                WHERE media_type = 'VIDEO'
                  AND capabilities ? 'resolutions'
                """,
            ),
            {"provider_literal": provider_literal, "user_alias": user_alias},
        )
        bind.execute(
            text(
                """
                UPDATE ai_models
                SET defaults = jsonb_set(
                    defaults,
                    '{resolution}',
                    to_jsonb(CAST(:provider_literal AS text))
                )
                WHERE media_type = 'VIDEO'
                  AND defaults->>'resolution' = :user_alias
                """,
            ),
            {"provider_literal": provider_literal, "user_alias": user_alias},
        )
