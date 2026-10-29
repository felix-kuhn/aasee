"""Request authentication for the local API.

The desktop app and vite dev server talk to this backend on loopback. A token
is only required when ``APP_AUTH_TOKEN`` is set (future sidecar mode); by
default requests are accepted unauthenticated so the current frontend keeps
working unchanged.
"""
from __future__ import annotations

import hmac
import os

from fastapi import Header, HTTPException


def _configured_token() -> str | None:
    token = os.environ.get("APP_AUTH_TOKEN")
    return token or None


async def require_auth(authorization: str | None = Header(default=None)) -> None:
    """Dependency applied to every route; no-op unless APP_AUTH_TOKEN is set."""
    token = _configured_token()
    if token is None:
        return
    expected = f"Bearer {token}"
    if not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail={"reason": "unauthorized"})
