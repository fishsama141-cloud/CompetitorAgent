"""Pydantic v2 models — strict 1:1 alignment with api_contract.json."""

from __future__ import annotations

from datetime import date
from typing import Any, Generic, List, Optional, TypeVar

from pydantic import BaseModel, Field

# ============================================================
# Unified Response Envelope
# ============================================================

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    status: str = "success"  # "success" | "error"
    data: T | None = None
    error_message: str | None = None


# ============================================================
# Competitor
# ============================================================


class CompetitorCreateRequest(BaseModel):
    name: str
    category: str
    official_url: str
    description: str


class CompetitorCreateData(BaseModel):
    competitor_id: str
    name: str
    created_time: date


class CompetitorListItem(BaseModel):
    competitor_id: str
    name: str
    category: str
    official_url: str
    latest_update: date
    document_count: int


# ============================================================
# Data Ingestion
# ============================================================


class CrawlRequest(BaseModel):
    competitor_id: str
    url: str
    source_type: str  # "changelog" | "app_store" | "custom_url"


class CrawlResponseData(BaseModel):
    task_id: str
    crawl_status: str  # "processing" | "completed" | "failed"
    estimated_time: str


class TaskStatusData(BaseModel):
    task_id: str
    status: str
    progress_percentage: int
    documents_created: int
    error_message: str | None = None
    content_preview: str | None = None


class CrawlTaskItem(BaseModel):
    task_id: str
    competitor_id: str
    competitor_name: str = ""
    source_url: str = ""
    source_type: str = "changelog"
    status: str
    progress_percentage: int
    documents_created: int
    error_message: str | None = None
    content_preview: str | None = None
    created_at: str = ""


# ============================================================
# Knowledge Base
# ============================================================


class UploadDocumentRequest(BaseModel):
    competitor_id: str
    file_name: str
    document_type: str  # "changelog" | "app_store_review" | "custom"
    content: str = ""  # file body (plain text / markdown)


class UploadDocumentData(BaseModel):
    document_id: str
    status: str  # "indexed" | "processing"


class VectorSearchRequest(BaseModel):
    query: str
    top_k: int = 5
    competitor_id: str
    domain: str


class SearchResultItem(BaseModel):
    chunk_id: str
    content: str
    source: str
    similarity_score: float


class SearchResponseData(BaseModel):
    results: List[SearchResultItem]


# ============================================================
# RAG Chat
# ============================================================


class ChatRequest(BaseModel):
    question: str
    competitor_id: str


class Citation(BaseModel):
    chunk_id: str
    source_title: str
    raw_text_snippet: str


class ChatResponseData(BaseModel):
    answer: str
    citations: List[Citation] = []


# ============================================================
# SWOT Agent
# ============================================================


class SWOTGenerateRequest(BaseModel):
    competitors: List[str]
    domain: str
    time_range_days: int = 30


class SwotItem(BaseModel):
    point: str
    citation: Citation
    confidence: float


class SWOTMatrix(BaseModel):
    strengths: List[SwotItem] = []
    weaknesses: List[SwotItem] = []
    opportunities: List[SwotItem] = []
    threats: List[SwotItem] = []


class SWOTGenerateData(BaseModel):
    report_id: str
    task_id: str
    swot_matrix: SWOTMatrix
    recommendations: List[str] = []


class SwotReportListItem(BaseModel):
    """Summary row for the report history list."""
    report_id: str
    competitor_names: str  # comma-separated
    domain: str
    time_range_days: int
    total_points: int  # sum of all quadrant item counts
    created_at: str


class SwotReportDetail(BaseModel):
    """Full report with matrix + recommendations."""
    report_id: str
    competitor_names: str
    domain: str
    time_range_days: int
    swot_matrix: SWOTMatrix
    recommendations: List[str] = []
    created_at: str


# ============================================================
# Evaluation
# ============================================================


class EvaluationRequest(BaseModel):
    report_id: str


class EvaluationData(BaseModel):
    faithfulness: float
    citation_accuracy: float
    completeness: float
    hallucination_rate: float
    # Formula documentation for transparency
    formulas: dict = {
        "faithfulness": "avg(cosine_similarity(embed(point), embed(raw_text_snippet))) — 每个SWOT分析点与其引用原文片段的语义相似度均值",
        "citation_accuracy": "verified_chunk_ids / total_chunk_ids — 引用的chunk_id在向量库中真实存在的比例",
        "completeness": "min(avg(items_per_quadrant) / 3, 1.0) — 四象限覆盖完整度，目标每象限≥3条",
        "hallucination_rate": "count(similarity < 0.5) / total_points — 分析点与原文相似度低于0.5阈值的比例",
        "scoring": "最终得分 = (确定性公式得分 + LLM裁判得分) / 2，两者取平均；若某一方不可用则使用另一方的值",
    }


# ============================================================
# Auth
# ============================================================


class UserRegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=6, max_length=128)


class UserLoginRequest(BaseModel):
    username: str
    password: str


class TokenData(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


class UserMeData(BaseModel):
    id: int
    username: str
    created_at: str


# ============================================================
# Type aliases for concise route signatures
# ============================================================

CompetitorCreateResponse = ApiResponse[CompetitorCreateData]
CompetitorListResponse = ApiResponse[List[CompetitorListItem]]
CrawlResponse = ApiResponse[CrawlResponseData]
CrawlTaskListResponse = ApiResponse[List[CrawlTaskItem]]
TaskStatusResponse = ApiResponse[TaskStatusData]
UploadDocumentResponse = ApiResponse[UploadDocumentData]
SearchResponse = ApiResponse[SearchResponseData]
ChatResponse = ApiResponse[ChatResponseData]
SWOTGenerateResponse = ApiResponse[SWOTGenerateData]
SwotReportListResponse = ApiResponse[List[SwotReportListItem]]
SwotReportDetailResponse = ApiResponse[SwotReportDetail]
EvaluationResponse = ApiResponse[EvaluationData]
TokenResponse = ApiResponse[TokenData]
UserMeResponse = ApiResponse[UserMeData]
