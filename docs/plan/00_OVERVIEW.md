# 00 - Overview, conventions, definition of done

Read this file before every increment. It applies to all other plan files.

## Goal
Offline-capable desktop research app. Tauri (Rust shell) + React (TypeScript) UI + Python FastAPI sidecar.
Two source groups are indexed and linked:
- **Group A (theory)**: locally stored HTML files from the MediaWiki https://is.theorizeit.org (one folder, user-selected).
- **Group B (research data)**: user-provided PDF / DOCX / TXT / MD files (papers, interviews, memos).
The app finds links (SUPPORTS, CONTRADICTS, EXTENDS, REFINES, INSTANTIATES) between Group B findings and Group A theory claims and shows them to the researcher for review.

## Existing project constraints (MANDATORY)
The Tauri app and backend already exist. Extend them; do not replace or re-scaffold what is there.

### Backend environment
- The ENTIRE backend uses the existing conda environment **`poc-backend`**. Do not create a new venv, conda env, poetry env or Docker image.
- Run every backend command inside it: `conda activate poc-backend`, or non-interactively `conda run -n poc-backend --no-capture-output <cmd>`.
- Install packages with `conda run -n poc-backend python -m pip install ...` (prefer conda-forge via `conda install -n poc-backend -c conda-forge ...` only when a package needs native builds). Never install into the base env or system Python.
- Record every added dependency in `apps/backend/requirements.txt` (or the existing `pyproject.toml`/`environment.yml`, whichever already exists) with pinned versions, and keep that file in sync after each increment. Check the existing Python version in the env first (`conda run -n poc-backend python --version`) and do not change it; pick library versions compatible with it.
- All scripts (`scripts/ci.sh`, test commands, dev start, PyInstaller build) must call tools through `conda run -n poc-backend` (or assume the env is active) and say so in their header.
- Tauri dev mode: the Rust side starts the backend with the env's interpreter. Resolve the interpreter path from config/env var `POC_BACKEND_PYTHON` (default: output of `conda run -n poc-backend python -c "import sys;print(sys.executable)"`) instead of relying on `python` in PATH. Production build bundles the sidecar via PyInstaller built inside this env.
- Before the first increment, verify the env: list installed packages (`conda list -n poc-backend`), and reuse what is already there (e.g. fastapi, uvicorn, pydantic) instead of reinstalling or upgrading.

### Frontend: shadcn/ui + Tailwind (existing setup)
- The frontend already uses **shadcn/ui and Tailwind CSS**. ALL new UI must use them. Do not introduce another component library (no MUI, Ant, Chakra, Mantine, Bootstrap) and no CSS-in-JS or CSS modules.
- Inspect the existing `components.json`, `tailwind.config.*`, `globals.css`, the `@/` path aliases, the `cn()` helper in `lib/utils`, and the theme variables. Follow the existing conventions (file locations, naming, dark mode handling, icon library - lucide-react if already used).
- Add components with the shadcn CLI (`npx shadcn@latest add <component>`) into the existing `components/ui` folder; reuse components that already exist. Likely needed: button, input, textarea, label, select, checkbox, switch, slider, tabs, table, card, badge, dialog, sheet, drawer, dropdown-menu, context-menu, popover, tooltip, command (search/autocomplete), toast/sonner, progress, scroll-area, resizable (split panes), separator, skeleton, alert, form (react-hook-form + zod), sidebar, breadcrumb, toggle-group, accordion, hover-card.
- Style with Tailwind utility classes and the theme's CSS variables (`bg-background`, `text-muted-foreground`, `border`, ...). No hard-coded hex colours in components. Where categorical colours are needed (graph node groups/types, link labels, status chips), define them once as CSS variables / a Tailwind-compatible palette in a single `lib/palette.ts` + `globals.css` so light/dark both work, and reuse them in Sigma.js (read computed CSS variables at runtime).
- Forms: shadcn `Form` with react-hook-form and zod schemas mirroring the backend Pydantic models.
- Layout/pages use shadcn patterns (Sidebar, Resizable panels, Sheet for detail panels, Dialog for confirmations). Icons from the project's existing icon set.
- Non-shadcn libraries are allowed only for things shadcn does not cover (Sigma.js/graphology for the graph canvas, pdfjs-dist for the PDF viewer, TanStack Query/Zustand for state); wrap their surrounding UI (toolbars, panels, legends, filters) in shadcn components.
- Every UI increment must also pass: `npm run lint`, `npm run build` (tsc), `npm run test`. Verify light and dark mode visually (no unreadable contrast) and keyboard accessibility.

