"""Competitor Intelligence Agent — FastAPI Backend.

Strictly aligned with api_contract.json.
Real ingestion, knowledge, SWOT, evaluation, and auth routes.
"""

from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from datetime import date

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from backend.auth import require_user
from backend.database import Base, engine, get_db
from backend.models import Competitor, User
from backend.routers.auth import router as auth_router
from backend.routers.evaluation import router as evaluation_router
from backend.routers.ingestion import router as ingestion_router
from backend.routers.knowledge import router as knowledge_router
from backend.routers.swot import router as swot_router
from backend.schemas import (
    CompetitorCreateData,
    CompetitorCreateRequest,
    CompetitorCreateResponse,
    CompetitorListItem,
    CompetitorListResponse,
)


# ── Lifespan: create tables on startup ────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


# ── App factory ──────────────────────────────────────────────
app = FastAPI(
    title="Competitor Intelligence Agent",
    version="1.0.0",
    docs_url="/docs",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(auth_router)
app.include_router(ingestion_router)
app.include_router(knowledge_router)
app.include_router(swot_router)
app.include_router(evaluation_router)

API = "/api/v1"


# ============================================================
# Health
# ============================================================


@app.get(f"{API}/health")
def health() -> dict:
    return {"status": "ok", "version": "1.0.0"}


# ============================================================
# Competitor — DB-backed CRUD
# ============================================================


@app.post(f"{API}/competitors", response_model=CompetitorCreateResponse)
def create_competitor(
    body: CompetitorCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
) -> CompetitorCreateResponse:
    """Create a new competitor — scoped to the authenticated user."""
    cid = f"cmp_{uuid.uuid4().hex[:8]}"
    comp = Competitor(
        competitor_id=cid,
        user_id=current_user.id,
        name=body.name,
        category=body.category,
        official_url=body.official_url,
        description=body.description,
    )
    db.add(comp)
    db.commit()
    db.refresh(comp)
    return CompetitorCreateResponse(
        data=CompetitorCreateData(
            competitor_id=comp.competitor_id,
            name=comp.name,
            created_time=comp.created_at.date(),
        )
    )


@app.get(f"{API}/competitors", response_model=CompetitorListResponse)
def list_competitors(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
) -> CompetitorListResponse:
    """List competitors belonging to the authenticated user."""
    comps = (
        db.query(Competitor)
        .filter(Competitor.user_id == current_user.id)
        .order_by(Competitor.created_at.desc())
        .all()
    )

    return CompetitorListResponse(
        data=[
            CompetitorListItem(
                competitor_id=c.competitor_id,
                name=c.name,
                category=c.category,
                official_url=c.official_url,
                latest_update=c.latest_update.date() if c.latest_update else date.today(),
                document_count=c.document_count,
            )
            for c in comps
        ]
    )
