"""Competitor Intelligence Agent — FastAPI Backend.

Strictly aligned with api_contract.json.  All routes return mock data;
real logic (ChromaDB, LLM, crawler) will be wired in later phases.
"""

from __future__ import annotations

from datetime import date
from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.schemas import (
    ApiResponse,
    ChatRequest,
    ChatResponse,
    ChatResponseData,
    Citation,
    CompetitorCreateData,
    CompetitorCreateRequest,
    CompetitorCreateResponse,
    CompetitorListItem,
    CompetitorListResponse,
    CrawlRequest,
    CrawlResponse,
    CrawlResponseData,
    EvaluationData,
    EvaluationRequest,
    EvaluationResponse,
    SearchResponse,
    SearchResponseData,
    SearchResultItem,
    SWOTGenerateData,
    SWOTGenerateRequest,
    SWOTGenerateResponse,
    SWOTMatrix,
    SwotItem,
    TaskStatusData,
    TaskStatusResponse,
    UploadDocumentData,
    UploadDocumentRequest,
    UploadDocumentResponse,
)

# ── App factory ──────────────────────────────────────────────
app = FastAPI(
    title="Competitor Intelligence Agent",
    version="1.0.0",
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API = "/api/v1"

# ── Mock data ────────────────────────────────────────────────
_MOCK_SEARCH_RESULTS = [
    SearchResultItem(
        chunk_id="chunk_001",
        content="DeepSeek新增深度搜索能力，支持多轮对话与代码解释器。",
        source="官方更新日志",
        similarity_score=0.93,
    ),
    SearchResultItem(
        chunk_id="chunk_002",
        content="豆包上线了语音克隆功能，用户可自定义AI声音。",
        source="App Store 评论",
        similarity_score=0.88,
    ),
]

_MOCK_SWOT = SWOTMatrix(
    strengths=[
        SwotItem(
            point="模型推理能力强，深度搜索体验领先",
            citation=Citation(chunk_id="chunk_001", source_title="App Store 评论", raw_text_snippet="深度推理模式响应速度极快..."),
            confidence=0.92,
        )
    ],
    weaknesses=[
        SwotItem(
            point="高峰期服务不稳定",
            citation=Citation(chunk_id="chunk_002", source_title="App Store 评论", raw_text_snippet="经常提示网络连接超时..."),
            confidence=0.88,
        )
    ],
    opportunities=[
        SwotItem(
            point="企业API市场增长空间大",
            citation=Citation(chunk_id="chunk_003", source_title="Changelog", raw_text_snippet="上线深度 API 开放平台..."),
            confidence=0.85,
        )
    ],
    threats=[
        SwotItem(
            point="大厂价格战加剧竞争",
            citation=Citation(chunk_id="chunk_004", source_title="行业报告", raw_text_snippet="巨头降价补贴进行用户争夺..."),
            confidence=0.81,
        )
    ],
)

# ============================================================
# Health
# ============================================================

@app.get(f"{API}/health")
def health() -> dict:
    return {"status": "ok", "version": "1.0.0"}


# ============================================================
# Competitor
# ============================================================

@app.post(f"{API}/competitors", response_model=CompetitorCreateResponse)
def create_competitor(body: CompetitorCreateRequest) -> CompetitorCreateResponse:
    return CompetitorCreateResponse(
        data=CompetitorCreateData(
            competitor_id="cmp_001",
            name=body.name,
            created_time=date.today(),
        )
    )


@app.get(f"{API}/competitors", response_model=CompetitorListResponse)
def list_competitors() -> CompetitorListResponse:
    return CompetitorListResponse(
        data=[
            CompetitorListItem(competitor_id="cmp_001", name="DeepSeek", category="AI Assistant", latest_update=date(2026, 8, 1), document_count=120),
            CompetitorListItem(competitor_id="cmp_002", name="豆包", category="AI Assistant", latest_update=date(2026, 7, 28), document_count=98),
            CompetitorListItem(competitor_id="cmp_003", name="Kimi", category="AI Assistant", latest_update=date(2026, 8, 2), document_count=55),
            CompetitorListItem(competitor_id="cmp_004", name="Perplexity", category="Search", latest_update=date(2026, 7, 15), document_count=38),
        ]
    )


# ============================================================
# Data Ingestion
# ============================================================

@app.post(f"{API}/data/crawl", response_model=CrawlResponse)
def trigger_crawl(body: CrawlRequest) -> CrawlResponse:
    return CrawlResponse(
        data=CrawlResponseData(
            task_id="crawl_001",
            crawl_status="processing",
            estimated_time="30s",
        )
    )


@app.get(f"{API}/data/task/{{task_id}}", response_model=TaskStatusResponse)
def get_task_status(task_id: str) -> TaskStatusResponse:
    return TaskStatusResponse(
        data=TaskStatusData(
            task_id=task_id,
            status="completed",
            progress_percentage=100,
            documents_created=35,
            error_message=None,
        )
    )


# ============================================================
# Knowledge Base
# ============================================================

@app.post(f"{API}/knowledge/documents", response_model=UploadDocumentResponse)
def upload_document(body: UploadDocumentRequest) -> UploadDocumentResponse:
    return UploadDocumentResponse(
        data=UploadDocumentData(
            document_id="doc_001",
            status="indexed",
        )
    )


@app.post(f"{API}/knowledge/search", response_model=SearchResponse)
def semantic_search(body: "VectorSearchRequest") -> SearchResponse:  # noqa: F821
    return SearchResponse(
        data=SearchResponseData(results=_MOCK_SEARCH_RESULTS)
    )


# ============================================================
# RAG Chat
# ============================================================

@app.post(f"{API}/chat", response_model=ChatResponse)
def rag_chat(body: ChatRequest) -> ChatResponse:
    return ChatResponse(
        data=ChatResponseData(
            answer="DeepSeek在推理能力方面具有显著优势，尤其是在复杂多轮对话与代码解释器功能上。相比之下，豆包在语音交互和用户体验方面更具特色。建议根据产品定位选择差异化切入点。",
            citations=[
                Citation(chunk_id="chunk_001", source_title="App Store评论", raw_text_snippet="用户反馈推理能力强"),
                Citation(chunk_id="chunk_002", source_title="Changelog", raw_text_snippet="上线代码解释器功能"),
            ],
        )
    )


# ============================================================
# SWOT Agent
# ============================================================

@app.post(f"{API}/swot/generate", response_model=SWOTGenerateResponse)
def generate_swot(body: SWOTGenerateRequest) -> SWOTGenerateResponse:
    return SWOTGenerateResponse(
        data=SWOTGenerateData(
            report_id="report_001",
            task_id="swot_task_001",
            swot_matrix=_MOCK_SWOT,
            recommendations=[
                "加强企业用户服务能力，补齐审计与权限管理",
                "优化高峰期响应速度，建立弹性扩容机制",
                "利用开放平台API构建开发者生态",
            ],
        )
    )


# ============================================================
# Evaluation
# ============================================================

@app.post(f"{API}/evaluation/run", response_model=EvaluationResponse)
def run_evaluation(body: EvaluationRequest) -> EvaluationResponse:
    return EvaluationResponse(
        data=EvaluationData(
            faithfulness=0.95,
            citation_accuracy=0.92,
            completeness=0.90,
            hallucination_rate=0.03,
        )
    )


@app.get(f"{API}/evaluation/{{report_id}}", response_model=EvaluationResponse)
def get_evaluation(report_id: str) -> EvaluationResponse:
    return EvaluationResponse(
        data=EvaluationData(
            faithfulness=0.95,
            citation_accuracy=0.92,
            completeness=0.90,
            hallucination_rate=0.03,
        )
    )
