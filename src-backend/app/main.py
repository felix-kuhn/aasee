"""FastAPI application entry point (also used by `uvicorn app.main:app`)."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .api import api_router
from .config import default_data_dir
from .core.errors import register_error_handlers
from .core.logging import setup_logging
from .deps import AppContext


def create_app(data_dir: str | None = None) -> FastAPI:
    setup_logging()
    ctx = AppContext(data_dir or default_data_dir())
    app = FastAPI(
        title="theories-backend",
        version=__version__,
        description="Backend for the Research Assistant Tauri app: theory/wiki hydration and storage",
    )
    app.state.ctx = ctx
    app.include_router(api_router)
    # The frontend (vite dev server and the Tauri webview) calls this API
    # cross-origin; allow it while the backend is a local dev/sidecar process.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_error_handlers(app)
    return app


app = create_app()
