"""Web scraper — Playwright headless browser (primary) + httpx (fallback).

Supports JS-rendered SPAs, static HTML, and basic anti-bot detection.
Automatically falls back to httpx if Playwright is unavailable.
"""

from __future__ import annotations

import re

import httpx
from bs4 import BeautifulSoup


class ScrapeError(Exception):
    """Human-readable scraping failure."""


# ── Text extraction from HTML ────────────────────────────────

def _extract_text(html: str) -> str:
    """Extract clean, readable text from HTML. Shared by both engines."""
    soup = BeautifulSoup(html, "lxml")

    # ---- remove noise ----
    for tag in soup(["script", "style", "nav", "footer", "header", "aside",
                     "noscript", "iframe", "form", "button", "input",
                     "svg", "canvas", "video", "audio"]):
        tag.decompose()

    # ---- remove hidden elements ----
    for tag in soup.select("[hidden], [aria-hidden='true'], .hidden, .d-none, [style*='display:none'], [style*='display: none']"):
        tag.decompose()

    # ---- main content area first ----
    main = soup.find("main") or soup.find("article") or soup.find("body")
    text = main.get_text(separator="\n", strip=True) if main else soup.get_text(separator="\n", strip=True)

    # ---- collapse whitespace ----
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)

    return text.strip()


# ── Playwright engine ─────────────────────────────────────────

async def _fetch_playwright(url: str, timeout_ms: int) -> str:
    """Scrape using headless Chromium. Works for JS-rendered SPAs."""
    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
            ],
        )
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1920, "height": 1080},
            locale="zh-CN",
        )
        page = await context.new_page()

        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
            # Wait a bit for JS to render
            await page.wait_for_timeout(3000)
            html = await page.content()
        finally:
            await browser.close()

    text = _extract_text(html)

    if len(text) < 200:
        raise ScrapeError(
            "页面内容过少（可能仍需更长的 JS 渲染等待时间或页面几乎无文本）。"
            "请尝试：1) 查找该站点的 RSS/API 接口 2) 使用「文档上传」手动导入文本"
        )

    return text


# ── Httpx engine (fallback) ───────────────────────────────────

async def _fetch_httpx(url: str, timeout_s: int) -> str:
    """Scrape using raw HTTP (no JS rendering). Fast but only works on static HTML."""
    async with httpx.AsyncClient(timeout=httpx.Timeout(timeout_s)) as client:
        resp = await client.get(
            url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/125.0.0.0 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml,text/plain,*/*",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            },
            follow_redirects=True,
        )
        resp.raise_for_status()

    content_type = resp.headers.get("content-type", "")
    if "text/html" not in content_type and "text/plain" not in content_type:
        raise ScrapeError(
            f"目标 URL 返回的不是网页内容（Content-Type: {content_type}），"
            f"当前仅支持 HTML 网页抓取"
        )

    text = _extract_text(resp.text)

    if len(text) < 200:
        raise ScrapeError(
            "httpx 模式下页面内容过少（JS 渲染页面）。"
            "请确认已安装 Playwright 浏览器：playwright install chromium"
        )

    return text


# ── Main entry point ──────────────────────────────────────────

async def fetch(url: str, timeout: int = 30) -> str:
    """Fetch a URL and return clean, readable text.

    Tries Playwright first (JS rendering), falls back to httpx.
    Raises ScrapeError with Chinese diagnostics on failure.
    """

    # 1. Try Playwright (JS-rendered pages)
    try:
        return await _fetch_playwright(url, timeout_ms=timeout * 1000)
    except ScrapeError:
        raise  # re-raise our own errors directly
    except ImportError:
        pass  # Playwright not installed → fall back to httpx
    except Exception as exc:
        # Playwright failed for other reasons → try httpx fallback
        pass

    # 2. Fall back to httpx (static HTML)
    try:
        return await _fetch_httpx(url, timeout_s=timeout)
    except httpx.TimeoutException:
        raise ScrapeError(f"请求超时（>{timeout}s）：目标服务器响应过慢，请检查 URL 是否可访问")
    except httpx.HTTPStatusError as e:
        code = e.response.status_code
        if code == 403:
            raise ScrapeError(
                f"HTTP 403 Forbidden：目标站点已启用反爬保护（Cloudflare / WAF），"
                f"建议使用 API 通道或手动上传文档替代"
            )
        elif code == 404:
            raise ScrapeError(f"HTTP 404 Not Found：目标页面不存在，请检查 URL 是否正确")
        elif code >= 500:
            raise ScrapeError(f"HTTP {code}：目标服务器内部错误，可稍后重试")
        else:
            raise ScrapeError(f"HTTP {code}：请求失败")
    except httpx.ConnectError:
        raise ScrapeError(
            "无法连接到目标服务器：请检查 URL 拼写及网络连接（提示：URL 需包含 https://）"
        )
    except ScrapeError:
        raise
    except Exception as exc:
        raise ScrapeError(f"网络请求异常：{exc}")


# ── Truncation helper (called by ingestion) ───────────────────

def truncate(text: str, max_chars: int = 120_000) -> str:
    """Truncate text to a reasonable size for embedding."""
    if len(text) > max_chars:
        text = text[:max_chars] + "\n\n[截断：内容过长]"
    return text
