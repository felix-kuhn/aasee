"""ID helpers."""
from __future__ import annotations

import uuid


def new_id(prefix: str = "") -> str:
    """Short unique id; ``doc_...`` when a prefix is given."""
    token = uuid.uuid4().hex
    return f"{prefix}_{token}" if prefix else token
