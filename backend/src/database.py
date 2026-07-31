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
"""Database configuration and session management."""

from collections.abc import AsyncGenerator
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import asyncpg
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from src.config.config_service import config_service


class Base(DeclarativeBase):
    """Base class for SQLAlchemy models."""


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield a database session."""
    async with async_session_local() as session:
        yield session


def _local_connection_url() -> str:
    return (
        f"postgresql+asyncpg://{config_service.DB_USER}:"
        f"{config_service.DB_PASS}@{config_service.DB_HOST}:"
        f"{config_service.DB_PORT}/{config_service.DB_NAME}"
    )


def _normalize_connection_url(url: str, *, sqlalchemy: bool) -> str:
    """Normalize PostgreSQL URLs for SQLAlchemy or raw asyncpg clients."""
    parsed = urlsplit(url)
    scheme = parsed.scheme
    if sqlalchemy and scheme in {"postgres", "postgresql"}:
        scheme = "postgresql+asyncpg"
    elif not sqlalchemy and scheme == "postgresql+asyncpg":
        scheme = "postgresql"

    query = []
    for key, value in parse_qsl(parsed.query, keep_blank_values=True):
        if key == "channel_binding":
            continue
        if sqlalchemy and key == "sslmode":
            key = "ssl"
        query.append((key, value))

    return urlunsplit(
        (scheme, parsed.netloc, parsed.path, urlencode(query), parsed.fragment)
    )


def get_conn_string() -> str:
    """Return the application SQLAlchemy URL.

    ``DATABASE_URL`` is intended for the deployed pooled endpoint. Local
    development falls back to the split ``DB_*`` settings used by Compose.
    """
    if config_service.DATABASE_URL:
        return _normalize_connection_url(
            config_service.DATABASE_URL, sqlalchemy=True
        )
    return _local_connection_url()


def get_migrations_conn_string() -> str:
    """Return the SQLAlchemy URL used by Alembic migrations."""
    url = config_service.DIRECT_DATABASE_URL or config_service.DATABASE_URL
    if url:
        return _normalize_connection_url(url, sqlalchemy=True)
    return _local_connection_url()


def get_raw_connection_string() -> str:
    """Return a raw asyncpg DSN, preferring the direct database endpoint."""
    url = config_service.DIRECT_DATABASE_URL or config_service.DATABASE_URL
    if url:
        return _normalize_connection_url(url, sqlalchemy=False)
    return _normalize_connection_url(_local_connection_url(), sqlalchemy=False)


async def get_connection():
    """Create a raw asyncpg connection for migrations and advisory locks."""
    return await asyncpg.connect(get_raw_connection_string())


engine = create_async_engine(
    get_conn_string(),
    echo=config_service.LOG_LEVEL == "DEBUG",
)

async_session_local = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class WorkerDatabase:
    """Provide a fresh database engine for a worker event loop."""

    def __init__(self):
        self.engine = None
        self.sessionmaker = None

    async def __aenter__(self) -> async_sessionmaker[AsyncSession]:
        self.engine = create_async_engine(
            get_conn_string(),
            echo=config_service.LOG_LEVEL == "DEBUG",
        )
        self.sessionmaker = async_sessionmaker(
            bind=self.engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )
        return self.sessionmaker

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.engine:
            await self.engine.dispose()
