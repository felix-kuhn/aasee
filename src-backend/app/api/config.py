"""Runtime configuration endpoints (planned).

Will expose GET/PUT config, connection tests and model listings
(see docs/plan/02_config_and_llm_gateway.md).
"""
from fastapi import APIRouter

router = APIRouter()
