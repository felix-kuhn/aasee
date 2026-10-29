"""Wiki/theory endpoints: hydrate (scrape), progress, list, content.

Mounted at ``/v1/theories`` (the existing frontend contract). The planned
wiki scanner (folder import, hashing, idempotent registration) extends this
router in a later increment.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ..core.errors import AppError
from ..deps import AppContext, get_context
from ..pipelines.wiki import scraper

router = APIRouter()


@router.post("/hydrate", status_code=202)
def hydrate(ctx: AppContext = Depends(get_context)):
    """Start a background scrape of every theory on the index page."""
    running = any(j.kind == "hydrate" and j.status in ("pending", "running") for j in ctx.jobs.list())
    if running:
        raise AppError(409, "already_running")

    def run(job) -> dict:
        result = scraper.run_hydration(ctx.cfg, ctx.theories_dir, job)
        ctx.record_hydration(result["timestamp"], result.get("files", []))
        return result

    job = ctx.jobs.submit("hydrate", run)
    return {"job_id": job.id, "kind": "hydrate"}


@router.get("/jobs/{job_id}")
def job_status(job_id: str, ctx: AppContext = Depends(get_context)):
    job = ctx.jobs.get(job_id)
    if job is None:
        raise AppError(404, "not_found", job_id=job_id)
    return job.to_dict()


def _tokens_for(ctx: AppContext, path, html: str) -> int:
    cached = ctx._token_cache.get(path)
    mtime = path.stat().st_mtime
    if cached and cached[0] == mtime:
        return cached[1]
    tokens = scraper.count_tokens(scraper.text_from_html(html), ctx.cfg)
    ctx._token_cache[path] = (mtime, tokens)
    return tokens


def _latest_files(ctx: AppContext) -> dict[str, dict]:
    """slug -> {file, raw} of the most recent file per theory."""
    if not ctx.theories_dir.exists():
        return {}
    latest: dict[str, tuple[float, str, bytes]] = {}
    for path in ctx.theories_dir.glob("*.html"):
        slug = scraper.parse_filename(path.name)
        if slug is None:
            continue
        entry = (path.stat().st_mtime, path.name, path.read_bytes())
        if slug not in latest or entry[0] >= latest[slug][0]:
            latest[slug] = entry
    return {slug: {"file": name, "raw": content} for slug, (_, name, content) in latest.items()}


def _title_and_url(ctx: AppContext, slug: str, name: str, html: str) -> tuple[str, str]:
    """Prefer the recorded metadata; fall back to the stored <h1> and the
    reconstructed wiki URL (slugs are page names, so this is usually exact)."""
    meta = ctx.theory_meta(slug, name)
    title = (meta or {}).get("title") or scraper.title_from_html(html) or slug.replace("_", " ")
    url = (meta or {}).get("url") or f"{ctx.cfg.theories.base_url}/wiki/{slug}"
    return title, url


@router.get("")
def list_theories(ctx: AppContext = Depends(get_context)):
    latest = _latest_files(ctx)
    out = []
    for slug in sorted(latest):
        name = latest[slug]["file"]
        raw = latest[slug]["raw"]
        html = raw.decode("utf-8", errors="replace")
        title, url = _title_and_url(ctx, slug, name, html)
        out.append(
            {
                "slug": slug,
                "title": title,
                "file": name,
                "url": url,
                "tokens": _tokens_for(ctx, ctx.theories_dir / name, html),
            }
        )
    return {"theories": out, "count": len(out)}


@router.get("/{slug}")
def get_theory(slug: str, ctx: AppContext = Depends(get_context)):
    latest = _latest_files(ctx)
    if slug not in latest:
        raise AppError(404, "not_found", slug=slug)
    name = latest[slug]["file"]
    raw = latest[slug]["raw"]
    path = ctx.theories_dir / name
    html = raw.decode("utf-8", errors="replace")
    title, url = _title_and_url(ctx, slug, name, html)
    return {
        "slug": slug,
        "title": title,
        "file": name,
        "url": url,
        "tokens": _tokens_for(ctx, path, html),
        "content": html,
    }
