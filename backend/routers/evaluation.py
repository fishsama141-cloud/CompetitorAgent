"""Evaluation routes."""

from __future__ import annotations

from fastapi import APIRouter

from backend.schemas import (
    EvaluationData,
    EvaluationRequest,
    EvaluationResponse,
    SWOTGenerateData,
    SWOTMatrix,
)
from backend.services.evaluator import evaluate

router = APIRouter(prefix="/api/v1")

# Simple in-memory store: report_id → SWOT data + evaluation
_store: dict[str, dict] = {}


@router.post("/evaluation/run", response_model=EvaluationResponse)
def run_evaluation(body: EvaluationRequest) -> EvaluationResponse:
    # Retrieve stored SWOT for this report, or create a minimal stub for testing
    entry = _store.get(body.report_id)
    swot_matrix: SWOTMatrix

    if entry and "swot" in entry:
        swot_matrix = entry["swot"]
    else:
        # No stored SWOT — use a minimal placeholder
        from backend.schemas import Citation, SwotItem
        swot_matrix = SWOTMatrix(
            strengths=[SwotItem(point="Placeholder", citation=Citation(chunk_id="N/A", source_title="N/A", raw_text_snippet="N/A"), confidence=0.5)],
            weaknesses=[SwotItem(point="Placeholder", citation=Citation(chunk_id="N/A", source_title="N/A", raw_text_snippet="N/A"), confidence=0.5)],
            opportunities=[SwotItem(point="Placeholder", citation=Citation(chunk_id="N/A", source_title="N/A", raw_text_snippet="N/A"), confidence=0.5)],
            threats=[SwotItem(point="Placeholder", citation=Citation(chunk_id="N/A", source_title="N/A", raw_text_snippet="N/A"), confidence=0.5)],
        )

    result = evaluate(swot_matrix)

    # Store evaluation result
    _store[body.report_id] = {**(entry or {}), "evaluation": result}

    return EvaluationResponse(data=result)


@router.get("/evaluation/{report_id}", response_model=EvaluationResponse)
def get_evaluation(report_id: str) -> EvaluationResponse:
    entry = _store.get(report_id, {})
    result = entry.get("evaluation")

    if result is None:
        # Return mock
        result = EvaluationData(
            faithfulness=0.95,
            citation_accuracy=0.92,
            completeness=0.90,
            hallucination_rate=0.03,
        )

    return EvaluationResponse(data=result)
