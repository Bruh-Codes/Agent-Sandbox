"""Server smoke tests — validate models and helpers without booting the app."""

import sys
from typing import Any


def test_sanitize_reply_handles_none():
    from server import sanitize_reply

    assert sanitize_reply("") == ""
    assert sanitize_reply(None) is None


def test_sanitize_reply_removes_table_dividers():
    from server import sanitize_reply

    text = "Hello\n|---|---|---|\nWorld"
    result = sanitize_reply(text)
    assert "Hello" in result
    assert "World" in result
    assert "|---|---|---|" not in result


def test_sanitize_reply_converts_table_to_bullets():
    from server import sanitize_reply

    text = "a | b | c"
    result = sanitize_reply(text)
    assert "- a" in result
    assert "- b" in result
    assert "- c" in result


def test_get_model_returns_env_or_default():
    from server import get_model

    model = get_model()
    assert isinstance(model, str) and len(model) > 0


def test_health_response_model():
    from server import HealthResponse

    h = HealthResponse(status="ok", model="gpt-4o-mini", active_sessions=0)
    assert h.status == "ok"
    assert h.model == "gpt-4o-mini"


def test_chat_request_model():
    from server import ChatRequest

    r = ChatRequest(message="hello", model="gpt-4o")
    assert r.message == "hello"
    assert r.model == "gpt-4o"
    assert r.session_id is None
    assert r.history is None


def test_chat_response_model():
    from server import ChatResponse

    r = ChatResponse(reply="hi", session_id="sess_123")
    assert r.reply == "hi"
    assert r.session_id == "sess_123"
