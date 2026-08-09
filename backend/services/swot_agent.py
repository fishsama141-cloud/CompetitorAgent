"""SWOT analysis agent — multi-dimensional RAG context + LLM → structured SWOT matrix.

Key improvements:
- Per-quadrant retrieval: different search queries for S/W/O/T dimensions
- More context: up to 25 chunks per analysis
- Deeper prompt: structured analysis framework with explicit citation requirements
"""

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
    confidence: float = Field(ge=0.0, le=1.0)


class SwotMatrixSchema(BaseModel):
    strengths: List[SwotItemSchema] = []
    weaknesses: List[SwotItemSchema] = []
    opportunities: List[SwotItemSchema] = []
    threats: List[SwotItemSchema] = []


class SwotOutput(BaseModel):
    matrix: SwotMatrixSchema
    recommendations: List[str] = []


# ── Per-quadrant search queries ──────────────────────────────

QUADRANT_QUERIES = {
    "strengths": [
        "技术优势 核心能力 差异化功能 性能表现",
        "用户好评 市场领先 创新特性 专利技术",
    ],
    "weaknesses": [
        "缺陷 不足 限制 问题 bug 差评",
        "缺失功能 性能瓶颈 兼容性问题 安全漏洞",
    ],
    "opportunities": [
        "市场趋势 增长机会 新场景 扩展方向",
        "技术突破 合作生态 政策利好 需求变化",
    ],
    "threats": [
        "竞争对手 替代品 市场份额 价格战",
        "政策风险 技术变革 用户流失 供应链",
    ],
}

# ── System prompt ────────────────────────────────────────────

SYSTEM_PROMPT = """你是一位资深竞品情报分析师（Competitor Intelligence Analyst），拥有10年以上的行业研究经验。

请根据下方【知识库上下文】对目标竞品进行深度 SWOT 分析。你必须严格遵循以下框架：

## 分析框架

### Strengths（优势）
- 该产品/服务的核心竞争壁垒是什么？
- 相比竞品，它在哪些方面表现突出？（技术、体验、生态、品牌、定价）
- 有哪些可量化的优势指标？

### Weaknesses（劣势）
- 存在哪些功能缺失、性能瓶颈或体验短板？
- 用户反馈中反复出现的负面评价是什么？
- 资源或能力上的限制有哪些？

### Opportunities（机会）
- 当前市场有哪些未被满足的需求可以切入？
- 技术趋势或政策变化带来了哪些新可能？
- 竞争对手的失误或盲区在哪里？

### Threats（威胁）
- 哪些竞品正在逼近或超越？
- 行业格局、政策法规、用户偏好有哪些不利变化？
- 是否存在被替代或颠覆的风险？

## 输出要求
1. **严格基于上下文**：每条分析点必须能从知识库上下文中找到支撑，不得凭空编造
2. **每个象限输出 3-5 个分析点**，确保覆盖全面
3. **每条必须附带引用**：`chunk_id` + `raw_text_snippet`（直接从上下文中摘录原文，不可自己改写摘要）
4. **confidence 置信度**（0.0-1.0）：基于上下文的充分程度打分，低于 0.6 的分析点不要输出
5. **source_title**：使用上下文中提供的来源 URL
6. **recommendations**：输出 4-6 条可落地的战略建议，每条 1-2 句话，具体而非空洞

## 输出格式
严格输出 JSON，结构如下：
{{
  "matrix": {{
    "strengths": [{{ "point": "分析结论", "chunk_id": "chunk_xxx", "source_title": "来源URL", "raw_text_snippet": "原文摘录…", "confidence": 0.85 }}],
    "weaknesses": [...],
    "opportunities": [...],
    "threats": [...]
  }},
  "recommendations": ["建议1", "建议2", "建议3", "建议4"]
}}

## 知识库上下文
{context}"""


# ── Main logic ────────────────────────────────────────────────


