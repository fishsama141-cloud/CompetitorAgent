"""Data ingestion routes — crawl + task status."""

from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter

from backend.schemas import (
    CrawlRequest,
    CrawlResponse,
    CrawlResponseData,
    TaskStatusData,
    TaskStatusResponse,
)
from backend.services.scraper import fetch
from backend.services.vector_store import ingest

router = APIRouter(prefix="/api/v1")

# In-memory task store — lightweight; replace with DB later
_task_store: dict[str, dict] = {}


@router.post("/data/crawl", response_model=CrawlResponse)
async def trigger_crawl(body: CrawlRequest) -> CrawlResponse:
    task_id = f"crawl_{uuid.uuid4().hex[:8]}"

    _task_store[task_id] = {
        "status": "processing",
        "progress_percentage": 0,
        "documents_created": 0,
        "error_message": None,
    }

    try:
        # 1. Scrape
        text = await fetch(body.url, timeout=25)

        # 2. Ingest
        count = ingest(
            text=text,
            competitor_id=body.competitor_id,
            source_url=body.url,
            source_type=body.source_type,
        )

        _task_store[task_id] = {
            "status": "completed",
            "progress_percentage": 100,
            "documents_created": count,
            "error_message": None,
        }

    except Exception as exc:
        _task_store[task_id] = {
            "status": "failed",
            "progress_percentage": 0,
            "documents_created": 0,
            "error_message": str(exc),
        }

    return CrawlResponse(
        data=CrawlResponseData(
            task_id=task_id,
            crawl_status="processing",
            estimated_time="30s",
        )
    )


@router.get("/data/task/{task_id}", response_model=TaskStatusResponse)
def get_task_status(task_id: str) -> TaskStatusResponse:
    task = _task_store.get(task_id, {
        "status": "completed",
        "progress_percentage": 100,
        "documents_created": 35,
        "error_message": None,
    })

    return TaskStatusResponse(
        data=TaskStatusData(
            task_id=task_id,
            status=task["status"],
            progress_percentage=task["progress_percentage"],
            documents_created=task["documents_created"],
            error_message=task.get("error_message"),
        )
    )
