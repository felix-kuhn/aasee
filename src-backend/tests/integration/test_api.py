"""Integration tests for the FastAPI application."""
from __future__ import annotations

import time
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import create_app
from app.pipelines.wiki import scraper

SAMPLE_HTML = "<h1>Activity Theory</h1><p>Sample content</p>"
TIMESTAMP = "20261028T161730Z"


def _write_theory(data_dir: Path) -> Path:
    theories_dir = data_dir / "theories"
    theories_dir.mkdir(parents=True, exist_ok=True)
    path = theories_dir / f"Activity_Theory_{TIMESTAMP}.html"
    path.write_text(SAMPLE_HTML, encoding="utf-8")
    return path


def _wait_for_job(client: TestClient, job_id: str, timeout: float = 5.0) -> dict:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        resp = client.get(f"/v1/theories/jobs/{job_id}")
        body = resp.json()
        if body["status"] in ("done", "failed"):
            return body
        time.sleep(0.01)
    raise AssertionError(f"job {job_id} did not finish")


def test_health(tmp_path):
    client = TestClient(create_app(str(tmp_path)))
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["data_dir"] == str(tmp_path)
    assert body["files"] == 0


def test_list_and_get_theory(tmp_path):
    _write_theory(tmp_path)
    client = TestClient(create_app(str(tmp_path)))

    listing = client.get("/v1/theories")
    assert listing.status_code == 200
    body = listing.json()
    assert body["count"] == 1
    theory = body["theories"][0]
    assert theory["slug"] == "Activity_Theory"
    assert theory["title"] == "Activity Theory"
    assert theory["tokens"] > 0

    detail = client.get("/v1/theories/Activity_Theory")
    assert detail.status_code == 200
    assert detail.json()["content"] == SAMPLE_HTML


def test_missing_theory_returns_uniform_error(tmp_path):
    client = TestClient(create_app(str(tmp_path)))
    resp = client.get("/v1/theories/does_not_exist")
    assert resp.status_code == 404
    assert resp.json()["detail"]["reason"] == "not_found"


def test_hydrate_and_job_status(tmp_path, monkeypatch):
    def fake_hydration(cfg, theories_dir, job):
        job.update(stage="scrape", progress=0.5, detail="fake")
        theories_dir.mkdir(parents=True, exist_ok=True)
        path = theories_dir / f"Fake_Theory_{TIMESTAMP}.html"
        path.write_text("<h1>Fake</h1>", encoding="utf-8")
        return {
            "scraped": 1,
            "errors": [],
            "files": [{"slug": "Fake_Theory", "file": path.name}],
            "timestamp": TIMESTAMP,
        }

    monkeypatch.setattr(scraper, "run_hydration", fake_hydration)
    client = TestClient(create_app(str(tmp_path)))

    resp = client.post("/v1/theories/hydrate")
    assert resp.status_code == 202
    job_id = resp.json()["job_id"]

    body = _wait_for_job(client, job_id)
    assert body["status"] == "done"
    assert body["result"]["scraped"] == 1
    assert client.get("/v1/theories/Fake_Theory").status_code == 200


def test_optional_auth(tmp_path, monkeypatch):
    monkeypatch.setenv("APP_AUTH_TOKEN", "secret")
    client = TestClient(create_app(str(tmp_path)))

    assert client.get("/health").status_code == 401
    ok = client.get("/health", headers={"Authorization": "Bearer secret"})
    assert ok.status_code == 200
