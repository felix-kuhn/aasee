# Theories Backend (PoC)

FastAPI backend for the Research Assistant Tauri app. Currently one feature:
**Theories** - hydrates [is.theorizeit.org](https://is.theorizeit.org) and stores
each theory's `<div id="bodyContent">` as a local HTML file.

## Layout

    src-backend/
    +-- pyproject.toml
    +-- data/                      # runtime data (git-ignored)
    |   +-- theories/              # scraped theory HTML
    |   +-- databases/             # future SQLite / vector / graph stores
    +-- scripts/                   # dev server + smoke check
    +-- app/
    |   +-- main.py  config.py  deps.py  security.py
    |   +-- api/                   # health, config, jobs, wiki, files, search, graph, links, eval
    |   +-- core/                  # settings, logging, errors, ids
    |   +-- gateway/               # LLM, embeddings, rerank, cache, capabilities
    |   +-- stores/                # sqlite, vector, graph + interfaces.py
    |   +-- pipelines/             # wiki, docs, extraction, resolution, linking, retrieval
    |   +-- jobs/                  # queue, runner, stages
    |   +-- schemas/               # shared Pydantic models
    +-- tests/
        +-- unit/  integration/  fixtures/

Only the wiki/theories flow is implemented so far. The other packages are
scaffolding for the increments described in `../docs/plan`.

## Running (development)

Uses the existing `poc-backend` conda environment (tiktoken is installed there).

    scripts/dev.sh          # serves on 127.0.0.1:8766 with --reload

The Tauri frontend talks to `http://127.0.0.1:8766` (see `../src/lib/backend.js`).

## Data

Scraped theories land in `data/theories/`, which is git-ignored because it can
be regenerated with a hydration run:

    data/
    +-- theories/
    |   +-- Absorptive_capacity_theory_20261028T164500Z.html
    |   +-- Activity_Theory_20261028T164500Z.html
    +-- theories_index.json      # per-run metadata (titles, URLs, tokens)

- One file per theory, named `<slug>_<run timestamp>.html`.
- Each "Hydrate" run gets a new timestamp, so previous versions are kept.
- `theories_index.json` records what was scraped per run (last 20 runs).

Small sample wiki HTML and a sample PDF for tests live in `tests/fixtures/` and
are committed, unlike the runtime `data/` tree.

## API

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Status + file count |
| POST | `/v1/theories/hydrate` | Start a background scrape (202, returns `job_id`) |
| GET | `/v1/theories/jobs/{job_id}` | Job status: `stage`, `progress`, `detail`, `result` |
| GET | `/v1/theories` | All theories (latest file each) with title, url, file, tokens |
| GET | `/v1/theories/{slug}` | One theory incl. the stored `bodyContent` HTML fragment |

Token counts use tiktoken (`cl100k_base` by default, `THEORIES_TIKTOKEN_ENCODING`).

## Tests

    conda run -n poc-backend python -m pytest

Unit tests cover the wiki scraper and the in-memory job queue. Integration
tests exercise the API against a temporary data directory (no network needed).

## Notes for the future sidecar

When bundled as a Tauri sidecar, the app will be spawned by the desktop app
instead of started manually. Keep in mind:

- The port is configurable (`THEORIES_PORT`); pin it so the frontend
  `BACKEND_URL` constant in `../src/lib/backend.js` stays correct.
- Data is written under `<src-backend>/data` by default (`THEORIES_DATA_DIR`
  overrides); point it at the Tauri app data dir for production.
- The process is a single uvicorn instance; no state other than `data/`.
