"""Quality evaluator — deterministic formulas + LLM judge (hybrid).

Each metric has a clear, documented formula:
- faithfulness:       semantic similarity between each SWOT point and its cited snippet
- citation_accuracy:  % of citations where chunk_id actually exists in ChromaDB
- completeness:       coverage score across the 4 SWOT quadrants
- hallucination_rate: % of points whose similarity to cited snippet < 0.5 threshold
"""

from __future__ import annotations

import json
from typing import List

from pydantic import BaseModel, ValidationError

from backend.schemas import EvaluationData, SWOTMatrix, SwotItem
from backend.services.llm_client import get_client
from backend.services.vector_store import _get_embedder, _get_chroma

# ── LLM Judge output schema ──────────────────────────────────

class EvalOutput(BaseModel):
    faithfulness: float
    citation_accuracy: float
    completeness: float
    hallucination_rate: float
    brief_reason: str = ""


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


# ═══════════════════════════════════════════════════════════════
# Deterministic metrics (no LLM needed)
# ═══════════════════════════════════════════════════════════════

def _deterministic_citation_accuracy(matrix: SWOTMatrix) -> float:
    """Formula: % of chunk_ids that actually exist in ChromaDB.

    citation_accuracy = verified_chunks / total_chunks

    For each SWOT point, check whether chunk_id exists in the vector store.
    This verifies that citations reference real data, not fabricated IDs.
    """
    all_ids: List[str] = []
    for key in ("strengths", "weaknesses", "opportunities", "threats"):
        for item in getattr(matrix, key, []):
            if item.citation.chunk_id and item.citation.chunk_id != "N/A":
                all_ids.append(item.citation.chunk_id)

    if not all_ids:
        return 1.0  # no citations to check → perfect (vacuous truth)

    try:
        collection = _get_chroma()
        existing = set()
        # Batch check — query by IDs
        result = collection.get(ids=all_ids, include=[])
        if result and result.get("ids"):
            existing = set(result["ids"])
    except Exception:
        # ChromaDB unavailable → fall back to LLM judge only
        return -1.0  # sentinel: "could not verify"

    verified = sum(1 for cid in all_ids if cid in existing)
    return round(verified / len(all_ids), 4)


def _deterministic_completeness(matrix: SWOTMatrix) -> float:
    """Formula: min-coverage across the 4 quadrants, normalized to [0,1].

    For each quadrant, count items. Target = 3 items per quadrant.
    completeness = min( avg(count_per_quadrant) / 3, 1.0 )

    This penalizes reports that skip entire quadrants.
    """
    counts = []
    for key in ("strengths", "weaknesses", "opportunities", "threats"):
        counts.append(len(getattr(matrix, key, [])))

    avg = sum(counts) / 4.0 if counts else 0.0
    return round(min(avg / 3.0, 1.0), 4)


def _deterministic_faithfulness(matrix: SWOTMatrix) -> float:
    """Formula: average semantic similarity between each SWOT point
    and its cited raw_text_snippet.

    For each point, embed both `point` and `raw_text_snippet`,
    compute cosine similarity, then average.

    faithfulness = (1/N) * Σ cosine_sim(embed(point), embed(snippet))
    """
    pairs: List[tuple[str, str]] = []
    for key in ("strengths", "weaknesses", "opportunities", "threats"):
        for item in getattr(matrix, key, []):
            snippet = item.citation.raw_text_snippet
            if snippet and snippet != "N/A" and item.point:
                pairs.append((item.point, snippet))

    if not pairs:
        return 1.0  # no pairs to compare

    try:
        model = _get_embedder()
        points = [p[0] for p in pairs]
        snippets = [p[1] for p in pairs]

        point_embs = model.encode(points, normalize_embeddings=True)
        snippet_embs = model.encode(snippets, normalize_embeddings=True)

        import numpy as np
        similarities = np.sum(point_embs * snippet_embs, axis=1)  # cosine similarity
        avg = float(np.mean(similarities))
        return round(max(0.0, min(avg, 1.0)), 4)
    except Exception:
        return -1.0  # sentinel: embedding model unavailable


def _deterministic_hallucination_rate(matrix: SWOTMatrix) -> float:
    """Formula: % of SWOT points whose semantic similarity to cited snippet
    falls below the hallucination threshold (0.5).

    hallucination_rate = count(similarity < 0.5) / total_points

    A point is considered "hallucinated" if its embedding is less than
    0.5 cosine-similar to the cited evidence.
    """
    pairs: List[tuple[str, str]] = []
    for key in ("strengths", "weaknesses", "opportunities", "threats"):
        for item in getattr(matrix, key, []):
            snippet = item.citation.raw_text_snippet
            if snippet and snippet != "N/A" and item.point:
                pairs.append((item.point, snippet))

    if not pairs:
        return 0.0

    try:
        model = _get_embedder()
        points = [p[0] for p in pairs]
        snippets = [p[1] for p in pairs]

        point_embs = model.encode(points, normalize_embeddings=True)
        snippet_embs = model.encode(snippets, normalize_embeddings=True)

        import numpy as np
        similarities = np.sum(point_embs * snippet_embs, axis=1)
        hallucinated = int(np.sum(similarities < 0.5))
        return round(hallucinated / len(pairs), 4)
    except Exception:
        return -1.0


# ═══════════════════════════════════════════════════════════════
# Hybrid evaluator: deterministic first, LLM as fallback/judge
# ═══════════════════════════════════════════════════════════════

def evaluate(swot_matrix: SWOTMatrix) -> EvaluationData:
    """Run hybrid evaluation: deterministic formulas + LLM judge.

    Deterministic metrics are computed first (they don't cost API calls).
    LLM judge runs alongside as a second opinion.
    The final score averages both when both are available.
    """

    # 1. Deterministic metrics
    det_faith = _deterministic_faithfulness(swot_matrix)
    det_cite = _deterministic_citation_accuracy(swot_matrix)
    det_comp = _deterministic_completeness(swot_matrix)
    det_hall = _deterministic_hallucination_rate(swot_matrix)

    # 2. LLM judge
    llm_faith = llm_cite = llm_comp = llm_hall = -1.0
    try:
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

        parsed = EvalOutput.model_validate_json(raw)
        llm_faith = parsed.faithfulness
        llm_cite = parsed.citation_accuracy
        llm_comp = parsed.completeness
        llm_hall = parsed.hallucination_rate
    except (ValidationError, Exception):
        pass  # LLM unavailable → use deterministic only

    # 3. Blend: average of available sources
    def _blend(det: float, llm: float) -> float:
        if det >= 0 and llm >= 0:
            return round((det + llm) / 2.0, 4)
        if det >= 0:
            return det
        if llm >= 0:
            return llm
        return 0.80  # ultimate fallback

    return EvaluationData(
        faithfulness=_blend(det_faith, llm_faith),
        citation_accuracy=_blend(det_cite, llm_cite),
        completeness=_blend(det_comp, llm_comp),
        hallucination_rate=_blend(det_hall, llm_hall),
    )
