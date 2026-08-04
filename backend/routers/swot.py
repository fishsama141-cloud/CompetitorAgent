"""SWOT analysis route."""

from __future__ import annotations

from fastapi import APIRouter

from backend.schemas import SWOTGenerateRequest, SWOTGenerateResponse
from backend.services.swot_agent import generate

router = APIRouter(prefix="/api/v1")

# Share store with evaluation router so it can find generated SWOTs
from backend.routers.evaluation import _store as eval_store


@router.post("/swot/generate", response_model=SWOTGenerateResponse)
def generate_swot(body: SWOTGenerateRequest) -> SWOTGenerateResponse:
    data = generate(
        competitor_names=body.competitors,
        domain=body.domain,
        time_range_days=body.time_range_days,
    )
    # Store for later evaluation
    eval_store[data.report_id] = {"swot": data.swot_matrix}
    return SWOTGenerateResponse(data=data)
