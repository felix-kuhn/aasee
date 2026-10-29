"""General background-job endpoints (planned).

Will list jobs and stream progress; the current hydration job status stays
under ``/v1/theories/jobs/{job_id}`` (see docs/plan/04_job_system.md).
"""
from fastapi import APIRouter

router = APIRouter()
