import json
import os
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import JSON, DateTime, String, func
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

DATABASE_URL = os.getenv("DATABASE_URL", "")
_db_url: str | None = None
engine = None
AsyncSessionLocal = None


class Base(DeclarativeBase):
    pass


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    messages: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


async def init_db() -> None:
    global _db_url, engine, AsyncSessionLocal
    raw = os.getenv("DATABASE_URL", "")
    if not raw:
        _db_url = None
        return
    if raw.startswith("postgresql://"):
        raw = raw.replace("postgresql://", "postgresql+asyncpg://", 1)
    _db_url = raw
    engine = create_async_engine(raw, echo=False, pool_size=5, max_overflow=10)
    AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    global engine, AsyncSessionLocal, _db_url
    if engine:
        await engine.dispose()
    engine = None
    AsyncSessionLocal = None
    _db_url = None


def is_db_configured() -> bool:
    return _db_url is not None


async def get_session_messages(session_id: str) -> list[dict] | None:
    if not is_db_configured():
        return None
    async with AsyncSessionLocal() as sess:
        row = await sess.get(ChatSession, session_id)
        if row is None:
            return None
        return row.messages


async def create_session(session_id: str, messages: list[dict]) -> None:
    if not is_db_configured():
        return
    async with AsyncSessionLocal() as sess:
        row = ChatSession(id=session_id, messages=messages)
        sess.add(row)
        await sess.commit()


async def update_session_messages(session_id: str, messages: list[dict]) -> None:
    if not is_db_configured():
        return
    async with AsyncSessionLocal() as sess:
        row = await sess.get(ChatSession, session_id)
        if row is not None:
            row.messages = messages
            row.updated_at = datetime.now(timezone.utc)
            await sess.commit()


async def delete_session(session_id: str) -> None:
    if not is_db_configured():
        return
    async with AsyncSessionLocal() as sess:
        row = await sess.get(ChatSession, session_id)
        if row is not None:
            await sess.delete(row)
            await sess.commit()
