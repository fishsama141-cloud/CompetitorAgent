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
TaskStatusResponse = ApiResponse[TaskStatusData]
UploadDocumentResponse = ApiResponse[UploadDocumentData]
SearchResponse = ApiResponse[SearchResponseData]
ChatResponse = ApiResponse[ChatResponseData]
SWOTGenerateResponse = ApiResponse[SWOTGenerateData]
EvaluationResponse = ApiResponse[EvaluationData]
TokenResponse = ApiResponse[TokenData]
UserMeResponse = ApiResponse[UserMeData]
