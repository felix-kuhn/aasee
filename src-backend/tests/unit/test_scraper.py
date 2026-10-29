"""Unit tests for the wiki scraper."""
from __future__ import annotations

import pytest

from app.config import AppConfig
from app.pipelines.wiki import scraper


@pytest.fixture
def cfg() -> AppConfig:
    return AppConfig()


def test_extract_theory_links(fixture_dir, cfg):
    html = (fixture_dir / "wiki" / "index.html").read_text(encoding="utf-8")
    links = scraper.extract_theory_links(html, cfg)
    assert [link.slug for link in links] == [
        "Activity_Theory",
        "Agency_theory",
        "Technology_acceptance_model",
    ]
    assert links[0].title == "Activity Theory"
    assert links[0].url == "https://is.theorizeit.org/wiki/Activity_Theory"


def test_extract_theory_links_missing_heading(cfg):
    with pytest.raises(scraper.ScrapeError):
        scraper.extract_theory_links("<html><body><p>nothing</p></body></html>", cfg)


def test_extract_body_content(fixture_dir, cfg):
    html = (fixture_dir / "wiki" / "theory.html").read_text(encoding="utf-8")
    content = scraper.extract_body_content(html, cfg)
    assert content is not None
    assert "<h1>Activity Theory</h1>" in content
    assert 'href="https://is.theorizeit.org/wiki/Engestrom"' in content
    assert 'src="https://is.theorizeit.org/images/activity.png"' in content


def test_absolutize_fragment(cfg):
    fragment = '<p>See <a href="/wiki/foo">foo</a> and <img src="//cdn.example.com/x.png"></p>'
    out = scraper._absolutize_fragment(fragment, cfg.theories.base_url)
    assert 'href="https://is.theorizeit.org/wiki/foo"' in out
    assert 'src="https://cdn.example.com/x.png"' in out


def test_absolutize_srcset(cfg):
    base = cfg.theories.base_url.rstrip("/") + "/"
    srcset = "/img/a.png 1x, //cdn.example.com/b.png 2x"
    out = scraper._absolutize_srcset(srcset, base)
    assert out == "https://is.theorizeit.org/img/a.png 1x, https://cdn.example.com/b.png 2x"


def test_text_from_html():
    text = scraper.text_from_html("<h1>Title</h1><p>Body text</p>")
    assert "Title" in text
    assert "Body text" in text


def test_parse_filename():
    assert scraper.parse_filename("Activity_Theory_20261028T161730Z.html") == "Activity_Theory"
    assert scraper.parse_filename("A_B_20261028T161730Z_1.html") == "A_B"
    assert scraper.parse_filename("no_timestamp.html") is None


def test_title_from_html():
    assert scraper.title_from_html("<h1>  Activity\nTheory </h1>") == "Activity Theory"
    assert scraper.title_from_html("<p>no heading</p>") is None


def test_sanitize_slug():
    assert scraper.sanitize_slug("  Foo Bar  ") == "Foo_Bar"
    assert scraper.sanitize_slug("a/b:c") == "a_b_c"
