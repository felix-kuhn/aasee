"""Scraper for is.theorizeit.org.

Flow (one "hydration"):
  1. Fetch the index page and read every link in the <ul> below the
     <h2 id="Theories"> heading. Each link is one theory.
  2. Fetch each theory page and keep only the content of
     <div id="bodyContent">.
  3. Save one file per theory into data/theories/, named
     "<slug>_<timestamp>.html" (timestamp = hydration run, for versioning).
  4. Count tokens of the extracted text with tiktoken.
"""
from __future__ import annotations

import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import httpx
import tiktoken
from bs4 import BeautifulSoup

from ...config import AppConfig

_UNSAFE_FILENAME = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


class ScrapeError(RuntimeError):
    """Raised when the index page or the page list cannot be processed."""


@dataclass
class TheoryLink:
    slug: str
    title: str
    url: str  # absolute


def sanitize_slug(value: str) -> str:
    """Filesystem-safe slug from a wiki page name (keeps underscores)."""
    value = value.strip().replace(" ", "_")
    value = _UNSAFE_FILENAME.sub("_", value)
    return value or "theory"


def extract_theory_links(html: str, cfg: AppConfig) -> list[TheoryLink]:
    """All /wiki/ links in the <ul> that follows the Theories heading."""
    soup = BeautifulSoup(html, "lxml")
    heading = (
        soup.find("h2", id=cfg.theories.list_heading)
        or soup.find("h2", string=re.compile(cfg.theories.list_heading))
    )
    if heading is None:
        raise ScrapeError(f"heading <h2 id=\"{cfg.theories.list_heading}\"> not found on index page")

    ul = heading.find_next("ul")
    if ul is None:
        raise ScrapeError("no <ul> found after the Theories heading")

    links: list[TheoryLink] = []
    seen: set[str] = set()
    for a in ul.find_all("a", href=True):
        href = a["href"]
        if not href.startswith("/wiki/"):
            continue
        page_name = href[len("/wiki/"):]
        title = (a.get("title") or a.get_text(strip=True) or page_name)
        title = re.sub(r"\s+", " ", title).strip()
        slug = sanitize_slug(page_name)
        if slug in seen:
            continue
        seen.add(slug)
        links.append(TheoryLink(slug=slug, title=title, url=cfg.theories.base_url + href))
    if not links:
        raise ScrapeError("no theory links found in the Theories list")
    return links


def extract_body_content(html: str, cfg: AppConfig) -> str | None:
    """Inner HTML of <div id="bodyContent">, or None if the page has none."""
    soup = BeautifulSoup(html, "lxml")
    div = soup.find("div", id=cfg.theories.content_div_id)
    if div is None:
        return None
    fragment = div.decode_contents()
    return _absolutize_fragment(fragment, cfg.theories.base_url)


_URL_ATTRS = ("href", "src", "poster", "data-src", "data-lazy-src", "data-original")
_NON_URL_SCHEMES = ("data:", "blob:", "javascript:", "mailto:", "tel:", "ftp:")


def _absolutize_fragment(fragment: str, base_url: str) -> str:
    """Rewrite relative URLs in the saved fragment to absolute ones.

    The stored files are rendered inside the Tauri webview, so /wiki/... and
    //static... links would otherwise resolve against the app's own origin.
    """
    soup = BeautifulSoup(fragment, "lxml")
    base = base_url.rstrip("/") + "/"
    for tag in soup.find_all(True):
        for attr in _URL_ATTRS:
            value = tag.get(attr)
            if value and not value.startswith(_NON_URL_SCHEMES):
                tag[attr] = urljoin(base, value)
        srcset = tag.get("srcset")
        if srcset:
            tag["srcset"] = _absolutize_srcset(srcset, base)
        style = tag.get("style")
        if style and "url(" in style:
            tag["style"] = re.sub(
                r"""url\(\s*(['"]?)(?!data:|https?:|//)([^'()]+)\1\s*\)""",
                lambda m: f"url({m.group(1)}{urljoin(base, m.group(2))}{m.group(1)})",
                style,
            )
    return str(soup)


def _absolutize_srcset(srcset: str, base: str) -> str:
    parts = []
    for entry in srcset.split(","):
        entry = entry.strip()
        if not entry:
            continue
        bits = entry.split(None, 1)
        url = bits[0]
        if url.startswith(_NON_URL_SCHEMES) and not url.startswith("//"):
            parts.append(entry)
        else:
            resolved = urljoin(base, url)
            parts.append(f"{resolved} {bits[1]}" if len(bits) > 1 else resolved)
    return ", ".join(parts)


