"""SWOT analysis routes — generate + CRUD for persisted reports."""

from __future__ import annotations

import json
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.auth import require_user
from backend.database import get_db
from backend.models import SwotReport, User
from backend.schemas import (
    SWOTGenerateData,
    SWOTGenerateRequest,
    SWOTGenerateResponse,
    SWOTMatrix,
    SwotItem,
    Citation,
    SwotReportDetail,
    SwotReportDetailResponse,
    SwotReportListItem,
    SwotReportListResponse,
)
from backend.services.swot_agent import generate as generate_swot_data

router = APIRouter(prefix="/api/v1")

# Shared memory store (for evaluation router backward compat)
# Populated on generate + on load from DB
from backend.routers.evaluation import _store as eval_store


# ── HELPERS ──────────────────────────────────────────────────


def _serialize_matrix(matrix: SWOTMatrix) -> str:
    """Serialize SWOTMatrix to JSON string for DB storage."""
    return json.dumps(matrix.model_dump(), ensure_ascii=False, default=str)


def _deserialize_matrix(raw: str) -> SWOTMatrix:
    """Deserialize JSON string back to SWOTMatrix."""
    try:
        return SWOTMatrix.model_validate_json(raw)
    except Exception:
        return SWOTMatrix()


def _matrix_total_points(matrix: SWOTMatrix) -> int:
    return (
        len(matrix.strengths)
        + len(matrix.weaknesses)
        + len(matrix.opportunities)
        + len(matrix.threats)
    )


def _to_list_item(report: SwotReport) -> SwotReportListItem:
    matrix = _deserialize_matrix(report.swot_matrix)
    return SwotReportListItem(
        report_id=report.report_id,
        competitor_names=report.competitor_names,
        domain=report.domain,
        time_range_days=report.time_range_days,
        total_points=_matrix_total_points(matrix),
        created_at=report.created_at.isoformat() if report.created_at else "",
    )


# ── GENERATE ────────────────────────────────────────────────


@router.post("/swot/generate", response_model=SWOTGenerateResponse)
def generate_swot(
    body: SWOTGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
) -> SWOTGenerateResponse:
    """Generate a SWOT report and persist it to the database."""
    data: SWOTGenerateData = generate_swot_data(
        competitor_names=body.competitors,
        domain=body.domain,
        time_range_days=body.time_range_days,
    )

    # Persist to DB
    record = SwotReport(
        report_id=data.report_id,
        user_id=current_user.id,
        competitor_names=",".join(body.competitors),
        domain=body.domain,
        time_range_days=body.time_range_days,
        swot_matrix=_serialize_matrix(data.swot_matrix),
        recommendations=json.dumps(data.recommendations, ensure_ascii=False),
    )
    db.add(record)
    db.commit()

    # Also store in memory for evaluation router backward compat
    eval_store[data.report_id] = {"swot": data.swot_matrix}

    return SWOTGenerateResponse(data=data)


# ── LIST ────────────────────────────────────────────────────


@router.get("/swot/reports", response_model=SwotReportListResponse)
def list_swot_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
) -> SwotReportListResponse:
    """List all saved SWOT reports for the current user, newest first."""
    reports = (
        db.query(SwotReport)
        .filter(SwotReport.user_id == current_user.id)
        .order_by(SwotReport.created_at.desc())
        .all()
    )
    items = [_to_list_item(r) for r in reports]
    return SwotReportListResponse(data=items)


# ── GET ONE ─────────────────────────────────────────────────


@router.get("/swot/reports/{report_id}", response_model=SwotReportDetailResponse)
def get_swot_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
) -> SwotReportDetailResponse:
    """Load a single SWOT report with full matrix and recommendations."""
    report = (
        db.query(SwotReport)
        .filter(
            SwotReport.report_id == report_id,
            SwotReport.user_id == current_user.id,
        )
        .first()
    )

    if report is None:
        return SwotReportDetailResponse(
            status="error",
            data=None,
            error_message=f"SWOT 报告 {report_id} 不存在或无权访问",
        )

    # Populate eval_store so evaluation router can find it without regenerate
    matrix = _deserialize_matrix(report.swot_matrix)
    recommendations = json.loads(report.recommendations) if report.recommendations else []
    eval_store.setdefault(report_id, {})["swot"] = matrix

    detail = SwotReportDetail(
        report_id=report.report_id,
        competitor_names=report.competitor_names,
        domain=report.domain,
        time_range_days=report.time_range_days,
        swot_matrix=matrix,
        recommendations=recommendations,
        created_at=report.created_at.isoformat() if report.created_at else "",
    )
    return SwotReportDetailResponse(data=detail)


# ── DELETE ──────────────────────────────────────────────────


@router.delete("/swot/reports/{report_id}")
def delete_swot_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
) -> dict:
    """Delete a saved SWOT report."""
    report = (
        db.query(SwotReport)
        .filter(
            SwotReport.report_id == report_id,
            SwotReport.user_id == current_user.id,
        )
        .first()
    )

    if report is None:
        return {"status": "error", "error_message": f"SWOT 报告 {report_id} 不存在或无权操作"}

    db.delete(report)
    db.commit()

    # Clean memory store too
    eval_store.pop(report_id, None)

    return {"status": "success", "data": {"report_id": report_id, "deleted": True}}
