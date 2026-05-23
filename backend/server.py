"""
AgriBridge Ghana API Server.
FastAPI backend for a Ghana agriculture and food systems assistant.
"""

import os
import re
import time
import uuid
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from openai import OpenAI
from pydantic import BaseModel

try:
    from .agri_prompt import SYSTEM_PROMPT
except ImportError:
    from agri_prompt import SYSTEM_PROMPT

# Load .env from the project root (one level up)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

# ============================================================================
# SESSION STORAGE (in-memory)
# ============================================================================

sessions: dict[str, list[dict]] = {}


def get_or_create_session(session_id: str | None) -> tuple[str, list[dict]]:
    """Get existing session or create a new one."""
    if session_id and session_id in sessions:
        return session_id, sessions[session_id]

    new_id = str(uuid.uuid4())
    sessions[new_id] = [{"role": "system", "content": SYSTEM_PROMPT}]
    return new_id, sessions[new_id]


def iter_display_chunks(text: str):
    """Yield readable text pieces even if the upstream provider buffers output."""
    for piece in re.findall(r"\S+\s*", text):
        yield piece
        time.sleep(0.018)


# ============================================================================
# OPENAI CLIENT
# ============================================================================

def get_client() -> OpenAI:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY not configured")
    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )


def get_model() -> str:
    return os.getenv("OPENROUTER_MODEL", "openai/gpt-4o")


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

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown events."""
    print("AgriBridge Ghana API starting...")
    print(f"   Model: {get_model()}")
    yield
    print("AgriBridge Ghana API shutting down.")


app = FastAPI(
    title="AgriBridge Ghana API",
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


def apply_client_history(messages: list[dict], history: list[dict[str, str]] | None) -> None:
    """Restore context from the web client's saved local history when needed."""
    if len(messages) > 1 or not history:
        return

    for item in history[-20:]:
        role = item.get("role")
        content = item.get("content", "").strip()
        if role not in {"user", "assistant"} or not content:
            continue
        messages.append({"role": role, "content": content})


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
    )


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Send a message and get a response from AgriBridge Ghana."""
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Get or create session
    session_id, messages = get_or_create_session(request.session_id)
    apply_client_history(messages, request.history)

    # Add user message
    messages.append({"role": "user", "content": request.message})

    try:
        client = get_client()
        model = get_model()

        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.2,
            max_tokens=300,
        )

        reply = resp.choices[0].message.content or "I'm sorry, I couldn't generate a response."

        # Sanitize assistant reply (remove tables/pipes, convert to bullets)
        reply = sanitize_reply(reply)

        # Add assistant reply to history
        messages.append({"role": "assistant", "content": reply})

        return ChatResponse(reply=reply, session_id=session_id)

    except Exception as e:
        # Remove the failed user message from history
        messages.pop()
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")


@app.post("/api/chat/stream")
async def stream_chat(request: ChatRequest):
    """Send a message and stream AgriBridge Ghana's response as plain text chunks."""
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    session_id, messages = get_or_create_session(request.session_id)
    apply_client_history(messages, request.history)
    messages.append({"role": "user", "content": request.message})

    def generate():
        full_reply = ""

        try:
            client = get_client()
            model = get_model()

            stream = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.2,
                max_tokens=300,
                stream=True,
            )

            for chunk in stream:
                delta = chunk.choices[0].delta.content or ""
                if not delta:
                    continue

                full_reply += delta

                # Sanitize the small streamed chunk before sending to client:
                # - remove pipe characters
                # - drop lines that are only dash separators
                cleaned = delta.replace("|", "-")
                cleaned_lines = []
                for ln in cleaned.splitlines():
                    if re.fullmatch(r"\s*-{2,}\s*", ln):
                        continue
                    cleaned_lines.append(ln)
                cleaned_delta = "\n".join(cleaned_lines)

                if cleaned_delta:
                    yield from iter_display_chunks(cleaned_delta)

            # Sanitize final assembled reply before saving
            cleaned = sanitize_reply(full_reply)
            messages.append({"role": "assistant", "content": cleaned})
        except Exception as e:
            messages.pop()
            yield f"\n\n[AgriBridge Ghana stream error: {str(e)}]"

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
    if request and request.session_id and request.session_id in sessions:
        del sessions[request.session_id]

    # Create fresh session
    new_id, _ = get_or_create_session(None)

    return ResetResponse(
        session_id=new_id,
        message="Conversation reset. Ready to chat!",
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
