"""Persistent job runner (planned).

The current PoC executes jobs on daemon threads through ``JobRegistry``. A
runner with worker limits, retries and durable job records will be built here
(see docs/plan/04_job_system.md).
"""
from __future__ import annotations


class JobRunner:
    """Placeholder for the future worker-pool runner."""

    def __init__(self, max_workers: int = 4) -> None:
        self.max_workers = max_workers
