"""Health endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from .. import __version__
from ..deps import AppContext, get_context

router = APIRouter()


@router.get("/health")
def health(ctx: AppContext = Depends(get_context)) -> dict:
    file_count = len(list(ctx.theories_dir.glob("*.html"))) if ctx.theories_dir.exists() else 0
    return {
        "status": "ok",
        "version": __version__,
        "data_dir": str(ctx.data_dir),
        "theories_dir": str(ctx.theories_dir),
        "files": file_count,
        "base_url": ctx.cfg.theories.base_url,
    }
