"""
FarmDesk API Server.
FastAPI backend for a Ghana agriculture and food systems assistant.
"""

import os
import re
import uuid
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI, OpenAI
from pydantic import BaseModel

from database import (
    close_db,
    create_session,
    delete_session,
    get_session_messages,
    init_db,
    is_db_configured,
    update_session_messages,
)
from prompt_guard import (
    SECURITY_APPENDIX,
    detect_injection,
    rate_limiter,
    sanitize_input,
    wrap_user_message,
)

try:
    from .agri_prompt import SYSTEM_PROMPT
except ImportError:
    from agri_prompt import SYSTEM_PROMPT

try:
    from .knowledge import vector_store
    from .knowledge.loader import load_all
except ImportError:
    from knowledge import vector_store
    from knowledge.loader import load_all

# Load .env from the project root (one level up)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

# ============================================================================
# SESSION STORAGE (PostgreSQL via SQLAlchemy, fallback to in-memory)
# ============================================================================

sessions: dict[str, list[dict]] = {}


async def get_or_create_session(session_id: str | None) -> tuple[str, list[dict]]:
    """Get existing session or create a new one (DB first, then in-memory fallback)."""
    if session_id:
        if is_db_configured():
            msgs = await get_session_messages(session_id)
            if msgs is not None:
                return session_id, msgs
        elif session_id in sessions:
            return session_id, sessions[session_id]

    new_id = str(uuid.uuid4())
    enhanced_prompt = SYSTEM_PROMPT + SECURITY_APPENDIX
    msgs = [{"role": "system", "content": enhanced_prompt}]

    if is_db_configured():
        await create_session(new_id, msgs)
    else:
        sessions[new_id] = msgs

    return new_id, msgs


# ============================================================================
# OPENAI CLIENT
# ============================================================================

def get_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")
    return OpenAI(
        api_key=api_key,
    )


def get_async_client() -> AsyncOpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")
    return AsyncOpenAI(
        api_key=api_key,
    )


def get_model() -> str:
    return os.getenv("OPENAI_MODEL", "gpt-4o-mini")


def sanitize_reply(text: str) -> str:
    """Convert simple markdown table lines into plain bullets and remove pipe dividers.

    Leaves normal text lines intact but strips lines that are only table dividers (----).
    """
    if not text:
        return text

    lines = text.splitlines()
    out_lines: list[str] = []

    for line in lines:
        s = line.strip()
        if not s:
            continue
        # skip separator-only lines like |---|---|
        if re.fullmatch(r"\|?\s*-{2,}\s*(\|\s*-{2,}\s*)*\|?", s):
            continue

        if '|' in line:
            # split table row into cells and emit bullets
            cells = [c.strip() for c in line.split('|') if c.strip()]
            for c in cells:
                out_lines.append(f"- {c}")
            continue

        # remove stray pipe characters
        if '|' in s:
            s = s.replace('|', '-')

        out_lines.append(s)

    out = "\n".join(out_lines)
    out = re.sub(r"\n{2,}", "\n", out)
    return out.strip()


# ============================================================================
# FASTAPI APP
# ============================================================================

_knowledge_loaded: bool = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown events."""
    global _knowledge_loaded
    print("FarmDesk API starting...")
    print(f"   Model: {get_model()}")

    await init_db()
    if is_db_configured():
        print("   Database: PostgreSQL connected")
    else:
        print("   Database: in-memory (no DATABASE_URL set)")

    try:
        n = load_all()
        _knowledge_loaded = n > 0
        print(f"   Knowledge base: {n} chunks loaded")
    except Exception as e:
        _knowledge_loaded = False
        print(f"   Knowledge base: failed to load ({e})")
    yield
    print("FarmDesk API shutting down.")
    await close_db()


app = FastAPI(
    title="FarmDesk API",
    description="Agriculture and food systems assistant for Ghana",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    history: list[dict[str, str]] | None = None


class ChatResponse(BaseModel):
    reply: str
    session_id: str


class ResetResponse(BaseModel):
    session_id: str
    message: str


class HealthResponse(BaseModel):
    status: str
    model: str
    active_sessions: int
    db_configured: bool = False


def retrieve_context(query_text: str) -> str:
    """Query the knowledge base and format relevant chunks as context."""
    try:
        chunks = vector_store.query(query_text, n_results=3)
        if not chunks:
            return ""
        return "\n\n".join(chunks)
    except Exception:
        return ""


def apply_client_history(messages: list[dict], history: list[dict[str, str]] | None) -> None:
    """Restore context from the web client's saved local history when needed."""
    if len(messages) > 1 or not history:
        return

    for item in history[-20:]:
        role = item.get("role")
        content = item.get("content", "").strip()
        if role not in {"user", "assistant"} or not content:
            continue
        # Sanitize client-supplied history to prevent injection through stored state
        safe_content = sanitize_input(content)
        if role == "user":
            safe_content = wrap_user_message(safe_content)
        messages.append({"role": role, "content": safe_content})


# ============================================================================
# ENDPOINTS
# ============================================================================

