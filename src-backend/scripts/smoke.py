"""Quick end-to-end check: index parse + one spot-checked theory page.

Usage: python scripts/smoke.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx  # noqa: E402

from app.config import load_config  # noqa: E402
from app.pipelines.wiki import scraper  # noqa: E402


def main() -> int:
    cfg = load_config()
    base = cfg.theories.base_url

    resp = httpx.get(f"{base}{cfg.theories.index_page}", timeout=30, follow_redirects=True)
    resp.raise_for_status()
    links = scraper.extract_theory_links(resp.text, cfg)
    print(f"index page: {len(links)} theories")
    for link in links[:5]:
        print(f"  {link.title} -> {link.url}")

    # spot-check one theory page
    resp2 = httpx.get(links[0].url, timeout=30, follow_redirects=True)
    resp2.raise_for_status()
    content = scraper.extract_body_content(resp2.text, cfg)
    assert content, "bodyContent missing on spot-checked page"
    tokens = scraper.count_tokens(scraper.text_from_html(content), cfg)
    print(f"spot check '{links[0].title}': {len(content)} chars, {tokens} tokens")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
