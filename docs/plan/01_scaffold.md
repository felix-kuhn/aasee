# 01 - Scaffold: Tauri + React + FastAPI sidecar

## Objective
A running desktop shell whose React UI calls an authenticated FastAPI backend and shows backend health.

## Tasks
1. Create repo layout from `00_OVERVIEW.md`.
2. **Backend**
   - `pyproject.toml` with deps; `app/main.py` creates FastAPI app with `create_app()` factory.
   - CLI entry: `python -m app --port 0 --token <T> --data-dir <path>`; port 0 = pick free port, print one JSON line `{"port": N}` to stdout once ready.
   - `security.py`: dependency requiring header `Authorization: Bearer <token>` on all routes except none (health also protected). CORS: allow only the Tauri/Vite origins (`tauri://localhost`, `http://localhost:1420`, `http://tauri.localhost`).
   - `GET /api/health` -> `{status, version, data_dir}`.
   - Structured logging (JSON) to `<data-dir>/logs/app.log` with secret-redaction filter.
   - Uniform error handler (see global rule 9).
3. **Tauri**
   - Rust side: command `start_backend` spawns the Python process (dev: `python -m app`; prod: sidecar binary via `tauri.conf.json > externalBin`), generates a random token, reads the port line, exposes `get_backend_info()` -> `{baseUrl, token}` to the frontend; kills the child on exit.
   - Restrict the Tauri HTTP scope to `127.0.0.1`.
4. **Frontend**
   - `api/client.ts`: fetch wrapper using baseUrl + token, typed errors, SSE helper.
   - App shell with sidebar routes (Library, Search, Graph, Links, Settings) as placeholder pages; a status badge showing backend health via TanStack Query.
5. Tooling: ruff, mypy, pytest, eslint, prettier, Vitest; GitHub-Actions-style CI script `scripts/ci.sh` running everything.

## Tests
- pytest: health returns 200 with token, 401 without; port-0 startup prints JSON line (subprocess test).
- Vitest: client attaches the token; health badge renders ok/error states (mock fetch).

## Acceptance
- `npm run tauri dev` opens the window, badge shows "Backend OK".
- `scripts/ci.sh` passes.
