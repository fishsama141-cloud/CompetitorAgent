"""Competitor Intelligence Agent — FastAPI Backend.

Strictly aligned with api_contract.json.
Real ingestion, knowledge, SWOT, evaluation, and auth routes.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import date

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database import Base, engine
from backend.schemas import (
    ChatRequest,
    ChatResponse,
    ChatResponseData,
    Citation,
    CompetitorCreateData,
    CompetitorCreateRequest,
    CompetitorCreateResponse,
    CompetitorListItem,
    CompetitorListResponse,
)
from backend.routers.ingestion import router as ingestion_router
from backend.routers.knowledge import router as knowledge_router
from backend.routers.swot import router as swot_router
from backend.routers.evaluation import router as evaluation_router
from backend.routers.auth import router as auth_router


# ── Lifespan: create tables on startup ────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


# ── App factory ──────────────────────────────────────────────
app = FastAPI(
    title="Competitor Intelligence Agent",
    version="1.0.0",
    docs_url="/docs",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(auth_router)
app.include_router(ingestion_router)
app.include_router(knowledge_router)
app.include_router(swot_router)
app.include_router(evaluation_router)

API = "/api/v1"

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