def generate(competitor_names: List[str], domain: str, time_range_days: int = 30) -> SWOTGenerateData:
    """RAG-enhanced SWOT generation with multi-dimensional retrieval.

    1. For each SWOT quadrant, search with targeted queries
    2. Collect & deduplicate context across all competitors
    3. Build rich context prompt
    4. Call DeepSeek JSON mode → Pydantic validate
    """

    # ── 1. Multi-dimensional RAG retrieval ─────────────────
    all_chunks: List[dict] = []
    seen_ids: set = set()

    for name in competitor_names:
        for quadrant, queries in QUADRANT_QUERIES.items():
            for query in queries:
                full_query = f"{name} {query}"
                try:
                    chunks = search(query=full_query, competitor_id="", top_k=5)
                    for c in chunks:
                        cid = c.get("chunk_id", "")
                        if cid and cid not in seen_ids:
                            seen_ids.add(cid)
                            all_chunks.append(c)
                except Exception:
                    # Gracefully skip individual search failures
                    pass

    # Sort by similarity score (descending) and keep top 25
    all_chunks.sort(key=lambda c: c.get("similarity_score", 0), reverse=True)
    top_chunks = all_chunks[:25]

    # ── 2. Build context string ───────────────────────────
    if top_chunks:
        context_parts: List[str] = []
        for i, c in enumerate(top_chunks):
            context_parts.append(
                f"[chunk_{i}] chunk_id={c['chunk_id']} | source={c.get('source', '未知')}\n{c.get('content', '')}"
            )
        context = "\n\n---\n\n".join(context_parts)
    else:
        context = "（暂无知识库上下文 — 请先通过「数据采集」Tab 抓取竞品数据后再生成 SWOT 报告）"

    # ── 3. Call LLM with JSON mode ────────────────────────
    client = get_client()

    competitors_str = "、".join(competitor_names)
    user_message = (
        f"请对以下竞品进行深度 SWOT 分析：{competitors_str}。\n"
        f"分析领域：{domain}。\n"
        f"时间范围：近 {time_range_days} 天。\n"
        f"请严格遵循系统指令中的分析框架，确保每个分析点都有原文引用支撑。"
    )

    try:
        parsed = _call_llm_with_retry(client, context, user_message)
    except Exception as exc:
        # Return an empty result with error context rather than crashing
        empty_matrix = SWOTMatrix()
        return SWOTGenerateData(
            report_id=f"rpt_{uuid.uuid4().hex[:10]}",
            task_id=f"swot_{uuid.uuid4().hex[:8]}",
            swot_matrix=empty_matrix,
            recommendations=[f"分析生成失败：{exc}。请确认向量库中有竞品数据且 LLM API 可用。"],
        )

    # ── 4. Convert to contract schema ──────────────────────
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


def _call_llm_with_retry(client, context: str, user_message: str) -> SwotOutput:
    """Call LLM with one automatic retry on validation failure."""

    system_content = SYSTEM_PROMPT.format(context=context)

    resp = client.chat.completions.create(
        model="deepseek-chat",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_content},
            {"role": "user", "content": user_message},
        ],
        max_tokens=4000,
        temperature=0.3,
    )

    raw = resp.choices[0].message.content.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1]
        if raw.endswith("```"):
            raw = raw[:-3]

    try:
        return SwotOutput.model_validate_json(raw)
    except (ValidationError, json.JSONDecodeError):
        # Retry once with explicit schema hints
        retry = client.chat.completions.create(
            model="deepseek-chat",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": user_message},
                {
                    "role": "user",
                    "content": (
                        "你的上一次输出格式不正确。请严格按 JSON 格式输出，确保：\n"
                        "- matrix 包含四个 key：strengths, weaknesses, opportunities, threats\n"
                        "- 每个元素必须有：point, chunk_id, source_title, raw_text_snippet, confidence\n"
                        "- confidence 是 0-1 之间的浮点数\n"
                        "- recommendations 是字符串数组"
                    ),
                },
            ],
            max_tokens=4000,
            temperature=0.2,
        )
        raw2 = retry.choices[0].message.content.strip()
        if raw2.startswith("```"):
            raw2 = raw2.split("\n", 1)[-1]
            if raw2.endswith("```"):
                raw2 = raw2[:-3]
        return SwotOutput.model_validate_json(raw2)
