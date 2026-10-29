# 11 - Cross-group linking (Findings <-> Theory)

## Objective
Propose typed, evidenced links between Group B findings and Group A claims/theories/constructs, to surface support, contradiction, extension, refinement.

## Taxonomy
`SUPPORTS, CONTRADICTS, EXTENDS, REFINES, INSTANTIATES, UNRELATED` (UNRELATED is not stored as an edge; counted for stats).
- SUPPORTS: finding confirms a proposition. CONTRADICTS: finding conflicts. EXTENDS: adds a construct/relationship/context not in the theory. REFINES: adds boundary condition/moderator/narrower scope. INSTANTIATES: concrete case/example.
Link targets: `Claim` (preferred), else `Theory` or `Construct` when no claim fits.

## Stage 1 - candidate generation (`link_candidates`, no LLM)
For each Finding f:
1. Embedding kNN over `claim` vectors (k=20) and `theory_card` vectors (k=5).
2. Shared constructs: claims connected to the same Construct node(s) as f (via `MENTIONS`).
3. Graph neighbours: claims of theories adjacent (1 hop) to f's constructs.
4. Union, dedupe, cap 30; compute `candidate_score` = weighted(sim, shared_construct_count, hop proximity).
5. Rerank with cross-encoder (`Reranker`) -> keep top `M` (default 8). 
Findings with no candidate above threshold are recorded as `orphan` (feeds "possibly novel" in Discoveries).

## Stage 2 - classification (`link_classify`) with `linking` role
Prompt input: finding text + its chunk context (+ doc metadata: type, year), claim text + theory name + theory description excerpt + the claim's constructs/polarity.
Output schema:
```python
class LinkJudgement(BaseModel):
    label: Literal["SUPPORTS","CONTRADICTS","EXTENDS","REFINES","INSTANTIATES","UNRELATED"]
    confidence: float          # 0-1
    rationale: str             # <= 60 words
    finding_evidence: str      # verbatim substring of finding chunk
    claim_evidence: str        # verbatim substring of claim/theory text
    new_constructs: list[str]  # for EXTENDS/REFINES
    scope_note: str | None     # boundary conditions, e.g. context/population
```
Controls:
- Evidence substrings validated (as in 08); invalid -> retry once -> drop.
- **Two-pass escalation**: pass 1 with short texts; if confidence < 0.7 or label in {CONTRADICTS, EXTENDS} -> pass 2 with full chunk + theory description.
- **Order-robustness**: run CONTRADICTS/SUPPORTS decisions with a second prompt variant (negated framing); disagreement -> confidence *= 0.5 and `flags=['unstable']`.
- Optional cheap NLI pre-filter via OpenAI-compatible endpoint is NOT assumed; skip unless configured later.
- Rate/limits: concurrency from config, token budget, cache.
Persist to `links` (status `proposed`) + graph edge of the label type between Finding and Claim/Theory (`props: link_id, confidence, status`). Also create `EXTENDS`-derived suggestions: `new_constructs` stored in `link_suggestions` (kind='new_construct').
Idempotency: unique key (finding_id, target_id, prompt_version, model); re-run updates only if inputs changed; **never overwrite a user-reviewed link status**.

## Stage 3 - aggregates (`link_discoveries`)
Compute per theory and per document: counts by label, contradiction hot-spots (theory claims with >=1 contradiction), orphan findings, new-construct suggestions clustered by embedding similarity, "unexpected" links (cross-area/different construct neighbourhood). Store in `discoveries(discovery_id, kind, score, payload_json, created_at)`.

## API
- `POST /api/links/run` {scope: all|doc_ids|theory_ids, only_new: true} -> job.
- `GET /api/links?label&status&min_conf&doc_id&theory_id&sort&page`
- `GET /api/links/{id}` full detail (both evidence, both sources, locators, flags).
- `PATCH /api/links/{id}` {status: accepted|rejected|proposed, label?, note?} (user override sets `reviewed_at`; graph edge synced).
- `POST /api/links` manual link creation by the researcher.
- `GET /api/discoveries?kind=`.

## Tests
FakeLLM scripted judgements; assert candidate generation recall on a fixture with known gold pairs (>= 90%); validation/retry; escalation path; idempotency and protection of reviewed links; graph edges mirror links; aggregates correct.

## Acceptance
On fixtures (a theory with 3 claims, 2 research docs with scripted findings) the pipeline produces expected labelled links visible via API and as edges in the graph.
