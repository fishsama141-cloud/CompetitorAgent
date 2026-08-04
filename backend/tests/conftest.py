"""Shared fixtures & mocks for API contract tests.

Strategy: mock at the *service-function* level, not the *library* level.
This avoids breaking type annotations and class definitions.
"""

from __future__ import annotations

import sys
import os
from typing import Generator
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))


# ── Mock data ─────────────────────────────────────────────────

MOCK_SWOT_JSON = (
    '{"matrix":{"strengths":[{"point":"Strong AI","chunk_id":"c1","source_title":"Test","raw_text_snippet":"text","confidence":0.9}],'
    '"weaknesses":[{"point":"Weak brand","chunk_id":"c2","source_title":"Test","raw_text_snippet":"text","confidence":0.7}],'
    '"opportunities":[{"point":"Growing market","chunk_id":"c3","source_title":"Test","raw_text_snippet":"text","confidence":0.8}],'
    '"threats":[{"point":"Competition","chunk_id":"c4","source_title":"Test","raw_text_snippet":"text","confidence":0.6}]},'
    '"recommendations":["建议1","建议2","建议3"]}'
)

MOCK_EVAL_JSON = (
    '{"faithfulness":0.92,"citation_accuracy":0.90,"completeness":0.88,"hallucination_rate":0.05,"brief_reason":"good"}'
)

MOCK_SEARCH_RESULTS = [
    {"chunk_id": "c1", "content": "test content", "source": "http://test.com", "similarity_score": 0.9},
    {"chunk_id": "c2", "content": "test content 2", "source": "http://test.com", "similarity_score": 0.7},
]


def _mock_chat_create(*args, **kwargs):
    """Determine which mock JSON to return based on prompt content."""
    messages = kwargs.get("messages", [])
    content = str(messages)
    if "faithfulness" in content or "质量裁判" in content or "评估" in content:
        return MagicMock(choices=[MagicMock(message=MagicMock(content=MOCK_EVAL_JSON))])
    return MagicMock(choices=[MagicMock(message=MagicMock(content=MOCK_SWOT_JSON))])


def _mock_scraper_fetch(*args, **kwargs):
    """Async mock for scraper.fetch."""
    import asyncio
    async def _f(url, timeout=30):
        return "This is scraped content for testing purposes."
    return _f(*args, **kwargs)


def _mock_ingest(*args, **kwargs):
    return 5  # 5 chunks created


def _mock_search(*args, **kwargs):
    return MOCK_SEARCH_RESULTS


# ── Apply patches ─────────────────────────────────────────────

# Must be applied before importing app
_patches: list = []


def pytest_configure():
    # Patch before any module imports
    p1 = patch("backend.services.swot_agent.get_client")
    mock_get_client = p1.start()
    mock_llm = MagicMock()
    mock_llm.chat.completions.create.side_effect = _mock_chat_create
    mock_get_client.return_value = mock_llm
    _patches.append(p1)

    p2 = patch("backend.services.evaluator.get_client")
    mock_get_client2 = p2.start()
    mock_llm2 = MagicMock()
    mock_llm2.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content=MOCK_EVAL_JSON))]
    )
    mock_get_client2.return_value = mock_llm2
    _patches.append(p2)

    p3 = patch("backend.services.vector_store.search", side_effect=_mock_search)
    p3.start()
    _patches.append(p3)

    p4 = patch("backend.services.vector_store.ingest", side_effect=_mock_ingest)
    p4.start()
    _patches.append(p4)

    p5 = patch("backend.services.vector_store._get_embedder")
    mock_embedder = MagicMock()
    # encode() must return something with .tolist()
    import numpy as np
    mock_embedder.encode.return_value = np.array([[0.1] * 384])
    p5.start().return_value = mock_embedder
    _patches.append(p5)

    p6 = patch("backend.services.vector_store._get_chroma")
    mock_collection = MagicMock()
    mock_collection.query.return_value = {
        "ids": [["c1", "c2"]],
        "documents": [["content 1", "content 2"]],
        "metadatas": [[{"source_url": "http://test.com", "competitor_id": "cmp_001"}, {"source_url": "http://test.com", "competitor_id": "cmp_001"}]],
        "distances": [[0.1, 0.3]],
    }
    p6.start().return_value = mock_collection
    _patches.append(p6)

    p7 = patch("backend.services.scraper.fetch", side_effect=_mock_scraper_fetch)
    p7.start()
    _patches.append(p7)


def pytest_unconfigure():
    for p in _patches:
        p.stop()


# ── Import app AFTER patches ──────────────────────────────────

from backend.main import app  # noqa: E402


@pytest.fixture(scope="module")
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as c:
        yield c