@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        model=get_model(),
        active_sessions=len(sessions),
        db_configured=is_db_configured(),
    )


@app.post("/api/chat", response_model=ChatResponse)
async def chat(chat_req: ChatRequest, request: Request):
    """Send a message and get a response from FarmDesk."""
    # --- Rate limiting (per IP) ---
    client_ip = request.client.host if request.client else "unknown"
    allowed, remaining = rate_limiter.check(client_ip)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please wait before sending another message.",
        )

    raw = chat_req.message
    if not raw.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Get or create session early — needed for session_id even on rejection
    session_id, _ = await get_or_create_session(chat_req.session_id)

    # --- Injection detection (returns friendly response, not raw error) ---
    is_injection, label, _ = detect_injection(raw)
    if is_injection:
        return ChatResponse(
            reply=(
                f"I can't answer that — your message was flagged as a prompt injection "
                f"attempt (policy: {label}). I'm only designed to give agriculture advice "
                f"for Ghana. Please ask a genuine farming question."
            ),
            session_id=session_id,
        )

    # --- Sanitize ---
    cleaned = sanitize_input(raw)

    _, messages = await get_or_create_session(session_id)
    apply_client_history(messages, chat_req.history)

    try:
        client = get_client()
        model = get_model()

        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.2,
            max_tokens=150,
        )

        reply = resp.choices[0].message.content or "I'm sorry, I couldn't generate a response."

        # Sanitize assistant reply (remove tables/pipes, convert to bullets)
        reply = sanitize_reply(reply)

        # Add assistant reply to history
        messages.append({"role": "assistant", "content": reply})
        await update_session_messages(session_id, messages)

        return ChatResponse(reply=reply, session_id=session_id)

    except HTTPException:
        raise
    except Exception as e:
        # Remove the failed user message from history
        if len(messages) > 1:
            messages.pop()
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")


@app.post("/api/chat/stream")
async def stream_chat(chat_req: ChatRequest, request: Request):
    """Send a message and stream FarmDesk's response as plain text chunks."""
    # --- Rate limiting (per IP) ---
    client_ip = request.client.host if request.client else "unknown"
    allowed, remaining = rate_limiter.check(client_ip)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please wait before sending another message.",
        )

    raw = chat_req.message
    if not raw.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Get or create session early — needed for session_id even on rejection
    session_id, _ = await get_or_create_session(chat_req.session_id)

    # --- Injection detection (streams a friendly response, not a raw error) ---
    is_injection, label, _ = detect_injection(raw)
    if is_injection:
        rejection = (
            f"I can't answer that — your message was flagged as a prompt injection "
            f"attempt (policy: {label}). I'm only designed to give agriculture advice "
            f"for Ghana. Please ask a genuine farming question."
        )

        async def reject_stream():
            yield rejection

        return StreamingResponse(
            reject_stream(),
            media_type="text/plain; charset=utf-8",
            headers={
                "Cache-Control": "no-cache",
                "X-Session-Id": session_id,
                "Access-Control-Expose-Headers": "X-Session-Id",
            },
        )

    # --- Sanitize ---
    cleaned = sanitize_input(raw)

    _, messages = await get_or_create_session(session_id)
    apply_client_history(messages, chat_req.history)

    context = retrieve_context(cleaned)
    if context:
        messages.append({"role": "system", "content": f"Here is relevant information from the knowledge base:\n{context}"})

    messages.append({"role": "user", "content": wrap_user_message(cleaned)})

    async def generate():
        full_reply = ""

        try:
            client = get_async_client()
            model = get_model()

            stream = await client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.2,
                max_tokens=150,
                stream=True,
            )

            async for chunk in stream:
                delta = chunk.choices[0].delta.content or ""
                if not delta:
                    continue

                full_reply += delta

                cleaned = delta.replace("|", "-")
                cleaned_lines = []
                for ln in cleaned.splitlines():
                    if re.fullmatch(r"\s*-{2,}\s*", ln):
                        continue
                    cleaned_lines.append(ln)
                cleaned_delta = "\n".join(cleaned_lines)

                if cleaned_delta:
                    yield cleaned_delta

            cleaned = sanitize_reply(full_reply)
            messages.append({"role": "assistant", "content": cleaned})
            await update_session_messages(session_id, messages)
        except Exception as e:
            if len(messages) > 1:
                messages.pop()
            yield f"\n\n[FarmDesk stream error: {str(e)}]"

    return StreamingResponse(
        generate(),
        media_type="text/plain; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "X-Session-Id": session_id,
            "Access-Control-Expose-Headers": "X-Session-Id",
        },
    )


@app.post("/api/chat/reset", response_model=ResetResponse)
async def reset_chat(request: ChatRequest | None = None):
    """Reset/start a new conversation."""
    # If there's an existing session, remove it
    sid = request.session_id if request else None
    if sid:
        if is_db_configured():
            await delete_session(sid)
        elif sid in sessions:
            del sessions[sid]

    # Create fresh session
    new_id, _ = await get_or_create_session(None)

    return ResetResponse(
        session_id=new_id,
        message="Conversation reset. Ready to chat!",
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
