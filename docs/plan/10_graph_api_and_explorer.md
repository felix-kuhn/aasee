# 10 - Graph API and React graph explorer

## Objective
Navigate the stored graph in the UI: expand neighbourhoods, inspect nodes/edges with provenance, filter, search, find paths.

## Backend (`api/graph.py`)
All responses use graphology-compatible JSON:
```json
{"nodes":[{"key":"...","attributes":{"label":"...","type":"Theory","group":"A","degree":12,"props":{}}}],
 "edges":[{"key":"...","source":"...","target":"...","attributes":{"type":"SUPPORTS","confidence":0.8,"status":"proposed"}}],
 "truncated": false}
```
- `GET /api/graph/overview?limit=300` : top nodes by degree/PageRank, always includes Theory nodes (cap) and accepted links.
- `GET /api/graph/neighborhood?node_id&depth=1&node_types&edge_types&groups&min_confidence&status&limit=200` ; server enforces `limit` (truncated flag).
- `GET /api/graph/node/{id}` : properties, aliases, counts by relation, source chunks (with locators), claims/findings, linked items.
- `GET /api/graph/edge/{id}` : properties, evidence quotes both sides, rationale, model, status.
- `GET /api/graph/search?q&types` : name/alias search (prefix + fuzzy + embedding fallback).
- `GET /api/graph/path?from&to&max_depth=5` : shortest path(s).
- `GET /api/graph/stats` : counts per type/relation, group distribution.
- Analytics stage `graph_analytics`: PageRank + degree stored as node props; Leiden/Louvain communities (igraph/leidenalg or networkx `louvain_communities`) -> `Community` nodes + `IN_COMMUNITY` edges; LLM summary per community (extraction role, cached) stored in `communities` table and embedded as `kind='community'`. Skippable by config; UI works without it.

## Frontend (`features/graph/`)
- `GraphCanvas` using `@react-sigma/core` + graphology; layout via `graphology-layout-forceatlas2` in a web worker with start/stop; incremental layout when expanding (new nodes spawn near their parent).
- Visual encoding: colour by `group`/`type` (legend), size by degree/PageRank, edge colour by type; dashed edges for `proposed` links, solid for `accepted`, hidden for `rejected` unless toggled; labels with level-of-detail thresholds.
- Interactions: hover highlight neighbours; click -> side panel (NodeDetails/EdgeDetails with tabs: Properties, Evidence/Sources, Connections); double-click -> expand neighbours (depth 1) with limit warning; right-click context menu (expand, hide, pin, focus, find path to...); multi-select; drag nodes (pin).
- Toolbar: search box with autocomplete, filters (node types, edge types, groups, min confidence, link status), "cross-group only" toggle, depth slider, layout controls, fit/reset, export PNG/GraphML-or-JSON.
- Breadcrumb/history stack for navigation (back/forward between focus states); deep-link state in the URL/store so Search/Chat/Link Review can open "graph focused on X" (`/graph?focus=<id>&depth=1`).
- Sources: in the panel, clicking a source chunk opens the Source Viewer (07).
- Performance: cap rendered nodes (default 2000); warn and offer filtering above; memoise graphology instance; avoid React re-renders on each layout tick (use refs).

## Tests
Backend: API contract tests on fixture graph; limit/truncated behaviour; path search; analytics idempotency. Frontend: Vitest for state reducers (expand/hide/filter), component tests for panels with mocked API; optional Playwright smoke: open graph, expand node, click edge.

## Acceptance
With fixture data indexed, Graph page shows overview, expanding a theory reveals constructs/articles/claims, clicking a node shows details and source viewer opens.
