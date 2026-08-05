"""API contract validation — 12 test cases covering all 6 API groups.

Run: pytest backend/tests/ -v
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from backend.schemas import (
    ChatResponse,
    CompetitorCreateResponse,
    CompetitorListResponse,
    CrawlResponse,
    EvaluationResponse,
    SearchResponse,
    SWOTGenerateResponse,
    TaskStatusResponse,
    UploadDocumentResponse,
)

API = "/api/v1"


# ── Auth helpers ──────────────────────────────────────────────

def _register_and_login(client: TestClient) -> dict:
    """Register a test user, login, return auth headers."""
    client.post(f"{API}/auth/register", json={
        "username": "testuser_contract",
        "password": "testpass123",
    })
    resp = client.post(f"{API}/auth/login", json={
        "username": "testuser_contract",
        "password": "testpass123",
    })
    token = resp.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


class TestHealth:
    """Group 1: Health check."""

    def test_01_health_returns_ok(self, client: TestClient):
        resp = client.get(f"{API}/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "version" in data


class TestCompetitor:
    """Group 2: Competitor CRUD."""

    def test_02_create_competitor(self, client: TestClient):
        headers = _register_and_login(client)
        payload = {
            "name": "DeepSeek",
            "category": "AI Assistant",
            "official_url": "https://deepseek.com",
            "description": "AI 助手",
        }
        resp = client.post(f"{API}/competitors", json=payload, headers=headers)
        assert resp.status_code == 200
        # Contract validation via Pydantic
        parsed = CompetitorCreateResponse.model_validate(resp.json())
        assert parsed.status == "success"
        assert parsed.data is not None
        assert parsed.data.competitor_id

    def test_03_list_competitors(self, client: TestClient):
        headers = _register_and_login(client)
        # Create one first so list is not empty
        client.post(f"{API}/competitors", json={
            "name": "DeepSeek",
            "category": "AI Assistant",
            "official_url": "https://deepseek.com",
            "description": "AI 助手",
        }, headers=headers)
        resp = client.get(f"{API}/competitors", headers=headers)
        assert resp.status_code == 200
        parsed = CompetitorListResponse.model_validate(resp.json())
        assert parsed.status == "success"
        assert isinstance(parsed.data, list)
        if parsed.data:
            c = parsed.data[0]
            assert c.competitor_id
            assert c.name
            assert c.category


class TestIngestion:
    """Group 3: Data ingestion."""

    def test_04_trigger_crawl(self, client: TestClient):
        payload = {
            "competitor_id": "cmp_001",
            "url": "https://example.com",
            "source_type": "changelog",
        }
        resp = client.post(f"{API}/data/crawl", json=payload)
        assert resp.status_code == 200
        parsed = CrawlResponse.model_validate(resp.json())
        assert parsed.status == "success"
        assert parsed.data is not None
        assert parsed.data.task_id
        assert parsed.data.crawl_status in ("processing", "completed", "failed")

    def test_05_get_task_status(self, client: TestClient):
        resp = client.get(f"{API}/data/task/crawl_001")
        assert resp.status_code == 200
        parsed = TaskStatusResponse.model_validate(resp.json())
        assert parsed.status == "success"
        assert parsed.data is not None
        assert parsed.data.task_id == "crawl_001"
        assert 0 <= parsed.data.progress_percentage <= 100


class TestKnowledge:
    """Group 4: Knowledge base."""

    def test_06_semantic_search(self, client: TestClient):
        payload = {
            "query": "DeepSeek 功能",
            "top_k": 3,
            "competitor_id": "cmp_001",
            "domain": "AI Assistant",
        }
        resp = client.post(f"{API}/knowledge/search", json=payload)
        assert resp.status_code == 200
        parsed = SearchResponse.model_validate(resp.json())
        assert parsed.status == "success"
        assert parsed.data is not None
        assert isinstance(parsed.data.results, list)
        if parsed.data.results:
            r = parsed.data.results[0]
            assert r.chunk_id
            assert r.content
            assert 0.0 <= r.similarity_score <= 1.0

    def test_07_upload_document(self, client: TestClient):
        payload = {
            "competitor_id": "cmp_001",
            "file_name": "test.md",
            "document_type": "changelog",
            "content": "# Test Document\n\nThis is a test document for vector indexing.\n",
        }
        resp = client.post(f"{API}/knowledge/documents", json=payload)
        assert resp.status_code == 200
        parsed = UploadDocumentResponse.model_validate(resp.json())
        assert parsed.status == "success"
        assert parsed.data is not None
        assert parsed.data.status in ("indexed", "skipped")


class TestSWOT:
    """Group 5: SWOT agent."""

    def test_08_generate_swot(self, client: TestClient):
        payload = {
            "competitors": ["DeepSeek", "豆包"],
            "domain": "AI Assistant",
            "time_range_days": 30,
        }
        resp = client.post(f"{API}/swot/generate", json=payload)
        assert resp.status_code == 200
        parsed = SWOTGenerateResponse.model_validate(resp.json())
        assert parsed.status == "success"
        assert parsed.data is not None
        m = parsed.data.swot_matrix
        assert isinstance(m.strengths, list)
        assert isinstance(m.weaknesses, list)
        assert isinstance(m.opportunities, list)
        assert isinstance(m.threats, list)
        assert parsed.data.recommendations

    def test_09_swot_items_have_citations(self, client: TestClient):
        payload = {
            "competitors": ["DeepSeek"],
            "domain": "AI Assistant",
            "time_range_days": 30,
        }
        resp = client.post(f"{API}/swot/generate", json=payload)
        assert resp.status_code == 200
        parsed = SWOTGenerateResponse.model_validate(resp.json())
        m = parsed.data.swot_matrix
        all_items = m.strengths + m.weaknesses + m.opportunities + m.threats
        for item in all_items:
            assert item.point
            assert 0.0 <= item.confidence <= 1.0
            assert item.citation.chunk_id
            assert item.citation.source_title


class TestEvaluation:
    """Group 6: Quality evaluation."""

    def test_10_run_evaluation(self, client: TestClient):
        # First generate SWOT so evaluation has data
        client.post(
            f"{API}/swot/generate",
            json={"competitors": ["DeepSeek"], "domain": "AI", "time_range_days": 30},
        )
        resp = client.post(f"{API}/evaluation/run", json={"report_id": "rpt_test_01"})
        assert resp.status_code == 200
        parsed = EvaluationResponse.model_validate(resp.json())
        assert parsed.status == "success"
        assert parsed.data is not None
        assert 0.0 <= parsed.data.faithfulness <= 1.0
        assert 0.0 <= parsed.data.citation_accuracy <= 1.0
        assert 0.0 <= parsed.data.completeness <= 1.0
        assert 0.0 <= parsed.data.hallucination_rate <= 1.0

    def test_11_get_evaluation_by_id(self, client: TestClient):
        resp = client.get(f"{API}/evaluation/rpt_001")
        assert resp.status_code == 200
        parsed = EvaluationResponse.model_validate(resp.json())
        assert parsed.status == "success"
        assert parsed.data is not None


class TestContractValidation:
    """Group 7: Full contract alignment check."""

    ALL_ENDPOINTS = [
        ("GET", "/health", None),
        ("POST", "/competitors", {"name": "Test", "category": "X", "official_url": "https://x.com", "description": "x"}),
        ("GET", "/competitors", None),
        ("POST", "/data/crawl", {"competitor_id": "cmp_001", "url": "https://x.com", "source_type": "changelog"}),
        ("GET", "/data/task/test_001", None),
        ("POST", "/knowledge/documents", {"competitor_id": "cmp_001", "file_name": "x.md", "document_type": "changelog"}),
        ("POST", "/knowledge/search", {"query": "test", "top_k": 3, "competitor_id": "cmp_001", "domain": "AI"}),
        ("POST", "/chat", {"question": "test?", "competitor_id": "cmp_001"}),
        ("POST", "/swot/generate", {"competitors": ["DeepSeek"], "domain": "AI", "time_range_days": 30}),
        ("POST", "/evaluation/run", {"report_id": "rpt_001"}),
        ("GET", "/evaluation/rpt_001", None),
    ]

    def test_12_all_endpoints_contract_compliant(self, client: TestClient):
        """Every endpoint returns {status, data, error_message} envelope."""
        headers = _register_and_login(client)
        for method, path, body in self.ALL_ENDPOINTS:
            url = f"{API}{path}"
            kwargs: dict = {}
            # Competitor endpoints now require auth
            if path in ("/competitors",):
                kwargs["headers"] = headers
            if method == "GET":
                resp = client.get(url, **kwargs)
            else:
                resp = client.post(url, json=body, **kwargs)

            assert resp.status_code == 200, f"{method} {url} → {resp.status_code}"
            data = resp.json()
            assert "status" in data, f"{method} {url} missing 'status'"
            assert data["status"] in ("success", "error", "ok"), f"{method} {url} status={data['status']}"
            if path == "/health":
                assert "version" in data, f"{method} {url} health missing version"
            else:
                assert "data" in data or "error_message" in data, f"{method} {url} missing data/error_message"
