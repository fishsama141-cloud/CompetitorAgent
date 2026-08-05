"""Web scraper — fetch page content and extract clean text.

Supports static HTML pages via httpx + BeautifulSoup.
JS-rendered SPA pages will return minimal content — a clear error is raised
so the user knows to try a different URL or request a headless-browser upgrade.
"""

from __future__ import annotations

import re

import httpx
from bs4 import BeautifulSoup


class ScrapeError(Exception):
    """Human-readable scraping failure."""


async def fetch(url: str, timeout: int = 30) -> str:
    """Fetch a URL and return clean, readable text content.

    Raises ScrapeError with a Chinese-language diagnostic when scraping fails,
    so the frontend can surface it directly to the user.
    """

    # 1. HTTP fetch
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(timeout)) as client:
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
    except httpx.TimeoutException:
        raise ScrapeError(f"请求超时（>{timeout}s）：目标服务器响应过慢，请检查 URL 是否可访问或适当增大超时")
    except httpx.HTTPStatusError as e:
        code = e.response.status_code
        if code == 403:
            raise ScrapeError(f"HTTP 403 Forbidden：目标站点已启用反爬保护（Cloudflare / WAF），建议使用 API 通道或手动上传文档替代")
        elif code == 404:
            raise ScrapeError(f"HTTP 404 Not Found：目标页面不存在，请检查 URL 是否正确")
        elif code >= 500:
            raise ScrapeError(f"HTTP {code}：目标服务器内部错误，可稍后重试")
        else:
            raise ScrapeError(f"HTTP {code}：请求失败，{e.response.reason_phrase or '未知错误'}")
    except httpx.ConnectError:
        raise ScrapeError(f"无法连接到目标服务器：请检查 URL 拼写及网络连接（提示：URL 需包含 https://）")
    except Exception as exc:
        raise ScrapeError(f"网络请求异常：{exc}")

    # 2. Check content-type
    content_type = resp.headers.get("content-type", "")
    if "text/html" not in content_type and "text/plain" not in content_type:
        raise ScrapeError(
            f"目标 URL 返回的不是网页内容（Content-Type: {content_type}），"
            f"当前仅支持 HTML 网页抓取"
        )

    # 3. Parse HTML
    soup = BeautifulSoup(resp.text, "lxml")

    # ---- remove noise ----
    for tag in soup(["script", "style", "nav", "footer", "header", "aside",
                     "noscript", "iframe", "form", "button", "input",
                     "svg", "canvas", "video", "audio"]):
        tag.decompose()

    # ---- remove hidden elements ----
    for tag in soup.select("[hidden], [aria-hidden='true'], .hidden, .d-none, [style*='display:none'], [style*='display: none']"):
        tag.decompose()

    # ---- Try main content first, fall back to body ----
    main = soup.find("main") or soup.find("article") or soup.find("body")
    text = main.get_text(separator="\n", strip=True) if main else soup.get_text(separator="\n", strip=True)

    # ---- collapse whitespace ----
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)

    # ---- detect JS-only pages (very little text after cleaning) ----
    if len(text.strip()) < 200:
        raise ScrapeError(
            "页面内容过少（可能为 JS 动态渲染的单页应用）。"
            "当前采集器仅支持静态 HTML 页面，SPA 站点请尝试："
            "1) 查找该站点的 RSS/API 接口 "
            "2) 使用「文档上传」手动导入文本 "
            "3) 联系管理员升级 headless-browser 采集通道"
        )

    # ---- truncate to reasonable size ----
    if len(text) > 120_000:
        text = text[:120_000] + "\n\n[截断：内容过长]"

    return text.strip()
