# 09 - Retrieval, reranking and answer generation

## Objective
Hybrid + graph-augmented retrieval with RRF fusion, reranking, group-aware quotas, and cited streamed answers.

## Retrieval pipeline (`pipelines/retrieval/`)
Input `SearchRequest{query, groups: ['A','B'], k, mode: 'auto'|'local'|'global'|'relational', filters{doc_ids, doc_types, tags}, rerank: bool, expand_graph: bool}`.
1. **Query analysis** (optional LLM, cached): rewrite to standalone query, extract construct/theory mentions, detect intent (factual, relational, thematic).
2. **Dense + BM25 hybrid** per group (separate calls so quotas apply), candidate pool 50 each (`search_hybrid`).
3. **Entity linking**: match query mentions to Construct/Theory nodes (alias exact, then embedding on node names). 
4. **Graph expansion**: neighbourhood (depth 1-2, relation whitelist per intent) -> collect chunk_ids via provenance of nodes/edges, claims, findings. Score = `0.5^hop`.
5. **Fusion**: RRF over [dense/bm25 results, graph-derived chunks]. Weights configurable.
6. **Rerank** top 50 -> `top_n` through `Reranker`; failure falls back to fused order (log warning).
7. **Group quotas**: ensure at least `min_per_group` results from each requested group in final context.
8. **Small-to-big**: replace/expand chunk with its parent section text within token budget.
9. **Global mode**: if communities exist (see 10), include community summaries.
Optional `text_to_cypher` tool for structured questions: LLM generates Cypher against a schema description, validated read-only (store guard from 03), executed with timeout and row cap; failures silently ignored.

## Answering
- `POST /api/answer` (SSE): builds context with numbered sources `[1]..[n]`, system prompt demands citations only to provided sources, answers in the user's language, states insufficient evidence honestly. Uses `chat` role (+ its configured system instructions).
- Post-validation: every citation index must exist; strip/flag invalid ones. Emit SSE events: `token`, `sources` (chunk_id, doc title, group, page, locator), `subgraph` (nodes/edges used), `done`.
- Conversations: `conversations`, `messages` tables; follow-up queries use rewrite step.

## Search API
`POST /api/search` returns hits with `score_components{dense,bm25,graph,rerank}` for transparency.

## Frontend
- Search page: query box, group toggles (A/B), mode selector, results list with group colour, snippet, score details popover, "open source" (viewer), "show in graph".
- Chat page: streaming answer with clickable citation chips opening the source viewer; "Used subgraph" button opening Graph Explorer filtered to that subgraph.

## Tests
RRF correctness; quota enforcement; rerank fallback; citation validation; SSE protocol test; graph expansion on fixture graph; end-to-end with Fake* components.

## Acceptance
Ask a question over fixtures: answer streams, citations open correct sources, results include both groups when requested.
