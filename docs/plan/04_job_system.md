# 04 - Job system (resumable pipelines)

## Objective
Long-running ingestion/extraction runs as resumable background jobs with progress streaming. Single writer.

## Design
- One `JobRunner` background task (asyncio) started at app startup; processes jobs sequentially, items concurrently up to `concurrency`.
- Job kinds registered in a registry: `Stage` objects with `name`, `depends_on`, `run(ctx, doc_id)`, and `fingerprint(ctx, doc_id)` (hash of inputs + parser/prompt/model versions). A stage is skipped when `doc_stage_status.fingerprint` matches and status = done. This gives resumability and incremental re-runs.
- Stage names (implemented over later increments): `wiki_parse, wiki_chunk, embed, theory_claims, graph_structural, doc_parse, doc_chunk, findings, resolve_entities, link_candidates, link_classify`.
- Cancellation: `POST /api/jobs/{id}/cancel` sets flag checked between items. Pause/resume optional.
- Failure policy: item-level failures are recorded in `job_items` and do not stop the job; job ends `completed_with_errors`. Retry endpoint `POST /api/jobs/{id}/retry-failed`.
- Startup recovery: jobs left `running` are set `interrupted` and can be resumed.
- Progress streaming: `GET /api/jobs/{id}/events` (SSE) emits `{progress, message, item}`; `GET /api/jobs` list; `GET /api/jobs/{id}`.
- Dev-only demo stage `noop_sleep` to make the system testable now.

## Frontend
"Jobs" drawer/page: list, progress bars via SSE, errors per item, cancel/retry buttons.

## Tests
Stage skipping by fingerprint; resume after simulated crash (kill runner mid-job, restart); cancellation; SSE emits ordered events; failure isolation.

## Acceptance
Run demo job from UI, watch progress, cancel it, restart backend and resume it.
