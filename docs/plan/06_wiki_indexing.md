# 06 - Wiki indexing: chunks, embeddings, structural graph

## Objective
Make Group A searchable (vector + BM25) and put its structure into the graph. LLM used only for embeddings and (optionally) later claim extraction (08).

## Chunk strategy (`pipelines/wiki/chunk.py`)
Per theory produce chunks of `kind`:
- `theory_card`: one compact text: name, acronym, aliases, area, level, independent/dependent constructs, first ~2 sentences of description. 
- `description`: paragraph-based, target 200-400 tokens, merge short consecutive paragraphs, split long ones at sentence boundaries with 1-sentence overlap. Prefix every chunk text for embedding with `"{Theory name} > {heading_path}\n"` (stored `text` keeps prefix separately in `embed_text`).
- `constructs`: one chunk listing independent/dependent constructs (if present).
- `reference`: NOT embedded; stored only in `references`.
Token counting via `tiktoken` (cl100k fallback) or a char heuristic; make counter pluggable.

## Embedding stage (`embed`)
- Uses `Embedder` (document kind). Batches; skips chunks whose `embed_text` hash is unchanged. `index_meta.embedding_fingerprint` is checked: if it differs from the current config -> API returns `409 index_stale` with a button "Re-embed all" (drops table, re-creates with new dim, re-embeds everything).
- Upsert to `VectorStore` with `source_group='A'`, `kind`, `doc_id`, `heading_path`.

## Structural graph stage (`graph_structural`) - no LLM
Nodes: `Theory{id,name,acronym,gregor_type,area,url}`, `Construct{id,canonical_name}` (provisional normalisation: lowercase, strip, collapse whitespace, singularise trivial plurals; full resolution in 08), `Article{id,doi,title,year,raw}`, `Discipline`, `Level`.
Edges: `HAS_INDEPENDENT_CONSTRUCT`, `HAS_DEPENDENT_CONSTRUCT`, `ALSO_KNOWN_AS`(Theory->Alias as property list, no node), `RELATED_TO`(Theory->Theory, only when resolved), `USES_THEORY`(Article->Theory), `SEMINAL_FOR`(Article->Theory), `AT_LEVEL`, `ORIGINATES_IN`, `OF_TYPE`. All edges carry `{doc_id, source:'parsed', created_at}`.
Idempotent upsert; `delete_by_doc` removes edges owned by that doc.

## API
- `POST /api/index/wiki` -> job (stages `wiki_chunk`, `embed`, `graph_structural` for all parsed theories or a subset).
- `GET /api/chunks/{chunk_id}` (text, provenance, neighbours).
- `GET /api/stores/status` shows counts per group.
- `POST /api/search/debug` {query, mode: dense|bm25|hybrid, group?} -> hits (basic, no rerank yet). 

## Frontend
Library > Theories: "Index" button with job progress; Search Debug page with mode selector and hit list (score, group, kind, snippet).

## Tests
Chunker properties (no chunk > max tokens, no lost text, deterministic); embed idempotency; graph counts on fixture (e.g. N theories -> N Theory nodes, edges match parsed constructs); stale-index flow with FakeEmbedder of a different dimension.

## Acceptance
After indexing fixtures, debug search returns relevant theories for sample queries (FakeEmbedder: lexical test via BM25 mode), counts visible in status page.
