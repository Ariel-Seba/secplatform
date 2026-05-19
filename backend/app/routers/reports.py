from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
import httpx, uuid
from app.database import get_db
from app.models.user import User, UserRole
from app.models.report import Report
from app.auth.dependencies import get_current_user, require_role
from app.core.config import get_settings

router = APIRouter()
settings = get_settings()

TEMPLATES = ["executive", "technical", "compliance", "discovery"]


class ReportCreate(BaseModel):
    title: str
    template: str
    job_ids: list[str]
    client_name: str | None = None
    metadata: dict = {}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_report(
    body: ReportCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if body.template not in TEMPLATES:
        raise HTTPException(status_code=400, detail=f"Invalid template. Choose from: {TEMPLATES}")

    report = Report(
        id=str(uuid.uuid4()),
        title=body.title,
        template=body.template,
        client_name=body.client_name,
        job_ids=body.job_ids,
        metadata_=body.metadata,
        created_by=user.id,
    )
    db.add(report)
    await db.commit()

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{settings.report_engine_url}/generate",
                headers={"Authorization": f"Bearer {settings.module_secret}"},
                json={
                    "report_id": report.id,
                    "template": body.template,
                    "title": body.title,
                    "client_name": body.client_name,
                    "job_ids": body.job_ids,
                    "analyst": user.full_name or user.username,
                    "metadata": body.metadata,
                },
            )
            if resp.status_code == 200:
                pdf_path = resp.json().get("pdf_path")
                report.pdf_path = pdf_path
                await db.commit()
    except Exception:
        pass

    return {"report_id": report.id, "status": "generating"}


@router.get("")
async def list_reports(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = select(Report).order_by(Report.created_at.desc())
    if user.role not in (UserRole.superadmin, UserRole.admin):
        query = query.where(Report.created_by == user.id)

    result = await db.execute(query)
    reports = result.scalars().all()
    return [
        {
            "id": r.id, "title": r.title, "template": r.template,
            "client_name": r.client_name, "pdf_ready": r.pdf_path is not None,
            "created_at": r.created_at,
        }
        for r in reports
    ]


@router.get("/{report_id}")
async def get_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report
