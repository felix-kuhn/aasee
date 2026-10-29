"""Uniform error responses for the API."""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    """API error with a machine-readable reason and optional details."""

    def __init__(self, status_code: int, reason: str, **details: object) -> None:
        self.status_code = status_code
        self.reason = reason
        self.details = details
        super().__init__(reason)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": {"reason": exc.reason, **exc.details}},
        )
