# 12 - Link review and Discoveries UI

## Objective
Give the researcher an efficient way to see, judge and act on links, and surface notable patterns.

## Screens
1. **Discoveries (home)**: cards ranked by score: Contradictions, Extensions with new constructs, Orphan findings (possibly novel), Unexpected cross-area links, Most-linked theories. Each card -> deep link into Link Review or Graph. Filters by document, theory, date. Run/refresh button (starts `links/run` job).
2. **Link Review (queue + detail)**
   - Left: list/table with filters (label, status, confidence slider, doc, theory, flags), sort, bulk select.
   - Right: split view: finding evidence (source viewer scrolled/highlighted) | theory claim evidence (wiki source or claim text with theory name). Show label chip, confidence bar, rationale, scope note, flags (`unstable`), proposed new constructs.
   - Actions: Accept (A), Reject (R), Change label (dropdown), Add note, Skip (S), keyboard shortcuts, bulk accept/reject, undo (last 20 actions).
   - "Open in graph" focusing both endpoints.
3. **Theory dashboard**: for one theory, matrix of its claims x documents with coloured cells (support/contradict/extend), list of orphan findings that mention its constructs.
4. **Document dashboard**: for one research doc, findings with their best links and unlinked findings.
5. **Manual link** dialog: pick finding and claim/theory, choose label, write rationale.
6. **Export**: `GET /api/export/links?format=csv|json|md` (Markdown report grouped by theory with quotes and citations - suitable for a literature-review section) and graph export (GraphML/JSON).

## Frontend tasks
- Feature folder `features/links/`; TanStack Query hooks with optimistic updates for status changes; Zustand store for review queue position and undo stack.
- Shared `EvidencePane` component using the Source Viewer from 07.
- Accessibility: keyboard navigation, focus management, aria labels.

## Backend tasks
Add endpoints needed by dashboards (`/api/theories/{id}/matrix`, `/api/docs/{id}/link-summary`), export endpoints, undo support via `link_history` table (every status/label change is appended).

## Tests
Vitest: queue navigation, optimistic update and rollback on API error, shortcut handling; backend: history/undo, export formats, matrix aggregation. Playwright smoke (optional): accept a link and see the graph edge style change.

## Acceptance
From fixture data a user reviews links using the keyboard, exports a Markdown report, and sees accepted links drawn solid in the graph.
