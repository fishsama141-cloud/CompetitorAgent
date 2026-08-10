"""Evaluation routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.auth import require_user
from backend.database import get_db
from backend.models import SwotReport, User
from backend.schemas import (
    EvalReportListItem,
    EvalReportListResponse,
    EvaluationData,
    EvaluationRequest,
    EvaluationResponse,
    SWOTMatrix,
)
from backend.services.evaluator import evaluate

router = APIRouter(prefix="/api/v1")

# Simple in-memory store: report_id → SWOT data + evaluation
_store: dict[str, dict] = {}


def _matrix_from_report(report: SwotReport) -> SWOTMatrix:
    """Deserialize SWOTMatrix from a DB report row."""
    from backend.routers.swot import _deserialize_matrix
    return _deserialize_matrix(report.swot_matrix)


def _count_points(matrix: SWOTMatrix) -> int:
    return (
        len(matrix.strengths)
        + len(matrix.weaknesses)
        + len(matrix.opportunities)
        + len(matrix.threats)
    )


# ── LIST available reports for evaluation ─────────────────────


@router.get("/evaluation/reports", response_model=EvalReportListResponse)
def list_eval_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
) -> EvalReportListResponse:
    """List all SWOT reports available for evaluation, newest first."""
    reports = (
        db.query(SwotReport)
        .filter(SwotReport.user_id == current_user.id)
        .order_by(SwotReport.created_at.desc())
        .all()
    )
    items = [
        EvalReportListItem(
            report_id=r.report_id,
            competitor_names=r.competitor_names,
            domain=r.domain,
            time_range_days=r.time_range_days,
            total_points=_count_points(_matrix_from_report(r)),
            created_at=r.created_at.isoformat() if r.created_at else "",
        )
        for r in reports
    ]
    return EvalReportListResponse(data=items)


# ── RUN evaluation ────────────────────────────────────────────


def _resolve_report_id(
    report_id: str | None,
    db: Session,
    current_user: User,
) -> tuple[str | None, SWOTMatrix | None, str | None]:
    """Resolve report_id → SWOTMatrix.  Auto-picks latest if report_id is None.

    Returns (report_id, matrix, error_message).
    """
    if report_id:
        report = (
            db.query(SwotReport)
            .filter(
                SwotReport.report_id == report_id,
                SwotReport.user_id == current_user.id,
            )
            .first()
        )
        if report is None:
            return None, None, f"SWOT 报告 {report_id} 不存在或无权访问"
    else:
        # Auto-pick the latest report
        report = (
            db.query(SwotReport)
            .filter(SwotReport.user_id == current_user.id)
            .order_by(SwotReport.created_at.desc())
            .first()
        )
        if report is None:
            return None, None, "尚未生成任何 SWOT 报告，请先生成一份报告"

    matrix = _matrix_from_report(report)
    return report.report_id, matrix, None


@router.post("/evaluation/run", response_model=EvaluationResponse)
def run_evaluation(
    body: EvaluationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
) -> EvaluationResponse:
    """Run quality evaluation on a SWOT report.

    If report_id is omitted, the latest SWOT report is evaluated automatically.
    """
    report_id, matrix, error = _resolve_report_id(body.report_id, db, current_user)

    if error:
        return EvaluationResponse(status="error", data=None, error_message=error)

    result = evaluate(matrix)

    # Cache in memory store
    _store[report_id] = {"swot": matrix, "evaluation": result}

    return EvaluationResponse(data=result)


# ── GET evaluation by report_id ───────────────────────────────


@router.get("/evaluation/{report_id}", response_model=EvaluationResponse)
def get_evaluation(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
) -> EvaluationResponse:
    """Retrieve a previously computed evaluation by report_id.

    Falls back to re-running evaluation from the DB report if not cached in memory.
    """
    # Check memory cache first
    entry = _store.get(report_id, {})
    cached = entry.get("evaluation")
    if cached is not None:
        return EvaluationResponse(data=cached)

    # Not in cache — try DB
    report = (
        db.query(SwotReport)
        .filter(
            SwotReport.report_id == report_id,
            SwotReport.user_id == current_user.id,
        )
        .first()
    )

    if report is None:
        return EvaluationResponse(
            status="error",
            data=None,
            error_message=f"SWOT 报告 {report_id} 不存在或无权访问",
        )

    # Re-run evaluation from DB and cache it
    matrix = _matrix_from_report(report)
    result = evaluate(matrix)
    _store[report_id] = {"swot": matrix, "evaluation": result}

    return EvaluationResponse(data=result)
