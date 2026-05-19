from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
import httpx, uuid
from app.database import get_db
from app.models.user import User, UserRole
from app.models.scan import ScanJob
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

    # Collect findings from all referenced scan jobs
    all_findings: list[dict] = []
    findings_by_severity: dict = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    scan_targets: list[str] = []

    if body.job_ids:
        jobs_result = await db.execute(select(ScanJob).where(ScanJob.id.in_(body.job_ids)))
        scan_jobs = jobs_result.scalars().all()
        for job in scan_jobs:
            scan_targets.append(job.target)
            if job.result and isinstance(job.result, dict):
                for f in job.result.get("findings", []):
                    all_findings.append(f)
                    sev = f.get("severity", "info")
                    if sev in findings_by_severity:
                        findings_by_severity[sev] += 1

    top_findings = sorted(
        all_findings,
        key=lambda f: ["critical", "high", "medium", "low", "info"].index(f.get("severity", "info"))
    )

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
                    "findings_by_severity": findings_by_severity,
                    "top_findings": top_findings,
                    "scan_targets": scan_targets,
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
    return {
        "id": report.id, "title": report.title, "template": report.template,
        "client_name": report.client_name, "pdf_ready": report.pdf_path is not None,
        "created_at": report.created_at,
    }


@router.get("/{report_id}/download")
async def download_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if not report.pdf_path:
        raise HTTPException(status_code=202, detail="PDF not ready yet")

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{settings.report_engine_url}/download/{report_id}",
            headers={"Authorization": f"Bearer {settings.module_secret}"},
        )
        if resp.status_code == 404:
            raise HTTPException(status_code=404, detail="PDF file not found")
        resp.raise_for_status()

    return StreamingResponse(
        iter([resp.content]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="report-{report_id[:8]}.pdf"'},
    )
