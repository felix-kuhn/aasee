"""Unit tests for the in-memory job queue."""
from __future__ import annotations

import time

from app.jobs.queue import JobRegistry


def _wait(registry: JobRegistry, job_id: str, timeout: float = 5.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        job = registry.get(job_id)
        if job is not None and job.status in ("done", "failed"):
            return
        time.sleep(0.01)
    raise AssertionError(f"job {job_id} did not finish")


def test_job_completes_and_reports_progress():
    registry = JobRegistry()

    def work(job):
        job.update(stage="work", progress=0.5, detail="halfway")
        return {"ok": True}

    job = registry.submit("test", work)
    _wait(registry, job.id)

    done = registry.get(job.id)
    assert done is not None
    assert done.status == "done"
    assert done.stage == "work"
    assert done.progress == 1.0
    assert done.result == {"ok": True}
    assert done.finished_at is not None

    payload = done.to_dict()
    assert payload["id"] == done.id
    assert payload["status"] == "done"
    assert payload["detail"] == "halfway"


def test_failed_job_records_error():
    registry = JobRegistry()

    def boom(job):
        raise ValueError("nope")

    job = registry.submit("test", boom)
    _wait(registry, job.id)

    failed = registry.get(job.id)
    assert failed is not None
    assert failed.status == "failed"
    assert "nope" in failed.error
    assert failed.finished_at is not None


def test_list_returns_newest_first():
    registry = JobRegistry()
    first = registry.submit("a", lambda job: None)
    second = registry.submit("b", lambda job: None)
    _wait(registry, first.id)
    _wait(registry, second.id)

    jobs = registry.list()
    assert jobs[0].id == second.id
    assert jobs[1].id == first.id
