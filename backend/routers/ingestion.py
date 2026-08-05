"""Data ingestion routes — crawl + task status + history (DB-persisted).

Crawl runs asynchronously: POST returns immediately, frontend polls for status.
"""

from __future__ import annotations

import asyncio
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session

from backend.auth import require_user
from backend.database import SessionLocal, get_db
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


def _run_crawl_sync(task_id: str, user_id: int, competitor_id: str, url: str, source_type: str):
    """Synchronous crawl logic — runs in a background thread."""
    db = SessionLocal()
    try:
        task = db.query(CrawlTask).filter(CrawlTask.task_id == task_id).first()
        if not task:
            return

        comp = db.query(Competitor).filter(
            Competitor.competitor_id == competitor_id,
            Competitor.user_id == user_id,
        ).first()

        # 1. Scrape (Playwright → httpx fallback)
        text = asyncio.run(fetch(url, timeout=25))
        text = truncate(text)

        # 2. Ingest into vector store
        count = ingest(
            text=text,
            competitor_id=competitor_id,
            source_url=url,
            source_type=source_type,
        )

        # 3. Update competitor document_count
        if comp:
            comp.document_count = (comp.document_count or 0) + count

        # 4. Mark task completed
        task.status = "completed"
        task.progress_percentage = 100
        task.documents_created = count
        db.commit()

    except ScrapeError as exc:
        if task:
            task.status = "failed"
            task.error_message = str(exc)
            db.commit()
    except Exception as exc:
        if task:
            task.status = "failed"
            task.error_message = f"采集异常: {exc}"
            db.commit()
    finally:
        db.close()


@router.post("/data/crawl", response_model=CrawlResponse)
def trigger_crawl(
    body: CrawlRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
) -> CrawlResponse:
    """Start a crawl — returns immediately, runs scrape in background."""
    import uuid as _uuid
    task_id = f"crawl_{_uuid.uuid4().hex[:8]}"

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

    # Schedule background work
    background_tasks.add_task(
        _run_crawl_sync,
        task_id=task_id,
        user_id=current_user.id,
        competitor_id=body.competitor_id,
        url=body.url,
        source_type=body.source_type,
    )

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
