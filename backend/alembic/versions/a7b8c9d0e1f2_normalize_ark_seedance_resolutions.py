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
"""normalize ark seedance resolutions to user-facing aliases

Revision ID: a7b8c9d0e1f2
Revises: f1a2b3c4d5e6

The six BytePlus ModelArk (Seedance) rows were seeded with raw provider
literals (``480p``/``720p``/``1080p``/``4k``) after ``f1a2b3c4d5e6`` ran,
violating the repo-wide convention that ``ai_models.capabilities.resolutions``,
``defaults.resolution``, the public capability API, the Angular client and
``CreateVeoDto.resolution`` all speak the user-facing aliases ``1K``/``2K``/
``4K``. ``480p`` has no alias, so it is dropped; ``ArkAdapter`` maps aliases
back to provider literals at submit time via ``VIDEO_RESOLUTION_MAP``.

This revision also splits the overloaded ``image_to_video`` flag by adding a
``reference_images`` boolean: Ark supports first/last-frame image-to-video but
NOT multi-reference "ingredients" input, so it gets ``reference_images=false``
while every other ``media_type='VIDEO'`` row gets ``reference_images=true``.
Ark ``image_to_video`` is flipped to ``true`` now that the worker is wired.
"""

import json
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Per-Ark-model alias resolution lists and the buggy literal form they are
# reverted to on downgrade. Mirrors bootstrap.seed_ai_models.
_ARK_ROWS: list[tuple[str, list[str], list[str]]] = [
    (
        "seedance-1-0-pro-250528",
        ["1K", "2K", "4K"],
        ["480p", "720p", "1080p", "4k"],
    ),
    (
        "dreamina-seedance-2-0-260128",
        ["1K", "2K", "4K"],
        ["480p", "720p", "1080p", "4k"],
    ),
    (
        "seedance-1-0-pro-fast-251015",
        ["1K", "2K"],
        ["480p", "720p", "1080p"],
    ),
    (
        "seedance-1-5-pro-251215",
        ["1K", "2K"],
        ["480p", "720p", "1080p"],
    ),
    (
        "dreamina-seedance-2-0-fast-260128",
        ["1K"],
        ["480p", "720p"],
    ),
    (
        "dreamina-seedance-2-0-mini-260615",
        ["1K"],
        ["480p", "720p"],
    ),
]

_ARK_KEYS = [row[0] for row in _ARK_ROWS]


def upgrade() -> None:
    """Rewrites Ark resolution arrays/defaults to aliases and splits the
    ``image_to_video`` / ``reference_images`` capability flags.
    """
    bind = op.get_bind()

    # 1. Ark resolutions -> user-facing aliases.
    for key, alias_resolutions, _literal_resolutions in _ARK_ROWS:
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
                  AND key = :key
                """,
            ),
            {"key": key, "resolutions": json.dumps(alias_resolutions)},
        )
        bind.execute(
            text(
                """
                UPDATE ai_models
                SET defaults = jsonb_set(
                    defaults,
                    '{resolution}',
                    to_jsonb(CAST(:resolution AS text))
                )
                WHERE media_type = 'VIDEO'
                  AND key = :key
                """,
            ),
            {"key": key, "resolution": "1K"},
        )

    # 2. Ark capability flags: first/last-frame image-to-video ON,
    #    multi-reference ingredients OFF.
    bind.execute(
        text(
            """
            UPDATE ai_models
            SET capabilities = jsonb_set(
                    jsonb_set(capabilities, '{image_to_video}', 'true'::jsonb),
                    '{reference_images}',
                    'false'::jsonb
                )
            WHERE media_type = 'VIDEO'
              AND key = ANY(:keys)
            """,
        ),
        {"keys": _ARK_KEYS},
    )

    # 3. Every other VIDEO model supports multi-reference ingredients.
    bind.execute(
        text(
            """
            UPDATE ai_models
            SET capabilities = jsonb_set(
                    capabilities,
                    '{reference_images}',
                    'true'::jsonb
                )
            WHERE media_type = 'VIDEO'
              AND key <> ALL(:keys)
            """,
        ),
        {"keys": _ARK_KEYS},
    )


def downgrade() -> None:
    """Reverts Ark resolutions/defaults to provider literals and removes the
    ``reference_images`` flag added by this revision; flips Ark
    ``image_to_video`` back to ``false``.
    """
    bind = op.get_bind()

    # 1. Ark resolutions/defaults -> provider literals.
    for key, _alias_resolutions, literal_resolutions in _ARK_ROWS:
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
                  AND key = :key
                """,
            ),
            {"key": key, "resolutions": json.dumps(literal_resolutions)},
        )
        bind.execute(
            text(
                """
                UPDATE ai_models
                SET defaults = jsonb_set(
                    defaults,
                    '{resolution}',
                    to_jsonb(CAST(:resolution AS text))
                )
                WHERE media_type = 'VIDEO'
                  AND key = :key
                """,
            ),
            {"key": key, "resolution": "720p"},
        )

    # 2. Ark image_to_video back to false; drop reference_images flag.
    bind.execute(
        text(
            """
            UPDATE ai_models
            SET capabilities = (capabilities #- '{reference_images}')
                                  || jsonb_build_object('image_to_video', false)
            WHERE media_type = 'VIDEO'
              AND key = ANY(:keys)
            """,
        ),
        {"keys": _ARK_KEYS},
    )

    # 3. Drop reference_images flag from all other VIDEO models.
    bind.execute(
        text(
            """
            UPDATE ai_models
            SET capabilities = capabilities #- '{reference_images}'
            WHERE media_type = 'VIDEO'
              AND key <> ALL(:keys)
            """,
        ),
        {"keys": _ARK_KEYS},
    )
