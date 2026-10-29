"""Research Assistant backend (FastAPI sidecar for the Tauri app).

Layout:
    app/api/         HTTP routers (health, config, jobs, wiki, files, ...)
    app/core/        settings, logging, errors, ids
    app/gateway/     LLM / embeddings / rerank clients
    app/jobs/        background job queue + runner
    app/pipelines/   wiki / docs / extraction / resolution / linking / retrieval
    app/schemas/     shared Pydantic models
    app/stores/      persistence interfaces + implementations

Only the wiki/theories flow is implemented so far; the other packages are
scaffolding for the increments described in ``docs/plan``.
"""

__version__ = "0.1.0"
