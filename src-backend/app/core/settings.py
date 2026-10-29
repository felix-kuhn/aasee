"""Settings layer.

Runtime configuration currently lives in ``app.config`` (env-based, matching
the PoC). Re-exported here so future modules can import from
``app.core.settings`` without churn; a pydantic-settings based AppConfig may
replace this in a later increment.
"""

from ..config import AppConfig, default_data_dir, load_config

__all__ = ["AppConfig", "default_data_dir", "load_config"]
