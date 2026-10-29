"""Stage names shared by pipelines and the jobs API."""
from __future__ import annotations

from enum import StrEnum


class Stage(StrEnum):
    """Lifecycle stages a pipeline job reports through ``job.update``."""

    INDEX = "index"
    SCRAPE = "scrape"
    PARSE = "parse"
    EXTRACT = "extract"
    RESOLVE = "resolve"
    LINK = "link"
    RETRIEVE = "retrieve"
    DONE = "done"


STAGE_ORDER = tuple(stage.value for stage in Stage)
