"""Web scraper — fetch page content and extract clean text."""

from __future__ import annotations

import re

import httpx
from bs4 import BeautifulSoup


async def fetch(url: str, timeout: int = 30) -> str:
    """Fetch a URL and return clean, readable text content."""

    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.get(
            url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/125.0.0.0 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            },
            follow_redirects=True,
        )
        resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "lxml")

    # ---- remove noise ----
    for tag in soup(["script", "style", "nav", "footer", "header", "aside",
                     "noscript", "iframe", "form", "button", "input"]):
        tag.decompose()

    # ---- remove hidden elements ----
    for tag in soup.select("[hidden], [aria-hidden='true'], .hidden"):
        tag.decompose()

    body = soup.find("body")
    text = body.get_text(separator="\n", strip=True) if body else soup.get_text(separator="\n", strip=True)

    # ---- collapse whitespace ----
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)

    # ---- truncate to reasonable size ----
    if len(text) > 120_000:
        text = text[:120_000] + "\n\n[截断：内容过长]"

    return text.strip()