## Stack (verify current versions on PyPI/npm, then PIN them in lockfiles)
| Concern | Choice |
|---|---|
| Backend | Python 3.11+, FastAPI, uvicorn, Pydantic v2, SQLAlchemy 2 or plain sqlite3 + hand-written migrations |
| Metadata/truth store | SQLite (WAL mode) |
| Vector + BM25 | LanceDB (embedded) |
| Graph | LadybugDB (embedded fork of Kuzu; Cypher). Fallback: ArcadeDB embedded. ALWAYS behind `GraphStore` interface. Verify the exact PyPI package name and Python API in its docs before coding |
| LLM/embeddings | `openai` SDK with custom `base_url` (OpenAI-compatible endpoints only) |
| Reranker | configurable `/rerank` HTTP endpoint (Cohere/Jina style) OR LLM pointwise fallback OR none |
| HTML parsing | beautifulsoup4 + lxml, rapidfuzz |
| PDF/DOCX | Docling (fallback PyMuPDF/pdfplumber for clean text PDFs, python-docx for DOCX) |
| Frontend | React 18 + TypeScript + Vite, TanStack Query, Zustand, Tailwind (or CSS modules), Sigma.js + graphology + @react-sigma/core, graphology-layout-forceatlas2 (web worker), graphology-communities-louvain optional |
| Tests | pytest, pytest-asyncio, httpx; Vitest + React Testing Library; Playwright optional |
| Packaging | PyInstaller (or Nuitka) sidecar, Tauri bundler |

## Repo layout (create in increment 01)
```
proof-of-concept/
  README.md
  docs/plan/                 # these md files
  src-tauri/
  src/ (features/, api/, components/, store/)
  src-backend/
    pyproject.toml
    data/ (small sample wiki HTML + sample PDFs for tests, database files)
      theories/
      databases/
    scripts/
    app/
      main.py  config.py  deps.py  security.py
      api/ (routers: health, config, jobs, wiki, files, search, graph, links, eval)
      core/ (settings, logging, errors, ids)
      gateway/ (llm_client.py, embeddings.py, rerank.py, cache.py, capabilities.py)
      stores/ (sqlite/, vector/, graph/ + interfaces.py)
      pipelines/ (wiki/, docs/, extraction/, resolution/, linking/, retrieval/)
      jobs/ (queue.py, runner.py, stages.py)
      schemas/ (pydantic models shared with the API)
    tests/ (unit/, integration/, fixtures/)
```

## Global rules for the coding agent
1. **Every increment must end in a runnable state**: `pytest` green, `ruff` + `mypy` (or pyright) clean, `npm run build` + `npm run test` green, app starts with `npm run tauri dev` (or backend alone with `uvicorn`). Do not leave TODO stubs that raise at import time. Unfinished features are hidden behind feature flags or not yet routed.
2. **No network access in tests.** Mock the LLM gateway with a deterministic fake (`FakeLLM`, `FakeEmbedder`, built in increment 02 and reused afterwards).
3. **Stable IDs**: `doc_id`, `chunk_id`, `node_id` are UUIDv5/ULID or content-hash based so re-ingestion is idempotent.
4. **Provenance everywhere**: every graph node/edge and every vector row stores `chunk_id` (or `doc_id`) and extraction metadata (`model`, `prompt_version`, `created_at`).
5. **Derived stores are rebuildable** from SQLite: provide `rebuild_vector_index()` and `rebuild_graph()` functions.
6. **Single writer** for LanceDB and the graph DB: only the job runner process/thread writes; API handlers read.
7. **Secrets**: never log or return API keys. Redact in logs by a logging filter.
8. **Prompts** live in `app/pipelines/**/prompts/*.md|py` with a `PROMPT_VERSION` constant; changing a prompt bumps the version (cache key includes it).
9. **Errors**: uniform JSON error `{code, message, details}`; frontend shows toasts.
10. **Migrations**: SQLite schema changes only via numbered migration files; the app applies them at startup.
11. After each increment, update `docs/CHANGELOG.md` and tick the checklist in that increment's file.
12. Commit per increment; tag `inc-NN`.

## Increment order (each file is one increment)
01_scaffold -> 02_config_and_llm_gateway -> 03_storage_layer -> 04_job_system -> 05_wiki_parser -> 06_wiki_indexing -> 07_document_ingestion -> 08_extraction_and_resolution -> 09_retrieval_and_answering -> 10_graph_api_and_explorer -> 11_linking_pipeline -> 12_review_and_discoveries_ui -> 13_evaluation_packaging_hardening

## Domain glossary
- **Theory card**: parsed record of one wiki page.
- **Claim**: atomic proposition extracted from a theory description (Group A).
- **Finding**: atomic claim/result extracted from a research document (Group B).
- **Construct**: normalised concept (e.g. "perceived usefulness"), shared across theories and findings.
- **Link**: typed edge Finding -> Claim/Theory/Construct with confidence, rationale, evidence, review status.
