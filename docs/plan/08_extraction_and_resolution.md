# 08 - Claim/finding extraction and entity resolution

## Objective
Create atomic Claims (A) and Findings (B), extract constructs, and normalise constructs across both groups into a connected graph.

## Ontology (`schemas/ontology.py`, user-extensible via JSON file in data dir)
Node types: Theory, Claim, Construct, Article, Finding, Document, Community. Claim/Finding `kind` enums: `proposition, hypothesis, finding, definition, quote, method, limitation`. Relation polarity: `positive, negative, mixed, none`. Config `ontology.json` lets the user add construct categories and relation types without code changes.

## Extraction (`pipelines/extraction/`)
1. **Theory claims** stage `theory_claims`: per theory `description` chunk(s) (group A), schema:
```python
class ExtractedClaim(BaseModel):
    text: str                   # self-contained, decontextualised, max ~40 words
    kind: Literal[...]
    constructs: list[str]       # surface forms
    relations: list[ConstructRelation]   # {source, target, type: INFLUENCES|MODERATES|MEDIATES|PART_OF|DEFINES, polarity}
    evidence_span: str          # verbatim substring of the chunk
```
Validation: `evidence_span` must be a substring (fuzzy >= 90) of the chunk text, else drop/ retry once. Deduplicate near-identical claims by embedding similarity (>0.95).
2. **Findings** stage `findings` (group B): same schema + `finding`-oriented prompt (empirical results, interview statements about phenomena, hypotheses tested, limitations). Skip bibliography/front matter/boilerplate chunks. Interview findings record `speaker` and are flagged `kind=quote|finding`. Limit per chunk (max 8). Prompts versioned; instructions: "decontextualise pronouns, keep qualifiers/negations, do not invent."
3. All extraction uses the `extraction` role, caching enabled, concurrency-limited, token budget aware.
4. Store to `claims` / `findings`, embed their text into the vector store as `kind='claim'|'finding'` (separate rows so claim-level search works).
5. Graph write: `Claim`/`Finding` nodes; edges `ASSERTS` (Theory->Claim), `ASSERTS_FINDING`(Document->Finding), `MENTIONS` (Claim/Finding->Construct), `INFLUENCES|MODERATES|MEDIATES` (Construct->Construct with `{polarity, claim_id}`), `HAS_COMPONENT` (Theory->Construct/SubConcept), `EXTENDS|DERIVED_FROM|CONTRASTS_WITH` (Theory->Theory, only when explicitly stated).

## Entity resolution (`pipelines/resolution/`) stage `resolve_entities`
Three steps, auditable:
1. **Normalise**: lowercase, strip, lemma (spaCy-free simple rules or `simplemma`), remove determiners, expand known acronyms from theory cards (e.g. "TAM", "RT").
2. **Candidate pairs**: embedding kNN (cosine >= 0.82) + string similarity (rapidfuzz >= 90) + shared acronym.
3. **Decision**: exact/alias match auto-merge; fuzzy candidates go to the `extraction` LLM with a yes/no + canonical-name schema (batch 10 pairs per call). Output `merge`, `separate`, or `broader/narrower` (create `BROADER_THAN` edge instead of merging).
Rules: never merge silently - write `construct_merge_log(construct_id_from, to, method, score, model, decided_at)`; merges are reversible via `POST /api/constructs/{id}/split`. Support manual merge/rename/split via API + UI. Constructs keep `aliases_json` and `source_counts{A,B}`.

## API
`GET /api/constructs` (search, paging, counts per group), `GET /api/constructs/{id}`, `POST /api/constructs/merge`, `POST /api/constructs/{id}/split`, `GET /api/claims?doc_id=`, `GET /api/findings?doc_id=`, `POST /api/extract/run` (job with scope: group, doc ids).

## Frontend
Library views get "Claims"/"Findings" tabs per document with evidence highlighting; Constructs page with merge/split UI and merge-log.

## Tests
FakeLLM returns scripted JSON for fixture chunks; test evidence-span validation, retry on invalid JSON, dedupe, caching (second run makes zero LLM calls), resolution merges + reversal, graph node/edge counts, idempotent re-run.

## Acceptance
Run extraction on fixtures with FakeLLM; Constructs page shows merged constructs shared by A and B; graph contains Claim/Finding/Construct nodes.
