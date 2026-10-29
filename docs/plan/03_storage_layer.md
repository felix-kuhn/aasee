# 03 - Storage layer (SQLite, LanceDB, Graph) with interfaces

## Objective
Stable persistence with migrations and swappable store implementations. No pipelines yet.

## SQLite schema (migration 0001)
```
documents(doc_id PK, source_group TEXT CHECK IN ('A','B'), doc_type TEXT, title, path, content_hash, parser_version, status, metadata_json, created_at, updated_at)
sections(section_id PK, doc_id FK, field_key TEXT NULL, heading_path TEXT, ordinal, raw_text)
chunks(chunk_id PK, doc_id FK, section_id FK NULL, ordinal, text, heading_path, token_count, page_start, page_end, bbox_json, speaker, kind TEXT, metadata_json)
theories(doc_id PK FK, name, acronym, aliases_json, originating_area, level_of_analysis_json, gregor_type, last_updated_text, card_json)
constructs(construct_id PK, canonical_name, aliases_json, description NULL, created_by)
claims(claim_id PK, doc_id FK, chunk_id FK, text, kind, constructs_json, polarity, confidence, model, prompt_version)
findings(finding_id PK, doc_id FK, chunk_id FK, text, kind, constructs_json, polarity, evidence_span, confidence, model, prompt_version)
references(ref_id PK, doi, title, authors_json, year, raw)
links(link_id PK, source_type, source_id, target_type, target_id, label, confidence, rationale, source_evidence, target_evidence, status DEFAULT 'proposed', model, prompt_version, created_at, reviewed_at, reviewer_note)
jobs(job_id PK, kind, status, params_json, progress REAL, message, created_at, started_at, finished_at, error)
job_items(item_id PK, job_id FK, doc_id, stage, status, error, updated_at)
doc_stage_status(doc_id, stage, status, fingerprint, updated_at, PRIMARY KEY(doc_id,stage))
settings(key PK, value_json)
llm_cache(...)  usage(...)
index_meta(key PK, value_json)   -- embedding fingerprint, dimensions, schema versions
```
FTS5 virtual table `chunks_fts` mirrored by triggers (used for debug/fallback search).
Enable `PRAGMA journal_mode=WAL; foreign_keys=ON`. Migration runner applies `migrations/NNNN_*.sql` in order, records in `schema_migrations`.

## Interfaces (`stores/interfaces.py`)
```python
class VectorStore(Protocol):
    def ensure(self, dim:int, fingerprint:str)->None
    def upsert(self, rows: list[VectorRow])->None        # id, vector, text, doc_id, source_group, kind, heading_path, metadata
    def delete_by_doc(self, doc_id:str)->None
    def search_dense(self, vec, k, filters)->list[Hit]
    def search_fts(self, query, k, filters)->list[Hit]
    def search_hybrid(self, vec, query, k, filters)->list[Hit]  # RRF inside
    def count(self)->int; def drop(self)->None
class GraphStore(Protocol):
    def init_schema(self)->None
    def upsert_node(self, label:str, id:str, props:dict)->None
    def upsert_edge(self, rel:str, src:(str,str), dst:(str,str), props:dict)->None
    def delete_by_doc(self, doc_id)->None
    def neighbors(self, node_id, depth, rel_filter, node_filter, limit)->Subgraph
    def get_node(id); get_edge(id); search_nodes(q, limit); shortest_path(a,b)
    def query_readonly(self, cypher:str, params)->list[dict]   # validated read-only
    def stats(self)->dict
```
Collections: `vectors` table in LanceDB `<data>/lancedb`; graph DB at `<data>/graph/`.

## Implementations
- `LanceVectorStore`: table with fixed-size-list vector column, FTS index on `text` (re-create index after batched writes), ANN index created when rows > threshold (config), metadata filter via SQL-where strings built from a whitelist (no string concatenation of user input without escaping). RRF fusion helper `fuse(rankings, k=60)` in `retrieval/fusion.py` (pure function, unit-tested).
- `LadybugGraphStore`: node tables `Theory, Claim, Construct, Article, Finding, Document, Community`; rel tables per `05/08/11` docs. Because the engine is a fork of Kuzu, rel tables need fixed FROM/TO pairs - declare them in a single `GRAPH_SCHEMA` constant and generate DDL. Read-only validation: reject any query containing CREATE/MERGE/SET/DELETE/DROP/COPY/CALL(write) tokens.
- `InMemoryGraphStore` (networkx-based) implementing the same Protocol, used for tests and as an emergency fallback. Run the SAME contract test-suite (`tests/contract/test_graph_store.py`) against both implementations.
- Same for `InMemoryVectorStore` (numpy) vs Lance.
- `rebuild.py`: `rebuild_vectors()` and `rebuild_graph()` read SQLite and repopulate (stubs call pipelines later; for now implement with whatever tables exist).
- Dependency wiring in `deps.py`: factories chosen by `settings.store_backend` env/config.

## API
`GET /api/stores/status` -> counts, embedding fingerprint, graph stats, schema versions.

## Tests
Migration idempotency; contract tests for both stores (upsert idempotent, delete_by_doc, filters, neighbors depth, read-only guard); RRF unit tests; fingerprint mismatch raises `IndexStaleError`.

## Acceptance
Stores initialise at startup in a fresh data dir; status endpoint works; contract suite green for real and in-memory implementations.
