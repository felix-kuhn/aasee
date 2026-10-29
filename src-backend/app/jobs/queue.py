"""In-memory background job queue (PoC scale, single process).

Adapted from the original poc-backend job registry.
"""
from __future__ import annotations

import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable

from ..core.ids import new_id


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Job:
    id: str
    kind: str
    status: str = "pending"  # pending | running | done | failed
    stage: str = ""
    progress: float = 0.0
    detail: str = ""
    created_at: str = field(default_factory=_now)
    finished_at: str | None = None
    error: str = ""
    result: dict | None = None

    def update(
        self,
        stage: str | None = None,
        progress: float | None = None,
        detail: str | None = None,
    ) -> None:
        if stage is not None:
            self.stage = stage
        if progress is not None:
            self.progress = max(0.0, min(1.0, progress))
        if detail is not None:
            self.detail = detail

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "kind": self.kind,
            "status": self.status,
            "stage": self.stage,
            "progress": self.progress,
            "detail": self.detail,
            "created_at": self.created_at,
            "finished_at": self.finished_at,
            "error": self.error,
            "result": self.result,
        }


class JobRegistry:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()

    def submit(self, kind: str, fn: Callable[[Job], dict | None], **kwargs: Any) -> Job:
        job = Job(id=new_id(), kind=kind)
        with self._lock:
            self._jobs[job.id] = job

        def run() -> None:
            job.status = "running"
            try:
                job.result = fn(job, **kwargs) or {}
                job.status = "done"
            except Exception as exc:  # noqa: BLE001 - surfaced via the API
                job.status = "failed"
                job.error = str(exc)[:2000]
            finally:
                job.finished_at = _now()
                if job.status == "done":
                    job.progress = 1.0

        thread = threading.Thread(target=run, name=f"job-{job.kind}-{job.id[:8]}", daemon=True)
        thread.start()
        return job

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            return self._jobs.get(job_id)

    def list(self) -> list[Job]:
        with self._lock:
            return sorted(self._jobs.values(), key=lambda j: j.created_at, reverse=True)
