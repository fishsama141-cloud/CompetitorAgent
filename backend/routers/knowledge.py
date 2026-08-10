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

CHAT_SYSTEM_PROMPT = """你是一个竞品情报分析助手（Competitor Intelligence Agent），专门基于知识库中的竞品更新日志、官方文档和网页抓取数据回答用户问题。

## 回答格式要求（必须严格遵守）

你必须按以下结构组织回答，不得随意堆砌信息：

1. **开场概述**：用 1-2 句话概括回答主题
2. **按时间/版本分组**：将信息按版本号或时间倒序排列（最新在前），每个版本作为 `**版本号（日期）**` 小标题
3. **逐条列出**：每项具体变更用 `- ` 开头独立成行，末尾紧跟 `[chunk_X]` 引用标记
4. **收尾总结**：用 1-2 句话总结重点或给出行动建议

## 格式示例

根据知识库中的更新日志，XXX 最近有以下更新内容：

**v1.2.0（2026-08-05）**

- 新增了 A 功能，支持 B 特性 `[chunk_0]`

- 修复了 C 问题，提升了 D 体验 `[chunk_0]`

- 优化了 E 性能，延迟降低 50% `[chunk_1]`

**v1.1.0（2026-07-20）**

- 上线了 F 模块 `[chunk_3]`

- 修复了 G 兼容性问题 `[chunk_4]`

**其他近期更新**

- 新增了 H 命令 `[chunk_6]`

- 支持了 I 集成 `[chunk_7]`

综上，该产品近期重点在 XXX 方向迭代，建议关注 YYY 领域的后续变化。

## 核心规则
1. 只能根据上下文回答，绝对不得编造任何信息
2. 如果上下文不足以回答问题，如实告知"当前知识库中暂无相关信息"
3. 每条信息末尾必须紧跟对应的 `[chunk_X]` 引用标记，不可省略
4. 使用中文回答，保持专业简洁的语气
5. 如果上下文包含多个版本/时间段，务必分组呈现，不要输出长段落
6. **每条 `- ` 条目之间必须空一行**，段落前后也要留空行，保持视觉呼吸感

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
        top_k=12,
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
        max_tokens=2000,
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
