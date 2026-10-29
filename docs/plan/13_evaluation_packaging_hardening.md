# 13 - Evaluation, packaging, hardening

## Evaluation harness (`apps/backend/app/eval` + Eval page)
- Gold-set format (JSONL in data dir): retrieval items `{query, relevant_chunk_ids|doc_ids}`; link items `{finding_id, target_id, label}`.
- UI to build gold data: mark search results relevant; mark reviewed links as gold (accepted/rejected/changed label become labelled data automatically).
- Metrics: retrieval recall@k, MRR, nDCG for variants {dense, bm25, hybrid, hybrid+rerank, +graph}; citation validity rate; link classification precision/recall/F1 per label and confusion matrix; candidate-generation recall; cost (tokens) and latency.
- `POST /api/eval/run` job produces a stored report (JSON + Markdown) and a comparison table in UI, so the researcher can show whether the graph helps.

## Hardening
- Backup/restore: `POST /api/backup` zips SQLite + library + parsed data (not derived indexes); restore triggers `rebuild_vectors()` / `rebuild_graph()`.
- Index consistency check: `GET /api/diagnostics` verifies counts SQLite vs Lance vs graph, orphan rows, stale fingerprint; "Repair" runs rebuild.
- Graceful shutdown: runner finishes current item, flushes stores; Tauri kills sidecar tree on exit (Windows/macOS).
- Concurrency: single writer enforced with a file lock in the data dir (prevents two app instances corrupting stores).
- Security: token auth, loopback bind only, strict CORS, path-traversal guards on file endpoints, size limits for uploads, sanitise HTML shown in the UI (DOMPurify; render wiki HTML in a sandboxed iframe), no secrets in logs, API key only via keychain.
- Memory: lazy imports for heavy libs (Docling); parse documents in a subprocess pool with timeout; cap batch sizes.
- Privacy/offline UX: banner when any model endpoint host is not loopback/private; setting "block non-local endpoints".
- Error UX: global error boundary, toast mapping from API error codes, "Copy diagnostics" button (redacted).
- i18n: UI strings via `i18next` (EN, DE); prompts accept `output_language` setting.
- Performance checks: ingest 200 PDFs synthetic benchmark, graph explorer with 10k nodes / 30k edges (filtered views), search P95 latency < 500 ms excluding LLM/rerank.

## Packaging
- Backend: PyInstaller spec (hidden imports for lancedb, ladybug, docling; data files for models if bundled); smoke test script launching the binary with `--port 0` and calling `/api/health`.
- Tauri: `externalBin` sidecar for macOS arm64/x64 (and Windows/Linux if needed), code signing/notarisation notes in `docs/RELEASE.md`.
- Docling models: first-run downloader with progress UI, or bundle; document `HF_HUB_OFFLINE=1` handling for pure offline use.
- Versioned data directory with migration on upgrade; crash-safe.
- CI: build matrix, run full test suite, produce artifacts.

## Docs
`README.md` (setup, dev, build), `docs/ARCHITECTURE.md` (diagram + data model), `docs/PROMPTS.md` (all prompts + versions), `docs/USER_GUIDE.md` (workflow: import wiki folder -> index -> add documents -> extract -> link -> review), `docs/TROUBLESHOOTING.md`.

## Final acceptance (whole system)
1. Fresh install -> configure endpoints -> Test passes.
2. Import wiki folder -> parse report -> index -> theories searchable and in graph.
3. Add PDFs/DOCX/TXT -> parsed, chunked, embedded.
4. Extract claims/findings, resolve constructs.
5. Run linking -> Discoveries populated -> review links -> accepted links appear in graph.
6. Chat answers with valid citations from both groups; graph navigable with sources.
7. Eval report generated; backup/restore works; packaged app runs offline against a local endpoint.
