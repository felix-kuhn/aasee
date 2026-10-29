"""HTTP API for the research assistant backend.

Live contract (used by the Tauri frontend):
    GET  /health
    GET  /v1/theories
    GET  /v1/theories/{slug}
    POST /v1/theories/hydrate
    GET  /v1/theories/jobs/{job_id}

The remaining routers are mounted now and gain endpoints incrementally
(see docs/plan/*).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ..security import require_auth
from .config import router as config_router
from .eval import router as eval_router
from .files import router as files_router
from .graph import router as graph_router
from .health import router as health_router
from .jobs import router as jobs_router
from .links import router as links_router
from .search import router as search_router
from .wiki import router as wiki_router

api_router = APIRouter(dependencies=[Depends(require_auth)])
api_router.include_router(health_router, tags=["health"])
api_router.include_router(wiki_router, prefix="/v1/theories", tags=["wiki"])
api_router.include_router(config_router, prefix="/v1/config", tags=["config"])
api_router.include_router(jobs_router, prefix="/v1/jobs", tags=["jobs"])
api_router.include_router(files_router, prefix="/v1/files", tags=["files"])
api_router.include_router(search_router, prefix="/v1/search", tags=["search"])
api_router.include_router(graph_router, prefix="/v1/graph", tags=["graph"])
api_router.include_router(links_router, prefix="/v1/links", tags=["links"])
api_router.include_router(eval_router, prefix="/v1/eval", tags=["eval"])
