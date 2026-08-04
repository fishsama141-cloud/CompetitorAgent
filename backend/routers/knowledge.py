"""Knowledge base routes — document upload + semantic search."""

from __future__ import annotations

from fastapi import APIRouter

from backend.schemas import (
    SearchResponse,
    SearchResponseData,
    SearchResultItem,
    UploadDocumentData,
    UploadDocumentRequest,
    UploadDocumentResponse,
    VectorSearchRequest,
)
from backend.services.vector_store import search

router = APIRouter(prefix="/api/v1")


@router.post("/knowledge/documents", response_model=UploadDocumentResponse)
def upload_document(body: UploadDocumentRequest) -> UploadDocumentResponse:
    # TODO: real file upload + ingestion in next step
    return UploadDocumentResponse(
        data=UploadDocumentData(
            document_id="doc_001",
            status="indexed",
        )
    )


@router.post("/knowledge/search", response_model=SearchResponse)
def semantic_search(body: VectorSearchRequest) -> SearchResponse:
    results = search(
        query=body.query,
        competitor_id=body.competitor_id,
        top_k=body.top_k,
    )

    items = [
        SearchResultItem(
            chunk_id=r["chunk_id"],
            content=r["content"],
            source=r["source"],
            similarity_score=r["similarity_score"],
        )
        for r in results
    ]

    return SearchResponse(data=SearchResponseData(results=items))
