"""Hybrid search endpoints (planned).

Will expose dense/BM25/graph-augmented search and cited streaming answers
(see docs/plan/09_retrieval_and_answering.md).
"""
from fastapi import APIRouter

router = APIRouter()
