# 05 - Wiki HTML parser (Group A, parse only)

## Objective
Turn the locally stored theory HTML files into validated `TheoryCard` JSON. No LLM required for the deterministic path. Based on observed page structure: MediaWiki page with labelled sections (Acronym; Alternate name(s); Main dependent construct(s)/factor(s); Main independent construct(s)/factor(s); Concise description of theory; Diagram/schematic of theory; Originating author(s)/seminal articles; Originating area; Level of analysis; Links to other theories; IS articles that use the theory; Contributor(s); Date last updated). Pages vary: some fields are "N/A" or missing, constructs may be inside diagrams, descriptions are prose with sub-headings. The folder is user-selected; the app never crawls.

## Tasks
1. `POST /api/wiki/scan` {folder} -> lists `*.html`, hashes, counts; registers documents (`source_group='A'`, `doc_type='theory'`), idempotent via content_hash.
2. `pipelines/wiki/clean.py`: strip MediaWiki chrome (nav, sidebars, footer, edit links, TOC, `mw-editsection`, scripts); keep `#mw-content-text .mw-parser-output`. Title from `<h1>` / `<title>` minus site suffix. Page URL from canonical link if present (store as `metadata.url`).
3. `pipelines/wiki/sections.py`: split by `h2` (and nested `h3/h4` as `heading_path`). Produce ordered `RawSection(heading, level, html, text, links[], lists[], tables[], images[])`.
4. `pipelines/wiki/headings.py`: canonical field map + synonyms, e.g.
```python
CANONICAL = {
 "acronym": ["acronym"],
 "alt_names": ["alternate name", "alternate names", "alternative name", "also known as"],
 "dependent": ["main dependent construct", "dependent construct", "dependent variable"],
 "independent": ["main independent construct", "independent construct"],
 "description": ["concise description of theory", "description", "summary"],
 "diagram": ["diagram", "schematic"],
 "seminal": ["originating author", "seminal article", "seminal"],
 "area": ["originating area", "originating discipline"],
 "level": ["level of analysis"],
 "related_theories": ["links from this theory to other theories", "links to other theories", "related theories"],
 "using_articles": ["is articles that use the theory", "articles that use the theory"],
 "contributors": ["contributor"], "last_updated": ["date last updated", "last updated"],
}
```
Match by normalised lowercase, strip punctuation/parentheses, `rapidfuzz.fuzz.token_set_ratio >= 88`. Unmapped headings -> `extra_sections[]` and appended to `reports/unmapped_headings.json` with counts and example pages.
5. `pipelines/wiki/fields.py` typed handlers returning Pydantic `TheoryCard`:
   - null-likes ("N/A", "n.a.", "none", "-", empty) -> None.
   - `acronym`, `alt_names`: split on commas/semicolons/newlines/bullets and " or ".
   - `dependent/independent`: bullet items else comma split; keep raw strings (normalisation happens in 08).
   - `seminal`/`using_articles`: one reference per `<li>`/paragraph; extract DOI regex `10\.\d{4,9}/\S+`, year `(19|20)\d{2}`, link URLs; keep `raw`.
   - `level`: map to enum {individual, group, organization, industry, society, mixed, other} + raw.
   - `related_theories`: extract wiki-link targets (`/wiki/<Page>`) resolved to local docs by title slug; unresolved kept as text.
   - `description`: ordered paragraphs with sub-heading path; keep lists/tables as text with markers.
   - `gregor_type`: regex over text ("Type I..V", "theory for analysing/explaining/predicting/explaining and predicting/design and action") -> optional.
   - `diagram`: image src (relative path resolved inside folder if file exists), alt/caption.
6. `TheoryCard` stored in `theories.card_json`, sections in `sections`, with `parser_version`. Provide `GET /api/wiki/theories` (paged, search by name), `GET /api/wiki/theories/{doc_id}` (card + sections + raw HTML path), `GET /api/wiki/report` (field coverage matrix: per field, % pages populated; unmapped headings; pages with parse warnings).
7. Register stage `wiki_parse` in job system with fingerprint = content_hash + parser_version.
8. **LLM fallback (optional, behind flag)**: for pages with unmapped headings or an empty description, send the cleaned text to the `extraction` role with a Pydantic schema `TheoryCardPatch` to fill missing canonical fields. Mark `field_provenance[field]='llm'`.

## Frontend
"Library > Theories" page: folder picker (Tauri dialog), scan button, parse job progress, table of theories with coverage badges, detail view showing parsed fields next to the cleaned original; "Coverage report" panel with unmapped headings.

## Tests
- `fixtures/wiki/` with >= 5 hand-made HTML pages replicating variants (all fields; N/A fields; missing sections; description with sub-headings; extra unknown heading). Golden JSON snapshots.
- Property: parser never raises on arbitrary HTML (hypothesis fuzz on malformed snippets).
- Idempotency: re-scan unchanged folder creates no duplicates; changed file re-parses.

## Acceptance
Select fixture folder in UI, run parse, see theories + coverage report; all tests green.