def text_from_html(fragment: str) -> str:
    return BeautifulSoup(fragment, "lxml").get_text("\n")


_FILENAME = re.compile(r"^(?P<slug>.+)_(?P<ts>\d{8}T\d{6}Z)(?:_\d+)?\.html$")


def parse_filename(name: str) -> str | None:
    """<slug>_<run timestamp>[_<n>].html -> slug (None when it doesn't match)."""
    m = _FILENAME.match(name)
    return m.group("slug") if m else None


def title_from_html(fragment: str) -> str | None:
    """The theory's <h1> title inside the stored bodyContent fragment."""
    soup = BeautifulSoup(fragment, "lxml")
    h1 = soup.find("h1")
    if h1 is None:
        return None
    return re.sub(r"\s+", " ", h1.get_text(" ", strip=True)).strip() or None


def count_tokens(text: str, cfg: AppConfig) -> int:
    enc = tiktoken.get_encoding(cfg.tokens.encoding)
    return len(enc.encode(text))


def _timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def run_hydration(cfg: AppConfig, theories_dir: Path, job) -> dict:
    """Scrape all theories. `job` receives progress updates (see pipeline.jobs)."""
    theories_dir.mkdir(parents=True, exist_ok=True)
    headers = {"User-Agent": cfg.theories.user_agent}

    with httpx.Client(
        headers=headers,
        timeout=cfg.theories.request_timeout_s,
        follow_redirects=True,
    ) as client:
        # --- index -----------------------------------------------------------------
        job.update(stage="index", progress=0.0, detail="Fetching index page")
        index_url = cfg.theories.base_url + cfg.theories.index_page
        index_html = _fetch(client, index_url, cfg.theories.max_attempts)
        links = extract_theory_links(index_html, cfg)
        total = len(links)

        run_ts = _timestamp()
        saved: list[dict] = []
        errors: list[dict] = []

        # --- pages -------------------------------------------------------------------
        for i, link in enumerate(links, start=1):
            job.update(
                stage="scrape",
                progress=(i - 1) / total,
                detail=f"{i}/{total}: {link.title}",
            )
            try:
                page_html = _fetch(client, link.url, cfg.theories.max_attempts)
                content = extract_body_content(page_html, cfg)
                if content is None:
                    errors.append(
                        {"slug": link.slug, "title": link.title, "error": "no bodyContent div"}
                    )
                    continue
                path = _save(theories_dir, link.slug, run_ts, content)
                tokens = count_tokens(text_from_html(content), cfg)
                saved.append(
                    {
                        "slug": link.slug,
                        "title": link.title,
                        "url": link.url,
                        "file": path.name,
                        "tokens": tokens,
                    }
                )
            except Exception as exc:  # noqa: BLE001 - keep going, report at the end
                errors.append({"slug": link.slug, "title": link.title, "error": str(exc)[:300]})
            if i < total:
                time.sleep(cfg.theories.request_delay_s)

        job.update(stage="done", progress=1.0, detail=f"{len(saved)} theories saved")
        return {"scraped": len(saved), "errors": errors, "files": saved, "timestamp": run_ts}


def _fetch(client: httpx.Client, url: str, max_attempts: int) -> str:
    last_error: Exception | None = None
    for attempt in range(max_attempts):
        try:
            resp = client.get(url)
            resp.raise_for_status()
            return resp.text
        except Exception as exc:  # noqa: BLE001 - retried, then re-raised
            last_error = exc
            if attempt + 1 < max_attempts:
                time.sleep(1.0 + attempt)
    raise last_error  # type: ignore[misc]


def _save(theories_dir: Path, slug: str, run_ts: str, content: str) -> Path:
    """One file per theory per run: <slug>_<run timestamp>.html (unique within a run)."""
    name = f"{slug}_{run_ts}.html"
    path = theories_dir / name
    if path.exists():  # same second as an earlier run; keep both versions
        for n in range(1, 10):
            name = f"{slug}_{run_ts}_{n}.html"
            path = theories_dir / name
            if not path.exists():
                break
    path.write_text(content, encoding="utf-8")
    return path
