"""SWOT analysis agent — RAG context + LLM → structured SWOT matrix."""

from __future__ import annotations

import json
import uuid
from typing import List

from pydantic import BaseModel, Field, ValidationError

from backend.schemas import (
    Citation,
    SWOTGenerateData,
    SWOTMatrix,
    SwotItem,
)
from backend.services.llm_client import get_client
from backend.services.vector_store import search

# ── Pydantic schema for structured output ────────────────────

class SwotItemSchema(BaseModel):
    point: str
    chunk_id: str
    source_title: str
    raw_text_snippet: str
    confidence: float


class SwotMatrixSchema(BaseModel):
    strengths: List[SwotItemSchema] = []
    weaknesses: List[SwotItemSchema] = []
    opportunities: List[SwotItemSchema] = []
    threats: List[SwotItemSchema] = []


class SwotOutput(BaseModel):
    matrix: SwotMatrixSchema
    recommendations: List[str] = []


# ── Prompt ───────────────────────────────────────────────────

SYSTEM_PROMPT = """你是一位资深竞品情报分析师（Competitor Intelligence Analyst）。

请根据下方【知识库上下文】对目标竞品进行专业的 SWOT 分析。

## 要求
1. 严格基于上下文，不得编造任何事实
2. 每个象限（S/W/O/T）输出 2-3 个分析点
3. 每个分析点必须附带 `chunk_id` 和 `raw_text_snippet`（原文摘录）
4. `confidence` 代表该结论基于上下文的置信度（0.0-1.0），低于 0.6 不要输出
5. `source_title` 取上下文中提供的来源名称
6. 最后输出 3 条战略性建议（recommendations）

## 输出格式
严格输出 JSON，结构如下：
{{
  "matrix": {{
    "strengths": [{{ "point": "...", "chunk_id": "...", "source_title": "...", "raw_text_snippet": "...", "confidence": 0.9 }}],
    "weaknesses": [...],
    "opportunities": [...],
    "threats": [...]
  }},
  "recommendations": ["建议1", "建议2", "建议3"]
}}

## 知识库上下文
{context}"""


# ── Main logic ────────────────────────────────────────────────

def generate(competitor_names: List[str], domain: str, time_range_days: int = 30) -> SWOTGenerateData:
    """RAG-enhanced SWOT generation.

    1. Search vector store for relevant context
    2. Build prompt with context
    3. Call DeepSeek JSON mode → Pydantic validate
    """

    # 1. Retrieve context — search across ALL competitors (no hardcoded ID)
    all_chunks: List[dict] = []
    for name in competitor_names:
        # Search without competitor_id filter to get chunks from any competitor
        # that match the query. The vector store's `where` clause is dropped when
        # competitor_id is empty string.
        chunks = search(query=f"{name} {domain}", competitor_id="", top_k=8)
        all_chunks.extend(chunks)

    seen = set()
    unique: List[dict] = []
    for c in all_chunks:
        if c["chunk_id"] not in seen:
            seen.add(c["chunk_id"])
            unique.append(c)
    unique = unique[:15]

    context_parts: List[str] = []
    for i, c in enumerate(unique):
        context_parts.append(
            f"[chunk_{i}] chunk_id={c['chunk_id']} | source={c['source']}\n{c['content']}"
        )
    context = "\n\n---\n\n".join(context_parts) if context_parts else "（暂无知识库上下文）"

    # 2. Call LLM with JSON mode
    client = get_client()
    resp = client.chat.completions.create(
        model="deepseek-chat",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT.format(context=context)},
            {"role": "user", "content": f"请对 {', '.join(competitor_names)} 进行 SWOT 分析。领域：{domain}，时间范围：近 {time_range_days} 天。请输出 JSON。"},
        ],
        max_tokens=3000,
        temperature=0.3,
    )

    # 3. Parse & validate
    raw = resp.choices[0].message.content.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1]
        if raw.endswith("```"):
            raw = raw[:-3]

    try:
        parsed = SwotOutput.model_validate_json(raw)
    except ValidationError:
        # Retry once with simpler schema hint
        retry = client.chat.completions.create(
            model="deepseek-chat",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT.format(context=context)},
                {"role": "user", "content": f"请对 {', '.join(competitor_names)} 进行 SWOT 分析。注意：matrix 的四个 key 必须是 strengths, weaknesses, opportunities, threats；每个元素必须有 point, chunk_id, source_title, raw_text_snippet, confidence (0-1)；recommendations 是字符串数组。"},
            ],
            max_tokens=3000,
            temperature=0.2,
        )
        raw2 = retry.choices[0].message.content.strip()
        if raw2.startswith("```"):
            raw2 = raw2.split("\n", 1)[-1]
            if raw2.endswith("```"):
                raw2 = raw2[:-3]
        parsed = SwotOutput.model_validate_json(raw2)

    # 4. Convert to contract schema
    def _convert(items: List[SwotItemSchema]) -> List[SwotItem]:
        return [
            SwotItem(
                point=item.point,
                citation=Citation(
                    chunk_id=item.chunk_id,
                    source_title=item.source_title,
                    raw_text_snippet=item.raw_text_snippet,
                ),
                confidence=item.confidence,
            )
            for item in items
        ]

    report_id = f"rpt_{uuid.uuid4().hex[:10]}"

    return SWOTGenerateData(
        report_id=report_id,
        task_id=f"swot_{uuid.uuid4().hex[:8]}",
        swot_matrix=SWOTMatrix(
            strengths=_convert(parsed.matrix.strengths),
            weaknesses=_convert(parsed.matrix.weaknesses),
            opportunities=_convert(parsed.matrix.opportunities),
            threats=_convert(parsed.matrix.threats),
        ),
        recommendations=parsed.recommendations,
    )
