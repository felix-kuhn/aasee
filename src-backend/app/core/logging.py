"""Logging helpers with secret redaction."""
from __future__ import annotations

import logging
import re

_SECRET_PATTERNS = (
    re.compile(r"(api[_-]?key\s*[=:]\s*)\S+", re.IGNORECASE),
    re.compile(r"(authorization\s*[=:]\s*)\S+", re.IGNORECASE),
    re.compile(r"(bearer\s+)[A-Za-z0-9._~+/=-]+", re.IGNORECASE),
)


class RedactingFilter(logging.Filter):
    """Replaces obvious secrets in log records before they are emitted."""

    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        for pattern in _SECRET_PATTERNS:
            message = pattern.sub(r"\1***", message)
        record.msg = message
        record.args = ()
        return True


def setup_logging(level: int = logging.INFO) -> None:
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    for handler in logging.getLogger().handlers:
        handler.addFilter(RedactingFilter())


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
