"""Knowledge base routes — document upload, semantic search, RAG chat."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter

from backend.schemas import (
    ChatRequest,
    ChatResponse,
    ChatResponseData,
    Citation,
    SearchResponse,
    SearchResponseData,
    SearchResultItem,
    UploadDocumentData,
    UploadDocumentRequest,
    UploadDocumentResponse,
    VectorSearchRequest,
)
from backend.services.llm_client import get_client
from backend.services.vector_store import ingest, search

router = APIRouter(prefix="/api/v1")

# ── RAG Chat system prompt ──────────────────────────────────

CHAT_SYSTEM_PROMPT = """你是一个竞品情报分析助手（Competitor Intelligence Agent）。你的回答必须严格基于下方【知识库上下文】。

## 规则
1. 只能根据上下文回答，不得编造任何信息
2. 如果上下文不足以回答问题，请如实告知"当前知识库中暂无相关信息"
3. 回答中引用具体数据时，使用 `[chunk_xxx]` 格式标注引用来源
4. 保持专业、简洁的分析语气
5. 如果用户问的是中文，用中文回答

## 知识库上下文
{context}"""


# ── Document Upload ──────────────────────────────────────────


@router.post("/knowledge/documents", response_model=UploadDocumentResponse)
def upload_document(body: UploadDocumentRequest) -> UploadDocumentResponse:
    """Accept a document (with inline content) and index it into the vector store."""
    if not body.content.strip():
        return UploadDocumentResponse(
            data=UploadDocumentData(document_id="", status="skipped")
        )

    count = ingest(
        text=body.content,
        competitor_id=body.competitor_id,
        source_url=body.file_name,
        source_type=body.document_type,
    )

    return UploadDocumentResponse(
        data=UploadDocumentData(
            document_id=body.competitor_id,
            status="indexed" if count > 0 else "skipped",
        )
    )


# ── Semantic Search ──────────────────────────────────────────


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


# ── RAG Chat (real pipeline: retrieve → LLM) ─────────────────


@router.post("/chat", response_model=ChatResponse)
def rag_chat(body: ChatRequest) -> ChatResponse:
    """RAG-powered Q&A: embed question → vector search → LLM answer with citations."""

    # 1. Retrieve relevant chunks from vector store
    chunks = search(
        query=body.question,
        competitor_id=body.competitor_id,
        top_k=8,
    )

    # 2. Build context string for the LLM
    if not chunks:
        return ChatResponse(
            data=ChatResponseData(
                answer="当前知识库中暂无与该竞品相关的信息。请先通过「数据采集」抓取竞品网页，或通过「上传」导入文档。",
                citations=[],
            )
        )

    context_parts: List[str] = []
    citations: List[Citation] = []
    for i, c in enumerate(chunks):
        tag = f"[chunk_{i}]"
        context_parts.append(
            f"{tag} source={c['source']}\n{c['content']}"
        )
        citations.append(Citation(
            chunk_id=c["chunk_id"],
            source_title=c["source"],
            raw_text_snippet=c["content"][:200],
        ))

    context = "\n\n---\n\n".join(context_parts)

    # 3. Call LLM
    client = get_client()
    resp = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": CHAT_SYSTEM_PROMPT.format(context=context)},
            {"role": "user", "content": body.question},
        ],
        max_tokens=1200,
        temperature=0.3,
    )

    answer = resp.choices[0].message.content.strip()

    # 4. Match which citations were actually referenced in the answer
    used: List[Citation] = []
    for i, c in enumerate(chunks):
        tag = f"[chunk_{i}]"
        if tag in answer:
            used.append(Citation(
                chunk_id=c["chunk_id"],
                source_title=c["source"],
                raw_text_snippet=c["content"][:200],
            ))

    return ChatResponse(
        data=ChatResponseData(answer=answer, citations=used if used else citations[:3])
    )
