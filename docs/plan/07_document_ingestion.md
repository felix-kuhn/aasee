# 07 - Group B document ingestion (PDF, DOCX, TXT, MD)

## Objective
User adds files; they are parsed, chunked, embedded, and stored with page/bbox provenance.

## Tasks
1. `POST /api/files/add` {paths[] , doc_type?: paper|interview|memo|notes|other, tags[]} (Tauri file dialog supplies paths; backend copies files into `<data>/library/` and records original path + hash). `DELETE /api/files/{doc_id}` removes the doc from all stores (`delete_by_doc` in vector + graph + SQLite).
2. Parser selection (`pipelines/docs/parse.py`):
   - PDF: probe text layer via PyMuPDF/pdfplumber; if text coverage is good and layout simple -> fast path; else Docling (layout, tables, optional OCR). Make OCR toggle a setting (`ocr_enabled`).
   - DOCX: Docling or python-docx (headings, tables, lists).
   - TXT/MD: direct; detect interview transcripts by speaker patterns (`^[A-Z][\w .]+:` or `Interviewer:`) -> `doc_type=interview` suggestion.
   Output a normalised `ParsedDocument{pages, blocks[{type: heading|paragraph|table|list|caption|speaker_turn, text, page, bbox, level, speaker?, timestamp?}], metadata}`; store Docling JSON in `<data>/parsed/{doc_id}.json`.
3. Metadata extraction (`doc_meta`): from PDF metadata + first page; DOI regex; then `extraction` LLM with schema `DocMeta{title, authors[], year, venue, doi, abstract, doc_type_guess, language}`; user-editable in UI; provenance flag per field.
4. Chunking (`pipelines/docs/chunk.py`):
   - Structure-aware: walk blocks, build sections by headings; paragraphs merged to 300-500 tokens; tables = own chunk (markdown rendering) ; captions attached to figures/tables; references/bibliography section detected (heading match "References|Literature|Bibliography|Literaturverzeichnis") -> `kind='bibliography'`, excluded from embeddings and finding extraction.
   - Interviews: chunk by speaker turn(s) grouped to <= 400 tokens, keep `speaker`, `timestamp`; never mix interviewees in a chunk.
   - Each chunk stores `heading_path`, `page_start/page_end`, `bbox_json`, optional `parent_section_id` (for small-to-big retrieval).
   - Language detection (`langdetect`/`lingua`) per doc; stored in metadata.
5. Stages `doc_parse`, `doc_chunk`, `embed` (reuse from 06 for `source_group='B'`).
6. Source viewer endpoints: `GET /api/files/{doc_id}/raw` (stream file; supports HTTP range), `GET /api/chunks/{id}/locator` -> `{page, bbox}`.

## Frontend
- Library > Documents: drag-and-drop/add button, table with status per stage, doc_type editor, tags, metadata edit dialog, delete.
- Source viewer component: PDF.js (`pdfjs-dist`) rendering page with bbox highlight; text/HTML viewer for TXT/DOCX/wiki with chunk highlight. Reusable by Search, Graph and Link Review.

## Tests
Fixtures: small digital PDF, scanned PDF image (OCR optional skipped in CI via marker), DOCX, interview TXT. Assertions: chunk token limits, speakers preserved, bibliography excluded, page numbers correct, re-add of same file is idempotent, delete removes everything. Parser failures produce a document `status='failed'` with message, not an exception.

## Acceptance
Add fixture files via UI, see them parse/chunk/embed, open source viewer at the right page; debug search finds content with group filter B.
