"""App configuration: defaults -> environment overrides.

Follows the poc-backend pattern (pydantic model + env overrides). The PoC
keeps config in code/env; a data/config.json can be added later the same
way israg does.
"""
from __future__ import annotations

import os
from pathlib import Path

from pydantic import BaseModel, Field


class TheoriesConfig(BaseModel):
    """Scraping settings for is.theorizeit.org."""

    base_url: str = "https://is.theorizeit.org"
    index_page: str = "/wiki/Main_Page"  # where the "Theories" list lives
    list_heading: str = "Theories"
    content_div_id: str = "bodyContent"
    request_delay_s: float = 0.2  # be polite to the wiki between page fetches
    request_timeout_s: float = 30.0
    user_agent: str = "ResearchAssistant-PoC/0.1 (local research tool)"
    max_attempts: int = 2  # per page


class TokenConfig(BaseModel):
    encoding: str = "cl100k_base"  # gpt-4/4o family; switch per model later


class AppConfig(BaseModel):
    theories: TheoriesConfig = Field(default_factory=TheoriesConfig)
    tokens: TokenConfig = Field(default_factory=TokenConfig)


def default_data_dir() -> Path:
    """<src-backend>/data, overridable via THEORIES_DATA_DIR."""
    env = os.environ.get("THEORIES_DATA_DIR")
    if env:
        return Path(env).expanduser()
    return Path(__file__).resolve().parent.parent / "data"


def load_config(data_dir: Path | str | None = None) -> AppConfig:
    cfg = AppConfig()
    env = os.environ
    if env.get("THEORIES_BASE_URL"):
        cfg.theories.base_url = env["THEORIES_BASE_URL"].rstrip("/")
    if env.get("THEORIES_TIKTOKEN_ENCODING"):
        cfg.tokens.encoding = env["THEORIES_TIKTOKEN_ENCODING"]
    return cfg
