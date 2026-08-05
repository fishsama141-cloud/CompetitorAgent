"""Data ingestion routes — crawl + task status + history (DB-persisted)."""

from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.auth import require_user
from backend.database import get_db
from backend.models import CrawlTask, Competitor, User
from backend.schemas import (
    CrawlRequest,
    CrawlResponse,
    CrawlResponseData,
    CrawlTaskItem,
    CrawlTaskListResponse,
    TaskStatusData,
    TaskStatusResponse,
)
from backend.services.scraper import ScrapeError, fetch, truncate
from backend.services.vector_store import ingest

router = APIRouter(prefix="/api/v1")


@router.post("/data/crawl", response_model=CrawlResponse)
async def trigger_crawl(
    body: CrawlRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
) -> CrawlResponse:
    """Scrape a URL → chunk → embed → persist task to DB."""
    task_id = f"crawl_{uuid.uuid4().hex[:8]}"

    # Look up competitor name for the log
    comp = db.query(Competitor).filter(
        Competitor.competitor_id == body.competitor_id,
        Competitor.user_id == current_user.id,
    ).first()
    comp_name = comp.name if comp else body.competitor_id

    # Create DB record
    db_task = CrawlTask(
        task_id=task_id,
        user_id=current_user.id,
        competitor_id=body.competitor_id,
        competitor_name=comp_name,
        source_url=body.url,
        source_type=body.source_type,
        status="processing",
    )
    db.add(db_task)
    db.commit()

    try:
        # 1. Scrape (Playwright → httpx fallback)
        text = await fetch(body.url, timeout=25)
        text = truncate(text)

        # 2. Ingest into vector store
        count = ingest(
            text=text,
            competitor_id=body.competitor_id,
            source_url=body.url,
            source_type=body.source_type,
        )

        # 3. Update competitor document_count
        if comp:
            comp.document_count = (comp.document_count or 0) + count
            db.commit()

        # 4. Mark task completed
        db_task.status = "completed"
        db_task.progress_percentage = 100
        db_task.documents_created = count
        db.commit()

    except ScrapeError as exc:
        db_task.status = "failed"
        db_task.error_message = str(exc)
        db.commit()
    except Exception as exc:
        db_task.status = "failed"
        db_task.error_message = f"采集异常: {exc}"
        db.commit()

    return CrawlResponse(
        data=CrawlResponseData(
            task_id=task_id,
            crawl_status="processing",
            estimated_time="30s",
        )
    )


@router.get("/data/task/{task_id}", response_model=TaskStatusResponse)
def get_task_status(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
) -> TaskStatusResponse:
    """Get a single task's status (DB-backed)."""
    task = db.query(CrawlTask).filter(
        CrawlTask.task_id == task_id,
        CrawlTask.user_id == current_user.id,
    ).first()

    if task is None:
        return TaskStatusResponse(
            data=TaskStatusData(
                task_id=task_id,
                status="failed",
                progress_percentage=0,
                documents_created=0,
                error_message="任务记录不存在或已过期",
            )
        )

    return TaskStatusResponse(
        data=TaskStatusData(
            task_id=task.task_id,
            status=task.status,
            progress_percentage=task.progress_percentage,
            documents_created=task.documents_created,
            error_message=task.error_message,
        )
    )


@router.get("/data/tasks", response_model=CrawlTaskListResponse)
def list_crawl_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
) -> CrawlTaskListResponse:
    """List all crawl task history for the current user (newest first)."""
    tasks = (
        db.query(CrawlTask)
        .filter(CrawlTask.user_id == current_user.id)
        .order_by(CrawlTask.created_at.desc())
        .limit(50)
        .all()
    )

    return CrawlTaskListResponse(
        data=[
            CrawlTaskItem(
                task_id=t.task_id,
                competitor_id=t.competitor_id,
                competitor_name=t.competitor_name,
                source_url=t.source_url,
                source_type=t.source_type,
                status=t.status,
                progress_percentage=t.progress_percentage,
                documents_created=t.documents_created,
                error_message=t.error_message,
                created_at=t.created_at.isoformat() if t.created_at else "",
            )
            for t in tasks
        ]
    )
