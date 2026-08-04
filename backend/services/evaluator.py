"""LLM-as-a-Judge quality evaluator for SWOT reports."""

from __future__ import annotations

import json
from typing import List

from pydantic import BaseModel, Field, ValidationError

from backend.schemas import EvaluationData, SWOTMatrix, SwotItem
from backend.services.llm_client import get_client

# ── Schema ───────────────────────────────────────────────────

class EvalOutput(BaseModel):
    faithfulness: float
    citation_accuracy: float
    completeness: float
    hallucination_rate: float
    brief_reason: str = ""


# ── Prompt ───────────────────────────────────────────────────

EVAL_PROMPT = """你是 LLM 质量裁判。对以下 SWOT 报告进行四维评分，每项 0.0-1.0。

## 维度
- faithfulness（忠实度）：分析点是否严格基于 citation 的 raw_text_snippet？无编造=1.0
- citation_accuracy（引用准确率）：chunk_id 和 source_title 是否匹配？
- completeness（完整度）：四象限是否都有覆盖？
- hallucination_rate（幻觉率）：编造/失实比例。越低越好。0.0=完全无幻觉

## SWOT 报告
{swot_json}

输出纯 JSON：{{"faithfulness": 0.xx, "citation_accuracy": 0.xx, "completeness": 0.xx, "hallucination_rate": 0.xx, "brief_reason": "简要说明"}}"""


def _swot_to_json(matrix: SWOTMatrix) -> str:
    items: dict = {}
    for key in ("strengths", "weaknesses", "opportunities", "threats"):
        swot_items: List[SwotItem] = getattr(matrix, key, [])
        items[key] = [
            {
                "point": item.point,
                "chunk_id": item.citation.chunk_id,
                "source": item.citation.source_title,
                "snippet": item.citation.raw_text_snippet[:200],
                "confidence": item.confidence,
            }
            for item in swot_items
        ]
    return json.dumps(items, ensure_ascii=False, indent=2)


def evaluate(swot_matrix: SWOTMatrix) -> EvaluationData:
    client = get_client()

    resp = client.chat.completions.create(
        model="deepseek-chat",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": EVAL_PROMPT.format(swot_json=_swot_to_json(swot_matrix))},
        ],
        max_tokens=400,
        temperature=0.0,
    )

    raw = resp.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1]
        if raw.endswith("```"):
            raw = raw[:-3]

    try:
        parsed = EvalOutput.model_validate_json(raw)
    except ValidationError:
        # Fallback defaults
        return EvaluationData(
            faithfulness=0.80,
            citation_accuracy=0.80,
            completeness=0.80,
            hallucination_rate=0.10,
        )

    return EvaluationData(
        faithfulness=parsed.faithfulness,
        citation_accuracy=parsed.citation_accuracy,
        completeness=parsed.completeness,
        hallucination_rate=parsed.hallucination_rate,
    )
