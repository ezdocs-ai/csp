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
"""Tests for database configuration."""

from unittest.mock import AsyncMock, patch

import pytest

from src.config.config_service import config_service
from src.database import (
    WorkerDatabase,
    get_conn_string,
    get_connection,
    get_db,
    get_migrations_conn_string,
    get_raw_connection_string,
)


def test_get_conn_string_uses_database_url():
    with patch.object(
        config_service,
        "DATABASE_URL",
        "postgresql://u:p@pooler.example/d?sslmode=require&channel_binding=require",
    ):
        result = get_conn_string()

    assert result == "postgresql+asyncpg://u:p@pooler.example/d?ssl=require"


def test_get_conn_string_uses_local_settings():
    with (
        patch.object(config_service, "DATABASE_URL", ""),
        patch.object(config_service, "DB_USER", "u"),
        patch.object(config_service, "DB_PASS", "p"),
        patch.object(config_service, "DB_HOST", "h"),
        patch.object(config_service, "DB_PORT", "5432"),
        patch.object(config_service, "DB_NAME", "d"),
    ):
        result = get_conn_string()

    assert result == "postgresql+asyncpg://u:p@h:5432/d"


def test_migrations_conn_string_prefers_direct_url():
    with (
        patch.object(
            config_service,
            "DIRECT_DATABASE_URL",
            "postgresql://u:p@direct.example/d?sslmode=require",
        ),
        patch.object(
            config_service,
            "DATABASE_URL",
            "postgresql://u:p@pooler.example/d?sslmode=require",
        ),
    ):
        result = get_migrations_conn_string()

    assert result == "postgresql+asyncpg://u:p@direct.example/d?ssl=require"


def test_migrations_conn_string_falls_back_to_database_url():
    with (
        patch.object(config_service, "DIRECT_DATABASE_URL", ""),
        patch.object(
            config_service,
            "DATABASE_URL",
            "postgresql://u:p@pooler.example/d?sslmode=require",
        ),
    ):
        result = get_migrations_conn_string()

    assert result == "postgresql+asyncpg://u:p@pooler.example/d?ssl=require"


def test_raw_connection_string_prefers_direct_url():
    with (
        patch.object(
            config_service,
            "DIRECT_DATABASE_URL",
            "postgresql+asyncpg://u:p@direct.example/d?sslmode=require&channel_binding=require",
        ),
        patch.object(config_service, "DATABASE_URL", ""),
    ):
        result = get_raw_connection_string()

    assert result == "postgresql://u:p@direct.example/d?sslmode=require"


@pytest.mark.anyio
async def test_get_connection_uses_raw_dsn():
    with (
        patch.object(
            config_service,
            "DIRECT_DATABASE_URL",
            "postgresql://u:p@direct.example/d?sslmode=require",
        ),
        patch(
            "src.database.asyncpg.connect", new_callable=AsyncMock
        ) as connect,
    ):
        connect.return_value = "connection"
        result = await get_connection()

    assert result == "connection"
    connect.assert_awaited_once_with(
        "postgresql://u:p@direct.example/d?sslmode=require"
    )


@pytest.mark.anyio
async def test_worker_database_uses_direct_engine():
    engine = AsyncMock()
    with (
        patch(
            "src.database.create_async_engine", return_value=engine
        ) as create,
        patch("src.database.async_sessionmaker", return_value="sessionmaker"),
        patch.object(config_service, "DATABASE_URL", ""),
    ):
        async with WorkerDatabase() as sessionmaker:
            assert sessionmaker == "sessionmaker"

    create.assert_called_once()
    engine.dispose.assert_awaited_once()


def test_get_db_yields_generator():
    assert get_db() is not None
