"""Storage interfaces (planned).

Concrete implementations (SQLite, LanceDB/BM25, LadybugDB) plug in behind
these protocols so pipelines never depend on a specific engine.
(see docs/plan/03_storage_layer.md)
"""
from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class SqliteStore(Protocol):
    """SQLite metadata store (documents, chunks, claims, findings, links)."""

    def connect(self) -> Any: ...


@runtime_checkable
class VectorStore(Protocol):
    """Dense vector + lexical search over document chunks."""

    def add(
        self,
        ids: list[str],
        vectors: list[list[float]],
        texts: list[str],
        metadata: list[dict] | None = None,
    ) -> None: ...

    def query(
        self,
        vector: list[float],
        top_k: int = 10,
        filters: dict | None = None,
    ) -> list[dict]: ...


@runtime_checkable
class GraphStore(Protocol):
    """Property graph of theories, claims, findings, constructs and links."""

    def upsert_node(
        self, node_id: str, labels: list[str], properties: dict | None = None
    ) -> None: ...

    def upsert_edge(
        self,
        source: str,
        target: str,
        label: str,
        properties: dict | None = None,
    ) -> None: ...

    def neighbors(self, node_id: str, direction: str = "both") -> list[dict]: ...
